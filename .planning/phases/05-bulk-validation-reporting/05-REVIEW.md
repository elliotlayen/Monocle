---
phase: 05-bulk-validation-reporting
reviewed: 2026-05-27T16:25:19Z
depth: standard
files_reviewed: 27
files_reviewed_list:
  - src-tauri/Cargo.toml
  - src-tauri/src/commands/explorer.rs
  - src-tauri/src/commands/mod.rs
  - src-tauri/src/lib.rs
  - src/components/ui/alert-dialog.tsx
  - src/components/ui/progress.tsx
  - src/features/explorer/components/explorer-nav-bar.tsx
  - src/features/explorer/components/explorer-shell.tsx
  - src/features/explorer/components/file-content-area.tsx
  - src/features/explorer/components/file-tab.tsx
  - src/features/explorer/components/folder-tree-node.tsx
  - src/features/explorer/components/scan-file-row.tsx
  - src/features/explorer/components/scan-progress-panel.tsx
  - src/features/explorer/components/scan-results-header.tsx
  - src/features/explorer/components/scan-results-tab.tsx
  - src/features/explorer/hooks/use-scan-export.ts
  - src/features/explorer/hooks/use-scan.ts
  - src/features/explorer/services/explorer-service.ts
  - src/features/explorer/store.ts
  - src/features/explorer/types.ts
  - src/features/explorer/utils/badge-aggregation.ts
  - src/features/explorer/utils/scan-clipboard-export.ts
  - src/features/explorer/utils/scan-csv-export.ts
  - src/features/explorer/utils/scan-json-export.ts
  - src/features/explorer/utils/scan-pdf-export.ts
  - src/services/events.ts
  - src/services/tauri.ts
findings:
  critical: 3
  warning: 6
  info: 0
  total: 9
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-05-27T16:25:19Z
**Depth:** standard
**Files Reviewed:** 27
**Status:** issues_found

## Summary

The bulk validation and reporting feature adds a folder-scanning pipeline (Rust backend) with progress streaming, a scan results UI, and five export formats (CSV, JSON, PDF, clipboard text, clipboard markdown). The implementation is well-structured overall and follows the project's established architectural patterns. However, the review identified three critical issues (unhandled promise rejection, unbounded memory consumption, markdown injection), several warnings around stale state reads and inconsistent state cleanup, and quality concerns in the sort default direction.

## Critical Issues

### CR-01: Unhandled promise rejection in confirmPendingScan

**File:** `src/features/explorer/store.ts:789-795`
**Issue:** `confirmPendingScan` creates an async IIFE (`doIt`) and calls it without awaiting or catching errors. If `cancelScan()` or `startScan()` throws, the promise rejection is unhandled. This will trigger an `unhandledrejection` event, which in Tauri desktop apps can silently swallow errors or crash depending on configuration. The user would see the confirmation dialog dismiss but no scan would start, with no feedback about what went wrong.
**Fix:**
```typescript
confirmPendingScan: () => {
  const { pendingScanRequest } = get();
  if (!pendingScanRequest) return;

  const { folderPath, filePattern } = pendingScanRequest;
  const doIt = async () => {
    await get().cancelScan();
    await new Promise((resolve) => setTimeout(resolve, 100));
    get().startScan(folderPath, filePattern);
  };
  doIt().catch(() => {
    showToast({
      type: "error",
      title: "Failed to start scan",
      message: "An error occurred while restarting the scan",
      duration: 5000,
    });
  });
},
```

### CR-02: No file size limit in bulk_scan_cmd causes unbounded memory consumption

**File:** `src-tauri/src/commands/explorer.rs:287-294`
**Issue:** `bulk_scan_cmd` reads every matching file via `std::fs::read(file_path)` with no file size check. A scan across a large directory tree could encounter multi-GB files (database dumps, logs, binary assets) that match the glob pattern. Since `read_file_cmd` (single file) at least has a 30-second timeout that would limit damage, `bulk_scan_cmd` has no such per-file protection -- it runs inside a single `spawn_blocking` task with no timeout, and accumulates all `ScanFileResult` structs (including full `problems` vectors) in memory for the entire scan. A folder with thousands of large files would exhaust process memory and crash the application.
**Fix:**
```rust
// Add a per-file size limit before reading
const MAX_SCAN_FILE_SIZE: u64 = 50 * 1024 * 1024; // 50 MB

let file_metadata = match std::fs::metadata(file_path) {
    Ok(m) => m,
    Err(_) => {
        files_processed += 1;
        continue;
    }
};

if file_metadata.len() > MAX_SCAN_FILE_SIZE {
    files_processed += 1;
    // Optionally record as skipped
    continue;
}

let raw_bytes = match std::fs::read(file_path) {
    // ... existing code
```

### CR-03: Markdown table injection in clipboard export

**File:** `src/features/explorer/utils/scan-clipboard-export.ts:75-77`
**Issue:** `formatScanAsMarkdown` interpolates `file.relativePath` and `file.encoding` directly into markdown table cells without escaping pipe (`|`) characters. File paths containing `|` (valid on Linux/macOS) will break the markdown table structure, producing corrupt output. The same applies to any encoding name that hypothetically contains `|`. Since this is exported to the clipboard and potentially pasted into documents or issue trackers, broken formatting is a data integrity issue.
**Fix:**
```typescript
function escapeMarkdownCell(value: string): string {
  return value.replace(/\|/g, "\\|");
}

// In the table row:
lines.push(
  `| ${escapeMarkdownCell(file.relativePath)} | ${statusBadge} | ${errorCount} | ${warningCount} | ${escapeMarkdownCell(file.encoding)} |`
);
```

