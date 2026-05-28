use crate::state::{AppSettings, AppState};
use crate::validation::{detect_and_decode, validate_characters};
use crate::validation::validator::ValidationProblem;
use glob::Pattern;
use serde::Serialize;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};
use tokio_util::sync::CancellationToken;
use walkdir::WalkDir;

/// Maximum file size to read during bulk scan (50 MB).
/// Files larger than this are silently skipped to prevent unbounded memory consumption.
const MAX_SCAN_FILE_SIZE: u64 = 50 * 1024 * 1024;

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

// -- Bulk scan types and commands --

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanProgressPayload {
    pub file_path: String,
    pub file_name: String,
    pub status: String,
    pub error_count: u32,
    pub warning_count: u32,
    pub files_processed: u32,
    pub total_files: u32,
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
    let folder_path_clone = folder_path.clone();
    let file_pattern_clone = file_pattern.clone();

    let result = tokio::task::spawn_blocking(move || {
        // Phase 1: Collect matching files
        let matching_files: Vec<PathBuf> = WalkDir::new(&folder_path_clone)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| !e.file_type().is_dir())
            .filter(|e| {
                e.file_name()
                    .to_str()
                    .map(|n| pattern.matches(n))
                    .unwrap_or(false)
            })
            .map(|e| e.into_path())
            .collect();

        let total_files = matching_files.len().min(u32::MAX as usize) as u32;
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

        // Phase 2: Validate each file
        for (idx, file_path) in matching_files.iter().enumerate() {
            if token_clone.is_cancelled() {
                cancelled = true;
                break;
            }

            let file_name = file_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("")
                .to_string();

            let relative_path = file_path
                .strip_prefix(&folder_path_clone)
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|_| file_path.to_string_lossy().to_string());

            // Skip files that exceed the size limit to prevent excessive memory use
            match std::fs::metadata(file_path) {
                Ok(m) if m.len() > MAX_SCAN_FILE_SIZE => {
                    files_processed += 1;
                    continue;
                }
                Err(_) => {
                    files_processed += 1;
                    continue;
                }
                _ => {}
            }

            // Try to read and validate the file
            let raw_bytes = match std::fs::read(file_path) {
                Ok(bytes) => bytes,
                Err(_) => {
                    // Skip unreadable files
                    files_processed += 1;
                    continue;
                }
            };

            let decode_result = detect_and_decode(&raw_bytes);
            let problems = validate_characters(
                &decode_result.content,
                decode_result.had_errors,
                &decode_result.encoding_name,
                decode_result.has_bom,
            );

            let file_error_count = problems.iter().filter(|p| p.severity == "error").count().min(u32::MAX as usize) as u32;
            let file_warning_count = problems.iter().filter(|p| p.severity == "warning").count().min(u32::MAX as usize) as u32;

            let status = if file_error_count > 0 {
                "error"
            } else if file_warning_count > 0 {
                "warning"
            } else {
                "clean"
            };

            total_errors = total_errors.saturating_add(file_error_count);
            total_warnings = total_warnings.saturating_add(file_warning_count);
            match status {
                "error" => error_files = error_files.saturating_add(1),
                "warning" => warning_files = warning_files.saturating_add(1),
                _ => {
                    total_clean = total_clean.saturating_add(1);
                    clean_files = clean_files.saturating_add(1);
                }
            }

            files_processed = files_processed.saturating_add(1);

            file_results.push(ScanFileResult {
                file_path: file_path.to_string_lossy().to_string(),
                file_name: file_name.clone(),
                relative_path,
                status: status.to_string(),
                problems,
                encoding: decode_result.encoding_name,
                has_bom: decode_result.has_bom,
            });

            // Throttle event emission: emit at most every 50ms, or on last file
            let is_last = idx == matching_files.len() - 1;
            let elapsed = last_emit_time.elapsed();
            if elapsed >= Duration::from_millis(50) || is_last {
                let payload = ScanProgressPayload {
                    file_path: file_path.to_string_lossy().to_string(),
                    file_name,
                    status: status.to_string(),
                    error_count: file_error_count,
                    warning_count: file_warning_count,
                    files_processed,
                    total_files,
                    total_errors,
                    total_warnings,
                    total_clean,
                };
                let _ = app.emit("scan-progress", payload);
                last_emit_time = std::time::Instant::now();
            }
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
        listings.remove(&op_id);
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
            file_path: "/test/file.xml".to_string(),
            file_name: "file.xml".to_string(),
            status: "error".to_string(),
            error_count: 2,
            warning_count: 1,
            files_processed: 5,
            total_files: 10,
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
