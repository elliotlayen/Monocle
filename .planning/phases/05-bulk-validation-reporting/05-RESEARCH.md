# Phase 5: Bulk Validation & Reporting - Research

**Researched:** 2026-05-27
**Domain:** Recursive filesystem traversal, Tauri event streaming, report generation and export
**Confidence:** HIGH

## Summary

Phase 5 extends the existing single-file validation engine to process entire folder trees in one action. The core technical challenge is orchestrating a recursive directory walk in Rust's `spawn_blocking` context, validating each matching file with the existing `validate_characters` + `detect_and_decode` pipeline, and streaming per-file progress events to the React frontend via Tauri's `Emitter` trait. The results surface as a dedicated tab in the content area with sortable/filterable file list, expandable problem details, and export to CSV/PDF/JSON/clipboard.

No new validation logic is needed -- the existing `validator.rs` and `encoding.rs` modules are called per-file unchanged. The new Rust work is a `bulk_scan_cmd` command that recursively walks directories, applies a configurable file pattern filter, checks cancellation between files, and emits progress events. The new frontend work is scan state management in the explorer store, a progress panel, a results tab, aggregate folder badges, and four export formatters.

**Primary recommendation:** Use `walkdir` crate for recursive traversal (already a transitive dependency, well-established), `glob` crate for file pattern matching, and the existing `CancellationToken` + `spawn_blocking` pattern from `list_directory_cmd`. Stream progress via `app.emit("scan-progress", payload)` using Tauri 2's `Emitter` trait. Export via existing `jsPDF`, `exportService`, and `writeText` (clipboard) patterns.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Scan Trigger & Scope:**
- D-01: Two entry points: right-click context menu "Scan for issues" on folder nodes, and a toolbar button for the selected folder.
- D-02: Available on any folder node. Recursive walk of all subdirectories. No artificial scope restrictions.
- D-03: File filter configurable. Default `*.xml`, user can specify custom pattern before scan.
- D-04: One scan at a time. Starting new scan prompts to cancel current one first.

**Tree Badges:**
- D-05: Bulk scan populates validation badges on all scanned files (red/yellow dots matching Phase 4 D-14).
- D-06: Parent folder nodes get aggregate badges -- worst severity of children (red > yellow > none).
- D-07: Generic folder hierarchy (Phase 04.1 removed hardcoded levels). Walk whatever structure exists.

**Progress & Streaming:**
- D-08: Per-file progress events with file name, validation result, and running totals.
- D-09: Tauri events via `app_handle.emit`. Frontend listens via `@tauri-apps/api/event`.
- D-10: Inline progress panel showing: progress bar, file count ("45 of 200 files (23%)"), current file name, running error/warning totals, cancel button.
- D-11: No ETA calculation. Counts and percentage only.

**Results Display:**
- D-12: Scan results open as a dedicated tab in content area. Session-only, not persisted.
- D-13: File list with expandable rows. Summary stats at top. Sortable columns.
- D-14: All scanned files appear including clean (green checkmark). Filterable to issues only.
- D-15: Clicking file in results opens it as regular file tab with Phase 4 behavior.

**Report Export:**
- D-16: Export dropdown in scan results tab header. Only visible when results displayed.
- D-17: CSV: one row per problem. Columns: File Path, Line, Column, Severity, Issue Code, Description, Encoding.
- D-18: PDF: summary section + file-by-file detail. Uses existing jsPDF pattern.
- D-19: JSON: structured object with metadata + file results array.
- D-20: Clipboard: plain text summary AND markdown table as separate dropdown items.
- D-21: All formats include metadata: folder path, file pattern, date/time, totals.

### Claude's Discretion
None specified.

### Deferred Ideas (OUT OF SCOPE)
None.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VALD-05 | User can run a bulk validation scan on an entire folder/client with progress streaming and cancellation | Rust `bulk_scan_cmd` with `walkdir` + `CancellationToken` + `app.emit()` for progress; frontend listens via `createEventHub` pattern; cancel via `cancel_scan_cmd` |
| VALD-06 | User can export scan reports in CSV, PDF, JSON, and clipboard text formats | CSV string generation, jsPDF adaptation from `pdf-export.ts`, JSON.stringify with metadata, `writeText` clipboard via `@tauri-apps/plugin-clipboard-manager` |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Recursive directory traversal | Backend (Rust) | -- | Filesystem I/O must go through Rust for UNC path safety and `spawn_blocking` pattern |
| File pattern matching | Backend (Rust) | -- | Pattern applied during traversal in Rust, before file reading |
| Per-file validation | Backend (Rust) | -- | Existing `validate_characters` + `detect_and_decode` pipeline in Rust |
| Scan progress streaming | Backend (Rust) | Frontend (React) | Rust emits events, React listens and updates store |
| Scan cancellation | Backend (Rust) | Frontend (React) | `CancellationToken` in Rust, cancel button triggers `cancel_scan_cmd` from frontend |
| Progress UI | Frontend (React) | -- | Progress panel is a React component reading from Zustand store |
| Scan results display | Frontend (React) | -- | Results tab with sortable table, expandable rows, summary stats |
| Tree badge aggregation | Frontend (React) | -- | Computed from validation cache in store; aggregate badges propagated in render logic |
| Report generation (CSV/JSON/clipboard) | Frontend (React) | -- | String formatting from in-memory scan results |
| Report generation (PDF) | Frontend (React) | -- | jsPDF runs in browser context, same as existing schema PDF export |
| File save dialog | Frontend (React) | Backend (Tauri plugin) | `@tauri-apps/plugin-dialog` save + `@tauri-apps/plugin-fs` write |

