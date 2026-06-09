use crate::state::{AppSettings, AppState};
use crate::validation::validator::ValidationProblem;
use crate::validation::{detect_and_decode, validate_characters};
use glob::Pattern;
use serde::Serialize;
use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::path::Path;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};
use tokio_util::sync::CancellationToken;
use walkdir::WalkDir;

/// Maximum file size to read during bulk scan (50 MB).
/// Files larger than this are silently skipped to prevent unbounded memory consumption.
const MAX_SCAN_FILE_SIZE: u64 = 50 * 1024 * 1024;
const PROGRESS_FILE_BATCH: u32 = 200;
const PROGRESS_MIN_INTERVAL: Duration = Duration::from_millis(150);
const SEARCH_RESULT_BATCH_SIZE: usize = 50;
const SEARCH_RESULT_BATCH_INTERVAL: Duration = Duration::from_millis(150);

pub struct ExplorerState {
    pub active_listings: Mutex<HashMap<String, CancellationToken>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    pub name: String,
    pub is_dir: bool,
    pub path: String,
}

#[tauri::command]
pub async fn list_directory_cmd(
    path: String,
    operation_id: String,
    explorer_state: State<'_, ExplorerState>,
) -> Result<Vec<DirEntry>, String> {
    let cancel_token = CancellationToken::new();
    let token_clone = cancel_token.clone();

    {
        let mut listings = explorer_state
            .active_listings
            .lock()
            .map_err(|e| e.to_string())?;
        listings.insert(operation_id.clone(), cancel_token);
    }

    let op_id = operation_id.clone();
    let result = tokio::time::timeout(
        Duration::from_secs(15),
        tokio::task::spawn_blocking(move || {
            let read_dir = std::fs::read_dir(&path)
                .map_err(|e| format!("Failed to read directory '{}': {}", path, e))?;

            let mut entries = Vec::new();
            for entry_result in read_dir {
                if token_clone.is_cancelled() {
                    return Err("Operation cancelled".to_string());
                }

                match entry_result {
                    Ok(entry) => {
                        let metadata = entry.metadata();
                        let is_dir = metadata.map(|m| m.is_dir()).unwrap_or(false);
                        let name = entry.file_name().to_string_lossy().to_string();
                        let entry_path = entry.path().to_string_lossy().to_string();

                        entries.push(DirEntry {
                            name,
                            is_dir,
                            path: entry_path,
                        });
                    }
                    Err(e) => {
                        // Skip entries that can't be read
                        eprintln!("Skipping unreadable entry: {}", e);
                    }
                }
            }

            Ok(entries)
        }),
    )
    .await;

    // Clean up active listing
    if let Ok(mut listings) = explorer_state.active_listings.lock() {
        listings.remove(&op_id);
    }

    match result {
        Ok(Ok(entries)) => entries,
        Ok(Err(e)) => Err(format!("Directory listing task failed: {}", e)),
        Err(_) => Err("Folder listing timed out after 15 seconds".to_string()),
    }
}

