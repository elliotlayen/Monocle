# Phase 5: Bulk Validation & Reporting - Context

**Gathered:** 2026-05-27
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase extends Phase 4's single-file validation to process entire folders in one action. Users select any folder node in the tree, run a recursive validation scan on all matching files, see real-time streaming progress in the content area, and export results as CSV, PDF, JSON, or clipboard text (plain text or markdown). The scan reuses the existing `validate_characters` + `detect_and_decode` pipeline per file. No new validation rules — just orchestrating the existing engine across many files and surfacing aggregated results. Tree badges are updated for all scanned files and aggregate badges are set on parent folders.

</domain>

<decisions>
## Implementation Decisions

### Scan Trigger & Scope
- **D-01:** Users initiate bulk scans via two entry points: a right-click context menu item ("Scan for issues") on folder nodes in the tree sidebar, and a toolbar button for scanning the currently selected folder.
- **D-02:** Scanning is available on any folder node in the tree regardless of depth. The scan recursively walks all subdirectories under the selected node. No artificial scope restrictions — the tree selection itself is the filter.
- **D-03:** File filter is configurable. Default pattern is `*.xml` but users can specify a custom pattern (e.g., `*.dat`, `*.*`) before starting the scan.
- **D-04:** Only one scan can run at a time. Starting a new scan while one is active prompts the user to cancel the current scan first.

### Tree Badges
- **D-05:** Bulk scan results populate validation badges on all scanned files, even files never individually opened. Red dot for errors, yellow dot for warnings (matching Phase 4 D-14 pattern).
- **D-06:** Parent folder nodes get aggregate badges after a bulk scan. A folder shows the worst severity of its scanned children — red if any child file has errors, yellow if only warnings, no badge if all clean.
- **D-07:** The folder hierarchy is generic (Phase 04.1 refactor removed hardcoded Client > Date > File levels). The scan walks whatever folder structure exists.

### Progress & Streaming
- **D-08:** Real-time per-file progress updates. Each file completion fires a Tauri event with the file name, validation result (clean/errors/warnings), and running totals.
- **D-09:** Progress is communicated via Tauri events (`app_handle.emit`). Frontend listens via `@tauri-apps/api/event`. Same event pattern as menu events in `src/services/events.ts`.
- **D-10:** Progress appears as an inline panel in the content area showing: progress bar, file count (e.g., "45 of 200 files (23%)"), name of the current file being scanned, running error/warning totals, and a cancel button.
- **D-11:** No ETA calculation. Progress shows counts and percentage only.

### Results Display
- **D-12:** Scan results open as a dedicated tab in the content area (alongside regular file tabs). The tab persists until the user closes it. Results are session-only — not persisted across app restarts (consistent with Phase 3 D-13).
- **D-13:** Results are organized as a file list with expandable rows. Summary stats at the top (total files, errors, warnings, clean). Each row shows a file with status icon and issue counts. Expanding a row reveals individual problems. Columns are sortable.
- **D-14:** All scanned files appear in results, including clean files (shown with green checkmark). Users can filter the list to show only files with issues.
- **D-15:** Clicking a file in scan results opens it as a regular file tab with source view and problems panel (Phase 4 behavior). Seamless drill-down from summary to detail.

### Report Export
- **D-16:** Export buttons live in the header of the scan results tab as a dropdown with format options. Only visible when scan results are displayed.
- **D-17:** CSV export: one row per validation problem. Columns: File Path, Line, Column, Severity, Issue Code, Description, Encoding. Clean files included as a single row with "Clean" status.
- **D-18:** PDF export: summary section with scan scope, date, aggregate stats, followed by file-by-file detail listing each file and its problems. Uses existing `jsPDF` pattern from `src/features/export/utils/pdf-export.ts`.
- **D-19:** JSON export: structured object with metadata (scope, date, stats) and an array of file results, each containing their problems array.
- **D-20:** Clipboard export offers two options: plain text summary (compact text block for Slack/Teams/email) and markdown table (for GitHub/Jira). Both available as separate items in the export dropdown.
- **D-21:** All export formats include metadata: scanned folder path, file pattern used, scan date/time, total files scanned, error count, warning count, clean count.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Project overview, constraints (read-only, Tauri 2, lazy loading, cross-platform), folder structure
- `.planning/REQUIREMENTS.md` — Requirements VALD-05, VALD-06 map to this phase
- `.planning/ROADMAP.md` — Phase 5 goal, success criteria, and dependencies

### Prior Phase Context
- `.planning/phases/04-single-file-validation/04-CONTEXT.md` — Phase 4 decisions on validation engine (D-05 through D-07), severity model (D-11 through D-13), tree badges (D-14 through D-18), and problems panel (D-01 through D-04) that this phase extends
- `.planning/phases/02-folder-sources-tree-sidebar/02-CONTEXT.md` — Phase 2 decisions on tree sidebar behavior (D-09 hierarchy, D-22 through D-28 network I/O resilience) that constrain scan traversal