## Standard Stack

### Core (Already in Project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `encoding_rs` | 0.8 | Encoding detection + transcoding per file | Already used in Phase 4 `detect_and_decode` [VERIFIED: Cargo.toml] |
| `chardetng` | 1.0 | Encoding detection fallback | Already used in Phase 4 encoding pipeline [VERIFIED: Cargo.toml] |
| `tokio` | 1.x | Async runtime, `spawn_blocking`, timeouts | Already used for all async commands [VERIFIED: Cargo.toml] |
| `tokio_util` | 0.7 | `CancellationToken` for scan cancellation | Already used in `list_directory_cmd` [VERIFIED: Cargo.toml] |
| `tauri` | 2.x | `Emitter` trait for `app.emit()`, `AppHandle` | Already used, `Emitter` trait available via `use tauri::Emitter` [CITED: v2.tauri.app/develop/calling-frontend/] |
| `jspdf` | 4.x | PDF report generation | Already used in `pdf-export.ts` [VERIFIED: package.json v4.0.0] |
| `zustand` | 5.x | Scan state management (progress, results, badges) | Already used for explorer store [VERIFIED: package.json v5.0.9] |
| `@tauri-apps/api` | 2.x | `listen()` for Tauri events on frontend | Already used in `events.ts` [VERIFIED: package.json v2.9.1] |
| `@tauri-apps/plugin-clipboard-manager` | 2.x | Clipboard write for text/markdown export | Already used in `use-file-actions.ts` [VERIFIED: package.json v2.3.2] |
| `@tauri-apps/plugin-dialog` | 2.x | Save file dialog for CSV/PDF/JSON export | Already used in `export-service.ts` [VERIFIED: package.json v2.6.0] |
| `@tauri-apps/plugin-fs` | 2.x | File write for export | Already used in `export-service.ts` [VERIFIED: package.json v2.4.5] |

### New Dependencies

| Library | Version | Purpose | Why Needed |
|---------|---------|---------|------------|
| `walkdir` | 2.5 | Recursive directory traversal | Standard Rust crate for recursive walks. Cross-platform, handles symlinks, controllable depth. Already a transitive dependency via `tauri-build`. [ASSUMED] |
| `glob` | 0.3.3 | File pattern matching (`*.xml`, `*.dat`) | Rust standard library for Unix-style glob patterns. Matches D-03 configurable filter. [ASSUMED] |
| `@radix-ui/react-progress` | latest | shadcn/ui Progress component | Needed for progress bar in scan panel. Not currently in project but follows shadcn pattern. [CITED: ui.shadcn.com/docs/components/radix/progress] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `walkdir` | Manual `std::fs::read_dir` recursion | walkdir handles edge cases (symlinks, permission errors, depth limits) that manual recursion misses. walkdir is the ecosystem standard. |
| `glob` | `globset` | globset is more powerful (multi-pattern matching) but overkill for single-pattern file filtering. `glob` is simpler and sufficient. |
| `glob` | Manual string matching | Glob patterns (`*.xml`) need proper wildcard expansion. Hand-rolling is error-prone with edge cases like `*.*`, `*.{xml,dat}`. |
| jsPDF | Server-side PDF | jsPDF already established in project. No backend PDF generation needed. |

**Installation:**

Rust (add to `src-tauri/Cargo.toml`):
```toml
walkdir = "2.5"
glob = "0.3"
```

Frontend (add shadcn progress component):
```bash
npx shadcn@latest add progress
```

**Version verification:**
- `walkdir` 2.5.0 confirmed via `cargo search` [VERIFIED: crates.io]
- `glob` 0.3.3 confirmed via `cargo search` [VERIFIED: crates.io]
- `@radix-ui/react-progress` is the underlying package for shadcn/ui Progress [CITED: ui.shadcn.com/docs/components/radix/progress]