#[tauri::command]
pub fn cancel_directory_cmd(
    operation_id: String,
    explorer_state: State<'_, ExplorerState>,
) -> Result<(), String> {
    let listings = explorer_state
        .active_listings
        .lock()
        .map_err(|e| e.to_string())?;

    if let Some(token) = listings.get(&operation_id) {
        token.cancel();
    }

    Ok(())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileContent {
    pub content: String,
    pub size: u64,
    pub problems: Vec<ValidationProblem>,
    pub encoding: String,
    pub has_bom: bool,
}

#[tauri::command]
pub async fn read_file_cmd(path: String) -> Result<FileContent, String> {
    tokio::time::timeout(
        Duration::from_secs(30),
        tokio::task::spawn_blocking(move || {
            let metadata = std::fs::metadata(&path)
                .map_err(|e| format!("Failed to read file '{}': {}", path, e))?;
            let size = metadata.len();
            let raw_bytes = std::fs::read(&path)
                .map_err(|e| format!("Failed to read file '{}': {}", path, e))?;

            let decode_result = detect_and_decode(&raw_bytes);
            let problems = validate_characters(
                &decode_result.content,
                decode_result.had_errors,
                &decode_result.encoding_name,
                decode_result.has_bom,
            );

            Ok(FileContent {
                content: decode_result.content,
                size,
                problems,
                encoding: decode_result.encoding_name,
                has_bom: decode_result.has_bom,
            })
        }),
    )
    .await
    .map_err(|_| "File read timed out after 30 seconds".to_string())?
    .map_err(|e| format!("File read task failed: {}", e))?
}

#[tauri::command]
pub async fn check_path_reachable(path: String) -> Result<bool, String> {
    let result = tokio::task::spawn_blocking(move || std::fs::metadata(&path).is_ok())
        .await
        .map_err(|e| format!("Task failed: {}", e))?;

    Ok(result)
}

#[tauri::command]
pub fn toggle_favorite_cmd(
    source_id: String,
    client_name: String,
    state: State<'_, AppState>,
) -> Result<AppSettings, String> {
    state.toggle_favorite(&source_id, &client_name)
}

// -- Content search types and commands --

/// Parse a search query into individual terms.
///
/// Space-separated words become individual lowercase terms.
/// Quoted substrings (using double quotes) are preserved as single terms.
/// Unclosed quotes treat the remainder as a single term.
/// Empty quotes are skipped.
pub fn parse_search_terms(query: &str) -> Vec<String> {
    let mut terms = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;

    for ch in query.chars() {
        match ch {
            '"' => {
                if in_quotes {
                    // End of quoted section
                    let trimmed = current.trim().to_string();
                    if !trimmed.is_empty() {
                        terms.push(trimmed.to_lowercase());
                    }
                    current.clear();
                    in_quotes = false;
                } else {
                    // Start of quoted section -- flush current token first
                    let trimmed = current.trim().to_string();
                    if !trimmed.is_empty() {
                        terms.push(trimmed.to_lowercase());
                    }
                    current.clear();
                    in_quotes = true;
                }
            }
            ' ' if !in_quotes => {
                let trimmed = current.trim().to_string();
                if !trimmed.is_empty() {
                    terms.push(trimmed.to_lowercase());
                }
                current.clear();
            }
            _ => {
                current.push(ch);
            }
        }
    }

    // Handle remaining content (including unclosed quotes)
    let trimmed = current.trim().to_string();
    if !trimmed.is_empty() {
        terms.push(trimmed.to_lowercase());
    }

    terms
}

fn search_file_line_by_line(file_path: &Path, terms: &[String]) -> std::io::Result<Option<u32>> {
    let file = std::fs::File::open(file_path)?;
    let mut reader = BufReader::new(file);
    let mut buffer = Vec::new();
    let mut found_terms = vec![false; terms.len()];
    let mut match_count: u32 = 0;

    loop {
        buffer.clear();
        let read = reader.read_until(b'\n', &mut buffer)?;
        if read == 0 {
            break;
        }

        if buffer.last() == Some(&b'\n') {
            buffer.pop();
        }
        if buffer.last() == Some(&b'\r') {
            buffer.pop();
        }

        let line = String::from_utf8_lossy(&buffer).to_lowercase();
        for (idx, term) in terms.iter().enumerate() {
            let count = line.matches(term.as_str()).count().min(u32::MAX as usize) as u32;
            if count > 0 {
                found_terms[idx] = true;
                match_count = match_count.saturating_add(count);
            }
        }
    }

    if found_terms.into_iter().all(|found| found) {
        Ok(Some(match_count))
    } else {
        Ok(None)
    }
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResultPayload {
    pub file_path: String,
    pub file_name: String,
    pub parent_folder: String,
    pub match_count: u32,
    pub operation_id: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchErrorPayload {
    pub file_path: String,
    pub file_name: String,
    pub parent_folder: String,
    pub error_message: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResultsBatchPayload {
    pub operation_id: String,
    pub results: Vec<SearchResultPayload>,
    pub errors: Vec<SearchErrorPayload>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchProgressPayload {
    pub files_scanned: u32,
    pub total_files: Option<u32>,
    pub matches_found: u32,
    pub files_matched: u32,
    pub operation_id: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchSummaryResult {
    pub query: String,
    pub scope_label: String,
    pub file_pattern: String,
    pub total_files_scanned: u32,
    pub total_files_matched: u32,
    pub total_matches: u32,
    pub cancelled: bool,
}

#[tauri::command]
pub async fn content_search_cmd(
    app: AppHandle,
    query: String,
    folder_paths: String,
    file_pattern: String,
    scope_label: String,
    operation_id: String,
    explorer_state: State<'_, ExplorerState>,
) -> Result<SearchSummaryResult, String> {
    let terms = parse_search_terms(&query);
    if terms.is_empty() {
        return Err("Search query is empty".to_string());
    }

    let paths: Vec<String> = serde_json::from_str(&folder_paths)
        .map_err(|e| format!("Invalid folder_paths JSON: {}", e))?;

    let pattern = Pattern::new(&file_pattern)
        .map_err(|e| format!("Invalid file pattern '{}': {}", file_pattern, e))?;

    let cancel_token = CancellationToken::new();
    let token_clone = cancel_token.clone();

    {
        let mut listings = explorer_state
            .active_listings
            .lock()
            .map_err(|e| e.to_string())?;
        listings.insert(operation_id.clone(), cancel_token);
    }

    let op_id = operation_id.clone();
    let query_clone = query.clone();
    let file_pattern_clone = file_pattern.clone();
    let scope_label_clone = scope_label.clone();

    let result = tokio::task::spawn_blocking(move || {
        let mut files_scanned: u32 = 0;
        let mut total_matches: u32 = 0;
        let mut files_matched: u32 = 0;
        let mut cancelled = false;
        let mut last_emit_time = std::time::Instant::now();
        let mut last_batch_emit_time = std::time::Instant::now();
        let mut consecutive_read_failures: u32 = 0;
        let mut pending_results: Vec<SearchResultPayload> = Vec::new();
        let mut pending_errors: Vec<SearchErrorPayload> = Vec::new();

        let flush_search_batches =
            |force: bool,
             pending_results: &mut Vec<SearchResultPayload>,
             pending_errors: &mut Vec<SearchErrorPayload>,
             last_batch_emit_time: &mut std::time::Instant| {
                let has_payload = !pending_results.is_empty() || !pending_errors.is_empty();
                if !has_payload {
                    return;
                }
                let batch_full = pending_results.len().saturating_add(pending_errors.len())
                    >= SEARCH_RESULT_BATCH_SIZE;
                if !force
                    && !batch_full
                    && last_batch_emit_time.elapsed() < SEARCH_RESULT_BATCH_INTERVAL
                {
                    return;
                }

                let payload = SearchResultsBatchPayload {
                    operation_id: operation_id.clone(),
                    results: std::mem::take(pending_results),
                    errors: std::mem::take(pending_errors),
                };
                let _ = app.emit("search-results-batch", payload);
                *last_batch_emit_time = std::time::Instant::now();
            };

        let emit_progress = |force: bool,
                             files_scanned: u32,
                             total_matches: u32,
                             files_matched: u32,
                             last_emit_time: &mut std::time::Instant| {
            let batch_ready = files_scanned % PROGRESS_FILE_BATCH == 0;
            if !force && !batch_ready && last_emit_time.elapsed() < PROGRESS_MIN_INTERVAL {
                return;
            }
            let progress_payload = SearchProgressPayload {
                files_scanned,
                total_files: None,
                matches_found: total_matches,
                files_matched,
                operation_id: operation_id.clone(),
            };
            let _ = app.emit("search-progress", progress_payload);
            *last_emit_time = std::time::Instant::now();
        };

        'folders: for folder_path in &paths {
            if token_clone.is_cancelled() {
                cancelled = true;
                break;
            }

            match std::fs::metadata(folder_path) {
                Ok(m) if m.is_dir() => {}
                Ok(_) => continue,
                Err(_) => continue,
            }

            for entry_result in WalkDir::new(folder_path).into_iter() {
                if token_clone.is_cancelled() {
                    cancelled = true;
                    break 'folders;
                }

                let entry = match entry_result {
                    Ok(entry) => entry,
                    Err(_) => continue,
                };

                if entry.file_type().is_dir() {
                    continue;
                }

                if !entry
                    .file_name()
                    .to_str()
                    .map(|n| pattern.matches(n))
                    .unwrap_or(false)
                {
                    continue;
                }

                let file_path = entry.path();
                let file_name = file_path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("")
                    .to_string();

                let parent_folder = file_path
                    .parent()
                    .map(|p| p.to_string_lossy().to_string())
                    .unwrap_or_default();

                match std::fs::metadata(file_path) {
                    Ok(m) if m.len() > MAX_SCAN_FILE_SIZE => {
                        files_scanned = files_scanned.saturating_add(1);
                        consecutive_read_failures = 0;
                        emit_progress(
                            false,
                            files_scanned,
                            total_matches,
                            files_matched,
                            &mut last_emit_time,
                        );
                        continue;
                    }
                    Err(_) => {
                        consecutive_read_failures = consecutive_read_failures.saturating_add(1);
                        files_scanned = files_scanned.saturating_add(1);
                        if consecutive_read_failures >= 10 {
                            cancelled = true;
                            break 'folders;
                        }
                        emit_progress(
                            false,
                            files_scanned,
                            total_matches,
                            files_matched,
                            &mut last_emit_time,
                        );
                        continue;
                    }
                    _ => {
                        consecutive_read_failures = 0;
                    }
                }

                match search_file_line_by_line(file_path, &terms) {
                    Ok(Some(match_count)) => {
                        consecutive_read_failures = 0;
                        total_matches = total_matches.saturating_add(match_count);
                        files_matched = files_matched.saturating_add(1);
                        pending_results.push(SearchResultPayload {
                            file_path: file_path.to_string_lossy().to_string(),
                            file_name,
                            parent_folder,
                            match_count,
                            operation_id: operation_id.clone(),
                        });
                    }
                    Ok(None) => {
                        consecutive_read_failures = 0;
                    }
                    Err(_) => {
                        consecutive_read_failures = consecutive_read_failures.saturating_add(1);
                        pending_errors.push(SearchErrorPayload {
                            file_path: file_path.to_string_lossy().to_string(),
                            file_name,
                            parent_folder,
                            error_message: "Failed to read file".to_string(),
                        });
                        if consecutive_read_failures >= 10 {
                            cancelled = true;
                            break 'folders;
                        }
                    }
                }

                files_scanned = files_scanned.saturating_add(1);
                flush_search_batches(
                    false,
                    &mut pending_results,
                    &mut pending_errors,
                    &mut last_batch_emit_time,
                );
                emit_progress(
                    false,
                    files_scanned,
                    total_matches,
                    files_matched,
                    &mut last_emit_time,
                );
            }
        }

        flush_search_batches(
            true,
            &mut pending_results,
            &mut pending_errors,
            &mut last_batch_emit_time,
        );
        emit_progress(
            true,
            files_scanned,
            total_matches,
            files_matched,
            &mut last_emit_time,
        );

        SearchSummaryResult {
            query: query_clone,
            scope_label: scope_label_clone,
            file_pattern: file_pattern_clone,
            total_files_scanned: files_scanned,
            total_files_matched: files_matched,
            total_matches,
            cancelled,
        }
    })
    .await
    .map_err(|e| format!("Search task failed: {}", e))?;

    // Clean up active listing
    if let Ok(mut listings) = explorer_state.active_listings.lock() {
        listings.remove(&op_id);
    }

    Ok(result)
}

// -- Bulk scan types and commands --

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanProgressPayload {
    pub operation_id: String,
    pub file_path: String,
    pub file_name: String,
    pub status: String,
    pub error_count: u32,
    pub warning_count: u32,
    pub files_processed: u32,
    pub total_files: Option<u32>,
    pub total_errors: u32,
    pub total_warnings: u32,
    pub total_clean: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanFileResult {
    pub file_path: String,
    pub file_name: String,
    pub relative_path: String,
    pub status: String,
    pub problems: Vec<ValidationProblem>,
    pub encoding: String,
    pub has_bom: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanSummary {
    pub folder_path: String,
    pub file_pattern: String,
    pub total_files: u32,
    pub error_files: u32,
    pub warning_files: u32,
    pub clean_files: u32,
    pub total_errors: u32,
    pub total_warnings: u32,
    pub files: Vec<ScanFileResult>,
    pub cancelled: bool,
}

fn validate_file_for_scan(
    file_path: &Path,
    folder_root: &str,
) -> std::io::Result<Option<ScanFileResult>> {
    let metadata = std::fs::metadata(file_path)?;
    if metadata.len() > MAX_SCAN_FILE_SIZE {
        return Ok(None);
    }

    let raw_bytes = std::fs::read(file_path)?;
    let has_bom = raw_bytes.starts_with(&[0xEF, 0xBB, 0xBF])
        || raw_bytes.starts_with(&[0xFF, 0xFE])
        || raw_bytes.starts_with(&[0xFE, 0xFF]);

    let (problems, encoding, has_bom) = if !has_bom {
        match std::str::from_utf8(&raw_bytes) {
            Ok(content) => (
                validate_characters(content, false, "UTF-8", false),
                "UTF-8".to_string(),
                false,
            ),
            Err(_) => {
                let decode_result = detect_and_decode(&raw_bytes);
                let problems = validate_characters(
                    &decode_result.content,
                    decode_result.had_errors,
                    &decode_result.encoding_name,
                    decode_result.has_bom,
                );
                (problems, decode_result.encoding_name, decode_result.has_bom)
            }
        }
    } else {
        let decode_result = detect_and_decode(&raw_bytes);
        let problems = validate_characters(
            &decode_result.content,
            decode_result.had_errors,
            &decode_result.encoding_name,
            decode_result.has_bom,
        );
        (problems, decode_result.encoding_name, decode_result.has_bom)
    };

    let file_error_count = problems
        .iter()
        .filter(|p| p.severity == "error")
        .count()
        .min(u32::MAX as usize) as u32;
    let file_warning_count = problems
        .iter()
        .filter(|p| p.severity == "warning")
        .count()
        .min(u32::MAX as usize) as u32;

    let status = if file_error_count > 0 {
        "error"
    } else if file_warning_count > 0 {
        "warning"
    } else {
        "clean"
    };

    let file_name = file_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("")
        .to_string();

    let relative_path = file_path
        .strip_prefix(folder_root)
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| file_path.to_string_lossy().to_string());

    Ok(Some(ScanFileResult {
        file_path: file_path.to_string_lossy().to_string(),
        file_name,
        relative_path,
        status: status.to_string(),
        problems,
        encoding,
        has_bom,
    }))
}

#[tauri::command]
pub async fn bulk_scan_cmd(
    app: AppHandle,
    folder_path: String,
    file_pattern: String,
    operation_id: String,
    explorer_state: State<'_, ExplorerState>,
) -> Result<ScanSummary, String> {
    let pattern = Pattern::new(&file_pattern)
        .map_err(|e| format!("Invalid file pattern '{}': {}", file_pattern, e))?;

    let cancel_token = CancellationToken::new();
    let token_clone = cancel_token.clone();

    {
        let mut listings = explorer_state
            .active_listings
            .lock()
            .map_err(|e| e.to_string())?;
        listings.insert(operation_id.clone(), cancel_token);
    }

    let op_id = operation_id.clone();
    let op_id_cleanup = op_id.clone();
    let folder_path_clone = folder_path.clone();
    let file_pattern_clone = file_pattern.clone();

    let result = tokio::task::spawn_blocking(move || {
        let mut total_files: u32 = 0;
        let mut files_processed: u32 = 0;
        let mut total_errors: u32 = 0;
        let mut total_warnings: u32 = 0;
        let mut total_clean: u32 = 0;
        let mut error_files: u32 = 0;
        let mut warning_files: u32 = 0;
        let mut clean_files: u32 = 0;
        let mut file_results: Vec<ScanFileResult> = Vec::new();
        let mut cancelled = false;
        let mut last_emit_time = std::time::Instant::now();
        let mut last_progress_file_path = Path::new(&folder_path_clone).to_path_buf();
        let mut last_progress_status = "clean".to_string();
        let mut last_progress_error_count: u32 = 0;
        let mut last_progress_warning_count: u32 = 0;

        let emit_progress = |force: bool,
                             file_path: &Path,
                             status: &str,
                             error_count: u32,
                             warning_count: u32,
                             files_processed: u32,
                             total_errors: u32,
                             total_warnings: u32,
                             total_clean: u32,
                             last_emit_time: &mut std::time::Instant| {
            let batch_ready = files_processed % PROGRESS_FILE_BATCH == 0;
            if !force && !batch_ready && last_emit_time.elapsed() < PROGRESS_MIN_INTERVAL {
                return;
            }

            let file_name = file_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();
            let payload = ScanProgressPayload {
                operation_id: op_id.clone(),
                file_path: file_path.to_string_lossy().to_string(),
                file_name,
                status: status.to_string(),
                error_count,
                warning_count,
                files_processed,
                total_files: None,
                total_errors,
                total_warnings,
                total_clean,
            };
            let _ = app.emit("scan-progress", payload);
            *last_emit_time = std::time::Instant::now();
        };

        for entry_result in WalkDir::new(&folder_path_clone).into_iter() {
            if token_clone.is_cancelled() {
                cancelled = true;
                break;
            }

            let entry = match entry_result {
                Ok(entry) => entry,
                Err(_) => continue,
            };

            if entry.file_type().is_dir() {
                continue;
            }

            if !entry
                .file_name()
                .to_str()
                .map(|n| pattern.matches(n))
                .unwrap_or(false)
            {
                continue;
            }

            total_files = total_files.saturating_add(1);
            let file_path = entry.path();
            last_progress_file_path = file_path.to_path_buf();

            let scan_result = validate_file_for_scan(file_path, &folder_path_clone);
            files_processed = files_processed.saturating_add(1);

            match scan_result {
                Ok(Some(file_result)) => {
                    let file_error_count = file_result
                        .problems
                        .iter()
                        .filter(|p| p.severity == "error")
                        .count()
                        .min(u32::MAX as usize) as u32;
                    let file_warning_count = file_result
                        .problems
                        .iter()
                        .filter(|p| p.severity == "warning")
                        .count()
                        .min(u32::MAX as usize) as u32;

                    total_errors = total_errors.saturating_add(file_error_count);
                    total_warnings = total_warnings.saturating_add(file_warning_count);
                    last_progress_status = file_result.status.clone();
                    last_progress_error_count = file_error_count;
                    last_progress_warning_count = file_warning_count;
                    match file_result.status.as_str() {
                        "error" => error_files = error_files.saturating_add(1),
                        "warning" => warning_files = warning_files.saturating_add(1),
                        _ => {
                            total_clean = total_clean.saturating_add(1);
                            clean_files = clean_files.saturating_add(1);
                        }
                    }

                    emit_progress(
                        false,
                        file_path,
                        &file_result.status,
                        file_error_count,
                        file_warning_count,
                        files_processed,
                        total_errors,
                        total_warnings,
                        total_clean,
                        &mut last_emit_time,
                    );
                    file_results.push(file_result);
                }
                Ok(None) | Err(_) => {
                    last_progress_status = "clean".to_string();
                    last_progress_error_count = 0;
                    last_progress_warning_count = 0;
                    emit_progress(
                        false,
                        file_path,
                        "clean",
                        0,
                        0,
                        files_processed,
                        total_errors,
                        total_warnings,
                        total_clean,
                        &mut last_emit_time,
                    );
                }
            }
        }

        if files_processed > 0 {
            emit_progress(
                true,
                &last_progress_file_path,
                &last_progress_status,
                last_progress_error_count,
                last_progress_warning_count,
                files_processed,
                total_errors,
                total_warnings,
                total_clean,
                &mut last_emit_time,
            );
        }

        ScanSummary {
            folder_path: folder_path_clone,
            file_pattern: file_pattern_clone,
            total_files,
            error_files,
            warning_files,
            clean_files,
            total_errors,
            total_warnings,
            files: file_results,
            cancelled,
        }
    })
    .await
    .map_err(|e| format!("Scan task failed: {}", e))?;

    // Clean up active listing
    if let Ok(mut listings) = explorer_state.active_listings.lock() {
        listings.remove(&op_id_cleanup);
    }

    Ok(result)
}

#[tauri::command]
pub fn cancel_scan_cmd(
    operation_id: String,
    explorer_state: State<'_, ExplorerState>,
) -> Result<(), String> {
    let listings = explorer_state
        .active_listings
        .lock()
        .map_err(|e| e.to_string())?;

    if let Some(token) = listings.get(&operation_id) {
        token.cancel();
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_search_terms_basic() {
        let result = parse_search_terms("foo bar");
        assert_eq!(result, vec!["foo", "bar"]);
    }

    #[test]
    fn test_parse_search_terms_quoted() {
        let result = parse_search_terms(r#"foo "bar baz" qux"#);
        assert_eq!(result, vec!["foo", "bar baz", "qux"]);
    }

    #[test]
    fn test_parse_search_terms_empty() {
        let result = parse_search_terms("");
        assert!(result.is_empty());
    }

    #[test]
    fn test_parse_search_terms_unclosed_quote() {
        let result = parse_search_terms(r#"foo "bar baz"#);
        assert_eq!(result, vec!["foo", "bar baz"]);
    }

    #[test]
    fn test_parse_search_terms_empty_quotes() {
        let result = parse_search_terms(r#"foo "" bar"#);
        assert_eq!(result, vec!["foo", "bar"]);
    }

    #[test]
    fn test_parse_search_terms_case_normalization() {
        let result = parse_search_terms("FOO Bar BAZ");
        assert_eq!(result, vec!["foo", "bar", "baz"]);
    }

    #[test]
    fn test_parse_search_terms_consecutive_spaces() {
        let result = parse_search_terms("  foo   bar  ");
        assert_eq!(result, vec!["foo", "bar"]);
    }

    #[test]
    fn test_search_summary_result_serialization() {
        let summary = SearchSummaryResult {
            query: "test query".to_string(),
            scope_label: "All Sources".to_string(),
            file_pattern: "*.xml".to_string(),
            total_files_scanned: 100,
            total_files_matched: 5,
            total_matches: 12,
            cancelled: false,
        };

        let json = serde_json::to_value(&summary).unwrap();
        assert_eq!(json["query"], "test query");
        assert_eq!(json["scopeLabel"], "All Sources");
        assert_eq!(json["filePattern"], "*.xml");
        assert_eq!(json["totalFilesScanned"], 100);
        assert_eq!(json["totalFilesMatched"], 5);
        assert_eq!(json["totalMatches"], 12);
        assert_eq!(json["cancelled"], false);
    }

    #[test]
    fn test_search_file_line_by_line_requires_all_terms_and_counts() {
        let temp_dir = tempfile::tempdir().unwrap();
        let file_path = temp_dir.path().join("sample.xml");
        std::fs::write(&file_path, "Alpha beta\nbeta gamma\nalpha beta\n").unwrap();

        let terms = vec!["alpha".to_string(), "beta".to_string()];
        let result = search_file_line_by_line(&file_path, &terms).unwrap();
        assert_eq!(result, Some(5));

        let missing_terms = vec!["alpha".to_string(), "delta".to_string()];
        let missing = search_file_line_by_line(&file_path, &missing_terms).unwrap();
        assert_eq!(missing, None);
    }

    #[test]
    fn test_validate_file_for_scan_utf8_fast_path_matches_existing_validation() {
        let temp_dir = tempfile::tempdir().unwrap();
        let file_path = temp_dir.path().join("bad.xml");
        let content = "line1\nline2\u{0000}\n";
        std::fs::write(&file_path, content).unwrap();

        let result = validate_file_for_scan(&file_path, temp_dir.path().to_str().unwrap())
            .unwrap()
            .unwrap();
        let expected = validate_characters(content, false, "UTF-8", false);

        assert_eq!(result.status, "error");
        assert_eq!(result.encoding, "UTF-8");
        assert_eq!(result.has_bom, false);
        assert_eq!(result.problems, expected);
    }

    #[test]
    fn test_glob_pattern_matching() {
        let xml_pattern = Pattern::new("*.xml").unwrap();
        assert!(xml_pattern.matches("file.xml"));
        assert!(!xml_pattern.matches("file.txt"));
        // Note: in bulk_scan_cmd we match against filename only (e.file_name()),
        // so path separators in the input are not a concern in practice.
        // The glob crate's * does match path separators by default.
        assert!(xml_pattern.matches("subdir/file.xml"));

        let dat_pattern = Pattern::new("*.dat").unwrap();
        assert!(dat_pattern.matches("file.dat"));
        assert!(!dat_pattern.matches("file.xml"));

        // Invalid pattern should return Err
        assert!(Pattern::new("[invalid").is_err());
    }

    #[test]
    fn test_scan_summary_serialization() {
        let summary = ScanSummary {
            folder_path: "/test/path".to_string(),
            file_pattern: "*.xml".to_string(),
            total_files: 2,
            error_files: 1,
            warning_files: 0,
            clean_files: 1,
            total_errors: 3,
            total_warnings: 0,
            files: vec![
                ScanFileResult {
                    file_path: "/test/path/bad.xml".to_string(),
                    file_name: "bad.xml".to_string(),
                    relative_path: "bad.xml".to_string(),
                    status: "error".to_string(),
                    problems: vec![ValidationProblem {
                        line: 1,
                        column: 5,
                        end_column: 6,
                        message: "Null byte (0x00) detected".to_string(),
                        severity: "error".to_string(),
                        code: "null-byte".to_string(),
                    }],
                    encoding: "UTF-8".to_string(),
                    has_bom: false,
                },
                ScanFileResult {
                    file_path: "/test/path/good.xml".to_string(),
                    file_name: "good.xml".to_string(),
                    relative_path: "good.xml".to_string(),
                    status: "clean".to_string(),
                    problems: vec![],
                    encoding: "UTF-8".to_string(),
                    has_bom: false,
                },
            ],
            cancelled: false,
        };

        let json = serde_json::to_value(&summary).unwrap();
        assert_eq!(json["folderPath"], "/test/path");
        assert_eq!(json["filePattern"], "*.xml");
        assert_eq!(json["totalFiles"], 2);
        assert_eq!(json["errorFiles"], 1);
        assert_eq!(json["cleanFiles"], 1);
        assert_eq!(json["cancelled"], false);
        assert_eq!(json["totalErrors"], 3);
        assert_eq!(json["totalWarnings"], 0);
        assert!(json["files"].is_array());
        assert_eq!(json["files"].as_array().unwrap().len(), 2);
        // Verify camelCase on nested ScanFileResult
        assert_eq!(json["files"][0]["filePath"], "/test/path/bad.xml");
        assert_eq!(json["files"][0]["relativePath"], "bad.xml");
        assert_eq!(json["files"][0]["hasBom"], false);
    }

    #[test]
    fn test_scan_progress_payload_clone() {
        let payload = ScanProgressPayload {
            operation_id: "test-op-id".to_string(),
            file_path: "/test/file.xml".to_string(),
            file_name: "file.xml".to_string(),
            status: "error".to_string(),
            error_count: 2,
            warning_count: 1,
            files_processed: 5,
            total_files: Some(10),
            total_errors: 8,
            total_warnings: 3,
            total_clean: 2,
        };

        let cloned = payload.clone();
        assert_eq!(payload.file_path, cloned.file_path);
        assert_eq!(payload.file_name, cloned.file_name);
        assert_eq!(payload.status, cloned.status);
        assert_eq!(payload.error_count, cloned.error_count);
        assert_eq!(payload.warning_count, cloned.warning_count);
        assert_eq!(payload.files_processed, cloned.files_processed);
        assert_eq!(payload.total_files, cloned.total_files);
        assert_eq!(payload.total_errors, cloned.total_errors);
        assert_eq!(payload.total_warnings, cloned.total_warnings);
        assert_eq!(payload.total_clean, cloned.total_clean);
    }
}