## Warnings

### WR-01: closeAllTabs does not clear scan state, orphaning scan results

**File:** `src/features/explorer/store.ts:524-526`
**Issue:** `closeAllTabs` sets `tabs: []` and `activeTabId: null` but does not clear `scanResult`, `scanStatus`, or `scanProgress`. In contrast, `closeTab("scan:results")` (lines 504-513) properly clears these. After `closeAllTabs()`, the scan result data remains in memory and the store state is inconsistent: `scanStatus` may be `"completed"` with no tab showing results, and a subsequent scan request could show stale data in the confirmation dialog via `scanFolderName`.
**Fix:**
```typescript
closeAllTabs: () => {
  set({
    tabs: [],
    activeTabId: null,
    scanStatus: "idle",
    scanResult: null,
    scanProgress: null,
  });
},
```

### WR-02: Stale snapshot reads for context menu state in folder-tree-node

**File:** `src/features/explorer/components/folder-tree-node.tsx:278-283`
**Issue:** `isFileOpenInTab` and `openTab` are computed via `useExplorerStore.getState()` at render time. This reads a point-in-time snapshot that does not trigger re-renders when tabs change. If a user opens a file (making it available for "Copy Content"), then right-clicks the same file in the tree, the context menu's `disabled` state may be stale (still showing disabled) because the component never re-rendered from this state change. The correct approach is to use `useExplorerStore()` with a selector so the component subscribes to tab state changes.
**Fix:**
```typescript
const isFileOpenInTab = useExplorerStore((state) =>
  !node.isDir ? state.tabs.some((t) => t.id === node.path) : false
);
const openTab = useExplorerStore((state) =>
  !node.isDir ? state.tabs.find((t) => t.id === node.path) : undefined
);
```

### WR-03: u32 overflow risk for total_files and counters in bulk_scan_cmd

**File:** `src-tauri/src/commands/explorer.rs:256`
**Issue:** `matching_files.len() as u32` will silently truncate if more than ~4.3 billion files match. While unlikely in practice, the cast from `usize` (which is 64-bit on modern systems) to `u32` is lossy. More practically, `total_errors` and `total_warnings` (also `u32`) are accumulated per-problem across all files. A scan of a large directory with many problematic files could realistically overflow `u32` for the problem counts (e.g., 100K files with 50K problems each). Consider using `u64` for counters, or add a saturating check.
**Fix:**
```rust
let total_files = matching_files.len().min(u32::MAX as usize) as u32;
// Or use u64 for all counters
```

### WR-04: Default sort direction is "desc" for status, putting clean files first

**File:** `src/features/explorer/components/scan-results-tab.tsx:101-102`
**Issue:** The default `sortField` is `"status"` and `sortDirection` is `"desc"`. The `statusOrder` map assigns `error: 0, warning: 1, clean: 2`. With descending sort, `clean` (2) sorts first and `error` (0) sorts last. For a validation scan results view, users would expect errors to appear at the top by default. The sort direction should be `"asc"` for the `status` field to show errors first.
**Fix:**
```typescript
const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
```

### WR-05: Scan button clickable during active scan without triggering cancel-and-rescan flow

**File:** `src/features/explorer/components/explorer-nav-bar.tsx:70`
**Issue:** The scan button's `disabled` condition is `!canScan && !isScanning`. When `isScanning` is true, the button is always enabled (regardless of `canScan`). Clicking it calls `handleScanClick` which calls `requestScan`. If `lastInteractedFolderPath` is null at that point (canScan is false), `handleScanClick` does nothing (line 42-44 checks `if (lastInteractedFolderPath)`), but the button shows a spinner giving misleading visual feedback that another action is possible. The button should be disabled when scanning AND no folder is selected, but the spinner icon should only appear when scanning.
**Fix:**
```tsx
disabled={!canScan}
```
This keeps the button disabled when no folder is selected, regardless of scan state. The spinner icon still shows the scan-in-progress state visually.

### WR-06: CSV comment lines with unescaped user-controlled folder paths

**File:** `src/features/explorer/utils/scan-csv-export.ts:20-27`
**Issue:** The CSV metadata comment lines interpolate `result.folderPath` and `result.filePattern` directly. If a folder path contains newline characters (valid on some systems) or the `#` character, the comment structure could be broken. More importantly, some CSV parsers treat `#` lines as comments, but many do not -- readers like Excel will show these as data rows. While not a security vulnerability per se, the `folderPath` is user-controlled input that flows through without sanitization. If a malicious folder name contains CSV-injection payloads (e.g., `=CMD(...)`) and these comment lines are parsed as data by a spreadsheet application, it could trigger formula injection.
**Fix:**
```typescript
function sanitizeCsvComment(value: string): string {
  return value.replace(/[\r\n]/g, " ");
}

lines.push(`# Folder: ${sanitizeCsvComment(result.folderPath)}`);
lines.push(`# Pattern: ${sanitizeCsvComment(result.filePattern)}`);
```

---

_Reviewed: 2026-05-27T16:25:19Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