## Package Legitimacy Audit

> slopcheck was not available at research time. All new packages are tagged `[ASSUMED]` and the planner must gate each install behind a `checkpoint:human-verify` task.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `walkdir` | crates.io | ~10 yrs | Very high | github.com/BurntSushi/walkdir | N/A | [ASSUMED] - well-known crate by BurntSushi (ripgrep author), already transitive dep |
| `glob` | crates.io | ~10 yrs | Very high | github.com/rust-lang/glob | N/A | [ASSUMED] - rust-lang org official crate |
| `@radix-ui/react-progress` | npm | ~4 yrs | High | github.com/radix-ui/primitives | N/A | [ASSUMED] - Radix UI official package, same org as other project deps |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*slopcheck was unavailable at research time. All packages above are tagged `[ASSUMED]` and the planner must gate each install behind a `checkpoint:human-verify` task.*

## Architecture Patterns

### System Architecture Diagram

```
User Action (right-click folder / toolbar button)
    |
    v
[Frontend: Explorer Store]
    |-- Calls tauri.bulkScan(folderPath, filePattern, operationId)
    |-- Sets scan state to "scanning"
    |
    v
[Rust: bulk_scan_cmd]
    |-- Stores CancellationToken in ExplorerState
    |-- spawn_blocking {
    |       walkdir::WalkDir::new(folder_path)
    |           .into_iter()
    |           .filter_map(|e| e.ok())
    |           .filter(|e| glob_matches(e, pattern))
    |       
    |       For each matching file:
    |           if token.is_cancelled() -> break
    |           std::fs::read(file)
    |           detect_and_decode(raw_bytes)
    |           validate_characters(content, ...)
    |           app.emit("scan-progress", ScanProgressPayload { ... })
    |   }
    |-- Returns ScanSummary on completion
    |
    v
[Frontend: Event Listener]
    |-- createEventHub<ScanProgressPayload>("scan-progress")
    |-- Each event updates store: progress count, current file, running totals
    |-- Store triggers re-render of progress panel
    |
    v
[Frontend: Progress Panel] <-----> [Cancel Button -> tauri.cancelScan(opId)]
    |-- Progress bar + counts + current file
    |
    v (on scan complete)
[Frontend: Scan Results Tab]
    |-- Summary stats (total, errors, warnings, clean)
    |-- Sortable file list with expandable rows
    |-- Export dropdown (CSV, PDF, JSON, Clipboard text, Clipboard markdown)
    |
    v (on file click in results)
[Frontend: Opens file tab] -> Phase 4 behavior (source view + problems panel)
    |
    v (on export)
[Export Formatters]
    |-- CSV: string generation -> exportService.saveTextFile
    |-- PDF: jsPDF generation -> exportService.saveBinaryFile
    |-- JSON: JSON.stringify -> exportService.saveTextFile
    |-- Clipboard: writeText from @tauri-apps/plugin-clipboard-manager
```

### Recommended Project Structure

```
src-tauri/src/
  commands/
    explorer.rs              # Add bulk_scan_cmd, cancel_scan_cmd
  validation/
    mod.rs                   # Existing (unchanged)
    validator.rs             # Existing (unchanged)
    encoding.rs              # Existing (unchanged)

src/features/explorer/
  components/
    scan-progress-panel.tsx  # NEW: progress bar, counts, cancel
    scan-results-tab.tsx     # NEW: results table with expandable rows
    scan-results-header.tsx  # NEW: summary stats + export dropdown
    scan-file-row.tsx        # NEW: expandable file row with problems
  hooks/
    use-scan.ts              # NEW: scan initiation, event listening, cancel
  utils/
    scan-csv-export.ts       # NEW: CSV formatter
    scan-pdf-export.ts       # NEW: PDF formatter (adapts existing pattern)
    scan-json-export.ts      # NEW: JSON formatter
    scan-clipboard-export.ts # NEW: Plain text + markdown formatters
    badge-aggregation.ts     # NEW: Compute aggregate folder badge from children
  types.ts                   # EXTEND: ScanProgress, ScanFileResult, ScanResult
  store.ts                   # EXTEND: scan state, badge cache, aggregate badges
  services/
    explorer-service.ts      # EXTEND: bulkScan, cancelScan methods

src/services/
  tauri.ts                   # EXTEND: bulkScan, cancelScan commands
  events.ts                  # EXTEND: scanProgressHub event hub
```

### Pattern 1: Bulk Scan Command (Rust)

**What:** A Tauri command that recursively walks a directory, validates each matching file, and emits per-file progress events.
**When to use:** When the user triggers a bulk scan action.
**Example:**