### Codebase Integration Points
- `src-tauri/src/validation/validator.rs` — Existing `validate_characters` function reused per-file in bulk scan
- `src-tauri/src/validation/mod.rs` — `detect_and_decode` function for encoding detection + transcoding
- `src-tauri/src/commands/explorer.rs` — Existing `read_file_cmd`, `list_directory_cmd` with `CancellationToken` pattern, `ExplorerState` with `active_listings`. New bulk scan command goes here.
- `src/features/explorer/store.ts` — Explorer Zustand store to extend with scan state (active scan, progress, results, badge cache)
- `src/features/explorer/types.ts` — Types to extend with scan-related types (ScanResult, ScanProgress, ScanFileResult)
- `src/features/explorer/services/explorer-service.ts` — Service to extend with scan initiation and event listeners
- `src/services/tauri.ts` — IPC gateway where new scan commands are registered
- `src/services/events.ts` — Event hub pattern for Tauri events (reference for scan progress events)
- `src/features/export/utils/pdf-export.ts` — Existing jsPDF pattern to follow for scan report PDF
- `src/features/export/services/export-service.ts` — Existing export service pattern for file save dialog
- `src-tauri/src/lib.rs` — Command registration for new scan commands

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src-tauri/src/validation/validator.rs`: `validate_characters()` is the core validation function — call it per-file during bulk scan. No changes needed to the validator itself.
- `src-tauri/src/validation/mod.rs`: `detect_and_decode()` handles raw bytes -> encoding detection -> UTF-8 transcoding. Reuse for each file in the scan.
- `src-tauri/src/commands/explorer.rs`: `ExplorerState` with `Mutex<HashMap<String, CancellationToken>>` for cancellable operations. Same pattern for scan cancellation.
- `src/features/export/utils/pdf-export.ts`: `jsPDF` document generation with `checkPageBreak`, summary sections, detail sections. Adapt structure for scan reports.
- `src/services/events.ts`: `createEventHub` pattern for Tauri events. Use for scan progress event subscription.
- `src/components/ui/badge.tsx`, `src/components/ui/scroll-area.tsx`, `src/components/ui/progress.tsx` (shadcn): UI primitives for results display and progress indicators.

### Established Patterns
- IPC pattern: Rust command in `commands/*.rs` -> registered in `lib.rs` -> typed method on `tauri` object in `services/tauri.ts` -> feature service wraps it.
- Cancellation pattern: `CancellationToken` from `tokio_util::sync`, stored in `ExplorerState`, checked per iteration in `spawn_blocking`.
- Event streaming: `app_handle.emit("event-name", payload)` from Rust, `listen("event-name", callback)` from `@tauri-apps/api/event` on frontend.
- Store pattern: Zustand with `useShallow` selectors. Scan state (progress, results, active scan) extends the explorer store.
- Export pattern: Generate data in memory (Uint8Array for PDF, string for CSV/JSON), use `@tauri-apps/plugin-dialog` save dialog, write via `@tauri-apps/plugin-fs`.

### Integration Points
- New Rust command: `bulk_scan_cmd` — accepts folder path, file pattern, operation ID. Recursively walks directory, validates each matching file, emits progress events, returns summary.
- New Rust command: `cancel_scan_cmd` — cancels active scan via `CancellationToken`.
- Explorer store extends: scan state (status, progress, results), badge cache (validation status per file path), aggregate badge computation.
- Content area adds: scan progress panel, scan results tab.
- Tree node component: reads badge state from store for both individual files and folder aggregates.
- Toolbar adds: scan button (enabled when a folder node is selected).

</code_context>

<specifics>
## Specific Ideas

- The progress panel should transition smoothly into the results tab when the scan completes — the inline progress panel content gives way to the full results tab.
- Results tab header format: "Scan Results — [folder name] — [N files, X errors, Y warnings]" with export dropdown on the right.
- File list columns: Status icon (red/yellow/green), File Name, Path (relative to scan root), Errors, Warnings, Encoding. Sortable by any column.
- Expanding a file row shows the same problem detail as Phase 4's problems panel: severity icon, line:column, description.
- The scan should use `spawn_blocking` with `std::fs` operations (not tokio::fs) for consistency with existing `list_directory_cmd` pattern and the UNC path workaround.
- For the configurable file filter, a simple text input above the progress area where the user types the pattern (default "*.xml") before clicking "Start Scan".
- Aggregate folder badges should propagate upward: if a date folder has errors, its parent client folder should also show the error badge.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 5-Bulk Validation & Reporting*
*Context gathered: 2026-05-27*
