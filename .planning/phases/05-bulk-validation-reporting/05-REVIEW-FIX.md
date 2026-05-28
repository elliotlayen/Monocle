---
phase: 05-bulk-validation-reporting
fixed_at: 2026-05-28T00:00:00Z
review_path: .planning/phases/05-bulk-validation-reporting/05-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 9
skipped: 0
status: all_fixed
---

# Phase 05: Code Review Fix Report

**Fixed at:** 2026-05-28T00:00:00Z
**Source review:** .planning/phases/05-bulk-validation-reporting/05-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 9
- Fixed: 9
- Skipped: 0

## Fixed Issues

### CR-01: Unhandled promise rejection in confirmPendingScan

**Files modified:** `src/features/explorer/store.ts`
**Commit:** 84978f7
**Applied fix:** Added `.catch()` handler to the `doIt()` async IIFE call that shows an error toast when `cancelScan()` or `startScan()` throws, preventing unhandled promise rejections.

### CR-02: No file size limit in bulk_scan_cmd causes unbounded memory consumption

**Files modified:** `src-tauri/src/commands/explorer.rs`
**Commit:** 9201744
**Applied fix:** Added a `MAX_SCAN_FILE_SIZE` constant (50 MB) and a `std::fs::metadata` check before `std::fs::read` in the bulk scan loop. Files exceeding the limit are silently skipped with the counter incremented.

### CR-03: Markdown table injection in clipboard export

**Files modified:** `src/features/explorer/utils/scan-clipboard-export.ts`
**Commit:** 04d225a
**Applied fix:** Added `escapeMarkdownCell()` helper that escapes pipe characters (`|` -> `\|`). Applied it to `file.relativePath` and `file.encoding` in the markdown table row template.

### WR-01: closeAllTabs does not clear scan state, orphaning scan results

**Files modified:** `src/features/explorer/store.ts`
**Commit:** 1e594da
**Applied fix:** Extended `closeAllTabs` to also reset `scanStatus` to `"idle"`, `scanResult` to `null`, and `scanProgress` to `null`, matching the cleanup behavior already present in `closeTab("scan:results")`.

### WR-02: Stale snapshot reads for context menu state in folder-tree-node

**Files modified:** `src/features/explorer/components/folder-tree-node.tsx`
**Commit:** 4a1247b
**Applied fix:** Replaced `useExplorerStore.getState().tabs.some(...)` and `.find(...)` (point-in-time snapshots) with `useExplorerStore((state) => ...)` selector hooks so the component subscribes to tab state changes and re-renders when tabs are opened/closed.

### WR-03: u32 overflow risk for total_files and counters in bulk_scan_cmd

**Files modified:** `src-tauri/src/commands/explorer.rs`
**Commit:** 8449d72
**Applied fix:** Changed `matching_files.len() as u32` to `matching_files.len().min(u32::MAX as usize) as u32` for safe truncation. Changed all counter increments (`total_errors +=`, `total_warnings +=`, `error_files +=`, etc.) to use `saturating_add` to prevent silent overflow. Also applied `.min(u32::MAX as usize)` to per-file problem count casts.

### WR-04: Default sort direction is "desc" for status, putting clean files first

**Files modified:** `src/features/explorer/components/scan-results-tab.tsx`
**Commit:** b6ebb27
**Applied fix:** Changed default `sortDirection` state from `"desc"` to `"asc"` so that error files (statusOrder 0) sort to the top by default.

### WR-05: Scan button clickable during active scan without triggering cancel-and-rescan flow

**Files modified:** `src/features/explorer/components/explorer-nav-bar.tsx`
**Commit:** 8fd8039
**Applied fix:** Changed `disabled={!canScan && !isScanning}` to `disabled={!canScan}` so the button is disabled whenever no folder is selected, regardless of scan state. The spinner icon continues to indicate scan-in-progress visually.

### WR-06: CSV comment lines with unescaped user-controlled folder paths

**Files modified:** `src/features/explorer/utils/scan-csv-export.ts`
**Commit:** 348f209
**Applied fix:** Added `sanitizeCsvComment()` helper that replaces `\r` and `\n` with spaces. Applied it to `result.folderPath` and `result.filePattern` in the CSV metadata comment lines to prevent comment structure breakage.

## Skipped Issues

None -- all findings were fixed.

---

_Fixed: 2026-05-28T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