```rust
// Source: Adapted from existing list_directory_cmd + validate_characters patterns
use walkdir::WalkDir;
use tauri::{AppHandle, Emitter, State};
use tokio_util::sync::CancellationToken;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanProgressPayload {
    pub file_path: String,
    pub file_name: String,
    pub status: String,           // "clean" | "error" | "warning"
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
    let cancel_token = CancellationToken::new();
    let token_clone = cancel_token.clone();

    // Store token for cancellation
    {
        let mut listings = explorer_state.active_listings.lock()
            .map_err(|e| e.to_string())?;
        listings.insert(operation_id.clone(), cancel_token);
    }

    let result = tokio::task::spawn_blocking(move || {
        // Phase 1: Collect matching file paths
        let pattern = glob::Pattern::new(&file_pattern)
            .map_err(|e| format!("Invalid pattern: {}", e))?;

        let mut file_paths: Vec<_> = WalkDir::new(&folder_path)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| !e.file_type().is_dir())
            .filter(|e| {
                e.file_name().to_str()
                    .map(|name| pattern.matches(name))
                    .unwrap_or(false)
            })
            .map(|e| e.into_path())
            .collect();

        let total_files = file_paths.len() as u32;

        // Phase 2: Validate each file
        let mut files = Vec::new();
        let mut total_errors: u32 = 0;
        let mut total_warnings: u32 = 0;
        let mut total_clean: u32 = 0;

        for (i, path) in file_paths.iter().enumerate() {
            if token_clone.is_cancelled() {
                return Ok(ScanSummary {
                    folder_path: folder_path.clone(),
                    file_pattern,
                    total_files: i as u32,
                    // ... populate with partial results
                    cancelled: true,
                    files,
                    // ...
                });
            }

            let raw_bytes = match std::fs::read(path) {
                Ok(bytes) => bytes,
                Err(_) => continue, // Skip unreadable files
            };

            let decode_result = detect_and_decode(&raw_bytes);
            let problems = validate_characters(
                &decode_result.content,
                decode_result.had_errors,
                &decode_result.encoding_name,
                decode_result.has_bom,
            );

            let file_errors = problems.iter()
                .filter(|p| p.severity == "error").count() as u32;
            let file_warnings = problems.iter()
                .filter(|p| p.severity == "warning").count() as u32;

            let status = if file_errors > 0 { "error" }
                else if file_warnings > 0 { "warning" }
                else { "clean" };

            match status {
                "error" => { total_errors += file_errors; total_warnings += file_warnings; }
                "warning" => { total_warnings += file_warnings; total_clean += 0; }
                _ => { total_clean += 1; }
            };

            // Emit progress event
            let _ = app.emit("scan-progress", ScanProgressPayload {
                file_path: path.to_string_lossy().to_string(),
                file_name: path.file_name().unwrap_or_default()
                    .to_string_lossy().to_string(),
                status: status.to_string(),
                error_count: file_errors,
                warning_count: file_warnings,
                files_processed: (i + 1) as u32,
                total_files,
                total_errors,
                total_warnings,
                total_clean,
            });

            // ... build ScanFileResult and push to files vec
        }

        Ok(ScanSummary { /* ... */ })
    }).await
    .map_err(|e| format!("Scan task failed: {}", e))?;

    // Clean up operation
    if let Ok(mut listings) = explorer_state.active_listings.lock() {
        listings.remove(&operation_id);
    }

    result
}
```

### Pattern 2: Frontend Event Listening (React)

**What:** Subscribe to scan progress events and update store.
**When to use:** When a scan is in progress.
**Example:**

```typescript
// Source: Adapted from existing createEventHub pattern in events.ts
import { createEventHub } from "@/services/events";

export interface ScanProgressPayload {
  filePath: string;
  fileName: string;
  status: "clean" | "error" | "warning";
  errorCount: number;
  warningCount: number;
  filesProcessed: number;
  totalFiles: number;
  totalErrors: number;
  totalWarnings: number;
  totalClean: number;
}

export const scanProgressHub = createEventHub<ScanProgressPayload>("scan-progress");

// In the scan hook:
function useScan() {
  const updateScanProgress = useExplorerStore(s => s.updateScanProgress);

  useTauriEvent(scanProgressHub.subscribe, useCallback((payload) => {
    updateScanProgress(payload);
  }, [updateScanProgress]));
}
```

### Pattern 3: Aggregate Badge Computation

**What:** Compute folder badges by propagating worst severity from children upward.
**When to use:** After bulk scan completes, or when validation cache updates.
**Example:**

```typescript
// Source: Application-specific pattern
function computeAggregateBadge(
  folderPath: string,
  validationCache: Map<string, { problems: ValidationProblem[] }>
): ValidationStatus | undefined {
  let worstSeverity: ValidationStatus | undefined;

  for (const [filePath, cached] of validationCache) {
    if (!filePath.startsWith(folderPath)) continue;

    if (cached.problems.some(p => p.severity === "error")) {
      return "error"; // Short-circuit: worst possible
    }
    if (cached.problems.some(p => p.severity === "warning")) {
      worstSeverity = "warning";
    }
    if (!worstSeverity) {
      worstSeverity = "clean";
    }
  }

  return worstSeverity;
}
```

### Pattern 4: CSV Export Formatter

**What:** Generate CSV string from scan results.
**When to use:** D-17 CSV export.
**Example:**

```typescript
// Source: Application-specific, follows D-17 spec
function exportScanToCsv(result: ScanResult): string {
  const header = "File Path,Line,Column,Severity,Issue Code,Description,Encoding";
  const rows: string[] = [header];

  for (const file of result.files) {
    if (file.problems.length === 0) {
      rows.push(`"${escapeCsv(file.filePath)}",,,Clean,,,${file.encoding}`);
    } else {
      for (const problem of file.problems) {
        rows.push(
          `"${escapeCsv(file.filePath)}",${problem.line},${problem.column},` +
          `${problem.severity},"${escapeCsv(problem.code)}",` +
          `"${escapeCsv(problem.message)}",${file.encoding}`
        );
      }
    }
  }

  return rows.join("\n");
}

function escapeCsv(value: string): string {
  return value.replace(/"/g, '""');
}
```

### Anti-Patterns to Avoid

- **Reading file content in the frontend:** All file I/O must go through Rust commands. Never use `@tauri-apps/plugin-fs` `readFile` for validation -- the validation pipeline is Rust-only.
- **Blocking the main thread with large result sets:** Scan results can be large (thousands of files). The Rust command returns the full `ScanSummary` at the end; progress events stream individual updates. Do not try to accumulate all results in events -- use events for progress, command return for final data.
- **Re-implementing validation logic:** Do not duplicate `validate_characters` or `detect_and_decode` in the frontend. Always call the Rust pipeline.
- **Polling for progress:** Use Tauri's event system, not periodic polling. The `createEventHub` pattern is already established.
- **Storing scan results in persistent state:** D-12 specifies session-only results. Do not persist to settings.json or localStorage.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Recursive directory traversal | Manual `std::fs::read_dir` with recursion | `walkdir` crate | Handles symlinks, permission errors, depth limits, cross-platform edge cases |
| Glob pattern matching | String `contains` / regex | `glob::Pattern` | Proper wildcard expansion (`*`, `?`, `[...]`), cross-platform path handling |
| PDF generation | Manual canvas/HTML-to-PDF | `jsPDF` (already in project) | Page breaks, fonts, layout -- extensive edge cases |
| CSV escaping | Manual string replacement | Proper CSV formatter with quoting | CSV spec has edge cases: commas in values, quotes in values, newlines in values |
| Progress bar UI | Custom div with percentage width | shadcn/ui `Progress` component | Accessibility (ARIA), animation, theme integration |

**Key insight:** The validation pipeline is already built (Phase 4). This phase is purely orchestration -- walking files, streaming progress, displaying aggregate results, and formatting exports. None of those are novel problems; they all have standard solutions.

## Common Pitfalls

### Pitfall 1: Emitting Events from spawn_blocking Context

**What goes wrong:** `app.emit()` requires the `AppHandle` which must be moved into the `spawn_blocking` closure. If you clone it incorrectly or try to use it across thread boundaries improperly, you get compile errors.
**Why it happens:** `AppHandle` implements `Clone` and `Send`, but you must clone it before moving into the closure.
**How to avoid:** Clone the `AppHandle` before calling `spawn_blocking`, move the clone into the closure. The command parameter `app: AppHandle` already gives you an owned handle.
**Warning signs:** Compiler errors about `Send` or lifetime issues on the `app` parameter.

### Pitfall 2: Large Directory Tree Causing Memory Pressure

**What goes wrong:** Collecting all file paths before validation (two-pass approach) could use significant memory with extremely large trees (100K+ files).
**Why it happens:** `walkdir` collects into a `Vec` before iterating.
**How to avoid:** Use a two-pass approach intentionally: first collect paths to get `total_files` count (needed for progress percentage), then validate. For extremely large trees, the path list is small (just `PathBuf` strings). The memory concern is from holding all `ScanFileResult` objects at once -- consider streaming results to frontend rather than accumulating all in memory, but the command return value needs the full list for the results tab. At typical scale (thousands, not millions) this is fine.
**Warning signs:** If testing with very large directories causes high memory usage.

### Pitfall 3: UNC Path Handling on Windows

**What goes wrong:** `walkdir` may have issues with UNC paths (`\\server\share\...`) on Windows, similar to `tokio::fs::read_dir`.
**Why it happens:** The existing `list_directory_cmd` already uses `std::fs::read_dir` in `spawn_blocking` to work around tokio UNC path issues. `walkdir` uses `std::fs` internally, so it should work, but needs testing.
**How to avoid:** `walkdir` uses `std::fs::read_dir` internally (not tokio), so it should be compatible with the existing workaround pattern. Run the scan in `spawn_blocking` which is already the plan.
**Warning signs:** Hangs or errors when scanning UNC paths on Windows.

### Pitfall 4: Event Flooding with Rapid File Processing

**What goes wrong:** If files are small and validation is fast, events may fire faster than the React renderer can process them, causing UI lag or dropped updates.
**Why it happens:** Local SSD performance can validate thousands of small XML files per second.
**How to avoid:** Batch progress updates -- instead of emitting after every single file, emit every N files or every M milliseconds. A simple approach: emit every file but throttle store updates on the frontend (e.g., `requestAnimationFrame` batching in the store update handler).
**Warning signs:** UI becomes sluggish during scan, progress counter jumps in large increments.

### Pitfall 5: Scan Results Tab Conflicting with File Tabs

**What goes wrong:** The scan results tab needs a unique ID that doesn't collide with file path-based tab IDs.
**Why it happens:** Existing tabs use `filePath` as the ID. A scan results "tab" is not a file -- it needs a synthetic ID.
**How to avoid:** Use a prefix like `scan:` for scan result tab IDs (e.g., `scan:operation-uuid`). The tab bar and content area need to handle this non-file tab type.
**Warning signs:** Tab switching breaks, content area tries to render file content for scan tab.

### Pitfall 6: Badge Propagation Performance

**What goes wrong:** Computing aggregate folder badges by iterating the entire validation cache for every folder node in the tree is O(files * folders) on each render.
**Why it happens:** Naive implementation checks every cached path against every visible folder.
**How to avoid:** Pre-compute a `folderBadgeCache: Map<string, ValidationStatus>` in the store when scan completes. Update it once after the scan, not on every render. Use the scan results (which are already grouped by file path) to build the cache efficiently.
**Warning signs:** Tree sidebar becomes slow to render after a large scan.

## Code Examples

### Tauri Event Emission from Rust

```rust
// Source: https://v2.tauri.app/develop/calling-frontend/
use tauri::{AppHandle, Emitter};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ScanProgressPayload {
    files_processed: u32,
    total_files: u32,
    current_file: String,
    // ...
}

// Inside spawn_blocking closure:
let _ = app.emit("scan-progress", ScanProgressPayload {
    files_processed: count,
    total_files: total,
    current_file: filename,
});
```

### Frontend Event Hub Registration

```typescript
// Source: Adapted from existing src/services/events.ts pattern
export const scanProgressHub = createEventHub<ScanProgressPayload>("scan-progress");
```

### Existing Export Service Pattern

```typescript
// Source: src/features/export/services/export-service.ts (verified in codebase)
// For CSV/JSON text export:
await exportService.saveTextFile(csvString, {
  filename: `scan-report-${date}.csv`,
  filters: [{ name: "CSV", extensions: ["csv"] }],
});

// For PDF binary export:
await exportService.saveBinaryFile(pdfBytes, {
  filename: `scan-report-${date}.pdf`,
  filters: [{ name: "PDF", extensions: ["pdf"] }],
});

// For clipboard:
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
await writeText(formattedText);
```

### Extending the Explorer Store

```typescript
// Source: Application-specific, extending existing store.ts pattern
interface ScanState {
  scanStatus: "idle" | "scanning" | "completed" | "cancelled";
  scanOperationId: string | null;
  scanFolderPath: string | null;
  scanFilePattern: string;
  scanProgress: {
    filesProcessed: number;
    totalFiles: number;
    currentFile: string;
    totalErrors: number;
    totalWarnings: number;
    totalClean: number;
  } | null;
  scanResult: ScanResult | null;
  folderBadgeCache: Map<string, ValidationStatus>;
}
```

### WalkDir Usage with Glob Filtering

```rust
// Source: https://docs.rs/walkdir/latest/walkdir/ + https://docs.rs/glob/latest/glob/
use walkdir::WalkDir;
use glob::Pattern;

let pattern = Pattern::new("*.xml").unwrap();

let files: Vec<_> = WalkDir::new("/path/to/scan")
    .into_iter()
    .filter_map(|e| e.ok())
    .filter(|e| !e.file_type().is_dir())
    .filter(|e| {
        e.file_name().to_str()
            .map(|name| pattern.matches(name))
            .unwrap_or(false)
    })
    .collect();
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Tauri 1 `app.emit_all()` | Tauri 2 `app.emit()` (via `Emitter` trait) | Tauri 2.0 | Must `use tauri::Emitter` explicitly; method renamed from `emit_all` to `emit` |
| Tauri 1 `listen` from `tauri::event` | Tauri 2 `listen` from `@tauri-apps/api/event` | Tauri 2.0 | Already using correct import in `events.ts` |
| jsPDF 2.x | jsPDF 4.x | 2024 | Project already on v4; API largely stable |

**Deprecated/outdated:**
- `app.emit_all()`: Replaced by `app.emit()` in Tauri 2. The `Emitter` trait must be imported explicitly with `use tauri::Emitter`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `walkdir` crate is safe and appropriate for this use case | Standard Stack | LOW -- extremely well-established crate (BurntSushi), transitive dep already in Cargo.lock. If wrong, fall back to manual `std::fs` recursion. |
| A2 | `glob` crate is safe and appropriate for pattern matching | Standard Stack | LOW -- official rust-lang org crate. If wrong, can use `globset` or simple string matching. |
| A3 | `@radix-ui/react-progress` is the correct underlying package for shadcn Progress | Standard Stack | LOW -- shadcn docs reference Radix primitives directly. If wrong, just build a simple progress bar with Tailwind. |
| A4 | `walkdir` handles UNC paths on Windows without hanging | Pitfalls | MEDIUM -- walkdir uses `std::fs` internally (same as existing working code), but untested with UNC paths in this project. Needs real-world validation. |
| A5 | Tauri `app.emit()` can be called from within `spawn_blocking` closure | Architecture | LOW -- AppHandle is Clone + Send, should work in blocking thread. Already confirmed by Tauri docs showing it used in commands. |

## Open Questions (RESOLVED)

1. **Event throttling strategy for fast scans** (RESOLVED: 50ms throttle implemented in bulk_scan_cmd)
   - What we know: Local SSD scans could process thousands of files/second. Tauri docs note events "directly evaluate JavaScript" and are "not designed for high throughput."
   - What's unclear: Exact threshold where event frequency causes frontend lag.
   - Recommendation: Implement simple throttling (emit at most every 50ms) in the Rust scan loop. Test with a local directory of 1000+ small XML files.

2. **Scan results tab lifecycle** (RESOLVED: old results tab removed when new scan starts)
   - What we know: D-12 says tab persists until user closes it. Session-only.
   - What's unclear: What happens if user starts a new scan while old results tab is open? Should old results tab close automatically?
   - Recommendation: Close previous scan results tab when starting a new scan (since D-04 only allows one scan at a time, keeping old results alongside progress is confusing).

3. **Maximum scan size guardrails** (RESOLVED: two-phase approach shows file count; cancellation always available)
   - What we know: Network shares can have hundreds of thousands of files.
   - What's unclear: Should there be a confirmation dialog for very large scans (e.g., >10,000 files)?
   - Recommendation: Show file count after the initial walkdir pass (before validation starts) and let the user confirm or cancel if count exceeds a threshold. This is a UX enhancement the planner can include.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Rust toolchain | Backend commands | Yes | (project builds) | -- |
| Node.js | Frontend build | Yes | (project builds) | -- |
| `walkdir` crate | Recursive traversal | Transitive dep | 2.5.0 | Manual `std::fs` recursion |
| `glob` crate | File pattern matching | Not direct dep | 0.3.3 | Manual string matching |
| `tauri::Emitter` trait | Event streaming | Yes (Tauri 2) | 2.x | -- |
| `jsPDF` | PDF export | Yes | 4.0.0 | -- |
| `@tauri-apps/plugin-clipboard-manager` | Clipboard export | Yes | 2.3.2 | -- |
| shadcn Progress component | Progress bar UI | Not yet installed | -- | Custom Tailwind div or install via `npx shadcn add progress` |

**Missing dependencies with no fallback:** None
**Missing dependencies with fallback:**
- `glob` crate: Not a direct dependency yet, needs adding to Cargo.toml
- shadcn Progress: Not yet installed, needs `npx shadcn add progress`

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.1 (frontend), built-in `#[cfg(test)]` (Rust) |
| Config file | `vitest.config.ts` (frontend), inline in source files (Rust) |
| Quick run command | `npm run test -- --run` |
| Full suite command | `npm run test && cd src-tauri && cargo test` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VALD-05a | Recursive file collection with glob pattern | unit (Rust) | `cd src-tauri && cargo test bulk_scan` | Wave 0 |
| VALD-05b | Cancellation stops scan mid-progress | unit (Rust) | `cd src-tauri && cargo test cancel_scan` | Wave 0 |
| VALD-05c | Progress event payload structure | unit (Rust) | `cd src-tauri && cargo test scan_progress` | Wave 0 |
| VALD-05d | Store scan state transitions | unit (TS) | `npm run test -- --run src/features/explorer/store-scan.test.ts` | Wave 0 |
| VALD-05e | Aggregate badge computation | unit (TS) | `npm run test -- --run src/features/explorer/utils/badge-aggregation.test.ts` | Wave 0 |
| VALD-06a | CSV export format correctness | unit (TS) | `npm run test -- --run src/features/explorer/utils/scan-csv-export.test.ts` | Wave 0 |
| VALD-06b | JSON export structure | unit (TS) | `npm run test -- --run src/features/explorer/utils/scan-json-export.test.ts` | Wave 0 |
| VALD-06c | Clipboard plain text format | unit (TS) | `npm run test -- --run src/features/explorer/utils/scan-clipboard-export.test.ts` | Wave 0 |
| VALD-06d | Clipboard markdown format | unit (TS) | `npm run test -- --run src/features/explorer/utils/scan-clipboard-export.test.ts` | Wave 0 |
| VALD-06e | PDF generation (smoke) | unit (TS) | `npm run test -- --run src/features/explorer/utils/scan-pdf-export.test.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run test -- --run` (frontend quick) + `cd src-tauri && cargo test` (Rust)
- **Per wave merge:** Full suite: `npm run test && cd src-tauri && cargo test`
- **Phase gate:** Full suite green + `npm run build` + `npm run lint` before verify

### Wave 0 Gaps

- [ ] `src/features/explorer/store-scan.test.ts` -- covers VALD-05d (scan state transitions)
- [ ] `src/features/explorer/utils/badge-aggregation.test.ts` -- covers VALD-05e
- [ ] `src/features/explorer/utils/scan-csv-export.test.ts` -- covers VALD-06a
- [ ] `src/features/explorer/utils/scan-json-export.test.ts` -- covers VALD-06b
- [ ] `src/features/explorer/utils/scan-clipboard-export.test.ts` -- covers VALD-06c, VALD-06d
- [ ] `src/features/explorer/utils/scan-pdf-export.test.ts` -- covers VALD-06e
- [ ] Rust test module in `commands/explorer.rs` for `bulk_scan_cmd` logic -- covers VALD-05a, VALD-05b, VALD-05c

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A (desktop app, local filesystem access) |
| V3 Session Management | No | N/A |
| V4 Access Control | No | Tauri plugin-fs permissions already configured |
| V5 Input Validation | Yes | Validate file pattern input (glob pattern) to prevent path traversal |
| V6 Cryptography | No | N/A |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via file pattern | Tampering | Validate pattern is a filename glob (no path separators). Scan root is already constrained to user-selected folder. |
| Denial of service via huge directory scan | Denial of Service | Cancellation support (D-04), optional file count confirmation for large scans |
| Sensitive file content in export | Information Disclosure | Export contains file paths and validation issues only, not file content. File content is never included in CSV/PDF/JSON/clipboard exports. |

## Sources

### Primary (HIGH confidence)
- Codebase: `src-tauri/src/commands/explorer.rs` -- existing `list_directory_cmd`, `CancellationToken`, `ExplorerState` patterns
- Codebase: `src-tauri/src/validation/validator.rs` -- existing `validate_characters` function and `ValidationProblem` struct
- Codebase: `src-tauri/src/validation/encoding.rs` -- existing `detect_and_decode` function
- Codebase: `src/services/events.ts` -- existing `createEventHub` pattern
- Codebase: `src/features/export/services/export-service.ts` -- existing export service pattern
- Codebase: `src/features/explorer/store.ts` -- existing store with `validationCache` and `getValidationStatus`
- [Tauri 2 Calling Frontend](https://v2.tauri.app/develop/calling-frontend/) -- `Emitter` trait, `app.emit()` API

### Secondary (MEDIUM confidence)
- [walkdir crate docs](https://docs.rs/walkdir/latest/walkdir/) -- API for recursive directory walking
- [glob crate](https://github.com/rust-lang/glob) -- Rust-lang official glob pattern matching
- [shadcn/ui Progress](https://ui.shadcn.com/docs/components/radix/progress) -- Progress bar component

### Tertiary (LOW confidence)
- None -- all claims verified against codebase or official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all core libraries already in project; only adding walkdir, glob (well-established), and shadcn progress
- Architecture: HIGH -- follows existing patterns exactly (CancellationToken, spawn_blocking, createEventHub, exportService)
- Pitfalls: HIGH -- identified from direct codebase analysis and Tauri docs; UNC path concern is documented project blocker

**Research date:** 2026-05-27
**Valid until:** 2026-06-27 (stable -- no fast-moving dependencies)
