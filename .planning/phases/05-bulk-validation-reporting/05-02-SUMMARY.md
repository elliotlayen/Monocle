---
phase: "05"
plan: "02"
subsystem: "explorer-scan-results-export"
tags: [scan-results, csv-export, json-export, pdf-export, clipboard-export, sortable-list, tab-integration]
dependency_graph:
  requires: [05-01-bulk-scan-vertical-slice]
  provides: [scan-results-tab, export-formatters, scan-tab-lifecycle]
  affects: [explorer-store, file-content-area, file-tab, explorer-types]
tech_stack:
  added: []
  patterns: [synthetic-tab, csv-escaping, jspdf-scan-report, clipboard-manager-export]
key_files:
  created:
    - src/features/explorer/utils/scan-csv-export.ts
    - src/features/explorer/utils/scan-csv-export.test.ts
    - src/features/explorer/utils/scan-json-export.ts
    - src/features/explorer/utils/scan-json-export.test.ts
    - src/features/explorer/utils/scan-clipboard-export.ts
    - src/features/explorer/utils/scan-clipboard-export.test.ts
    - src/features/explorer/utils/scan-pdf-export.ts
    - src/features/explorer/hooks/use-scan-export.ts
    - src/features/explorer/components/scan-file-row.tsx
    - src/features/explorer/components/scan-results-header.tsx
    - src/features/explorer/components/scan-results-tab.tsx
  modified:
    - src/features/explorer/types.ts
    - src/features/explorer/store.ts
    - src/features/explorer/components/file-content-area.tsx
    - src/features/explorer/components/file-tab.tsx
decisions:
  - "Synthetic tab approach for scan results -- scan:results tab ID integrates into existing tab bar system alongside file tabs"
  - "CSV escaping wraps fields with commas/quotes/newlines in double quotes and doubles internal quotes (T-05-07 mitigation)"
  - "Export hook reads scanResult from store via getState() rather than hook selector to avoid stale closures in callbacks"
  - "ScanFileRow omits scanRoot prop usage since relativePath already contains the needed display path"
metrics:
  duration: "5m 19s"
  completed: "2026-05-27"
---

# Phase 05 Plan 02: Scan Results Display & Export Summary

Scan results tab with sortable/filterable file list, expandable problem details, drill-down to individual files, and five export formats (CSV, PDF, JSON, clipboard text, clipboard markdown) with unit tests.

## What Was Built

### Export Formatters (Task 1)

- **CSV export** (`scan-csv-export.ts`): `exportScanToCsv()` produces a CSV with metadata comments (folder, pattern, date, totals), header row (File Path, Line, Column, Severity, Issue Code, Description, Encoding), one row per problem, clean files as single "Clean" severity rows. `escapeCsv()` handles commas, quotes, newlines per T-05-07.
- **JSON export** (`scan-json-export.ts`): `exportScanToJson()` produces pretty-printed JSON with `metadata` object (folder, pattern, scanDate, totals) and `files` array.
- **PDF export** (`scan-pdf-export.ts`): `exportScanToPdf()` generates A4 portrait PDF via jsPDF with title, metadata, summary section, and file-by-file detail with problem listings. Uses `checkPageBreak()` for page overflow.
- **Clipboard text** (`scan-clipboard-export.ts`): `formatScanAsText()` produces compact plain text with header, summary line, and detail lines for files with issues using `[ERROR]`/`[WARN]` status icons.
- **Clipboard markdown** (`scan-clipboard-export.ts`): `formatScanAsMarkdown()` produces markdown with heading, metadata bullets, summary bullets, and results table with all files.
- **Unit tests**: 4 CSV tests, 3 JSON tests, 4 clipboard tests -- all passing.

### UI Components (Task 1)

- **ScanFileRow**: Expandable row with status icon (red/amber/green), file name, relative path, error/warning counts, encoding. Click toggles expansion showing per-problem detail rows matching ProblemRow styling. Double-click opens file as regular tab (D-15).
- **ScanResultsHeader**: Follows file-content-header pattern. Shows FileSearch icon, "Scan Results" label, folder name, summary text. Filter toggle button (D-14) and export dropdown (CSV, PDF, JSON, Copy as Text, Copy as Markdown) per D-16.
- **ScanResultsTab**: Full results view with header, summary stat cards (files, errors, warnings, clean with icons), sortable column headers (File, Status, Errors, Warnings, Encoding), and ScrollArea file list. `showIssuesOnly` filter state per D-14.

### Export Hook (Task 1)

- **useScanExport**: Returns `exportCsv`, `exportJson`, `exportPdf`, `exportClipboardText`, `exportClipboardMarkdown`. File exports use `exportService.saveTextFile`/`saveBinaryFile` with save dialog. Clipboard exports use `@tauri-apps/plugin-clipboard-manager` `writeText()` with success toast.

### Tab System Integration (Task 2)

- **FileTab type**: Added optional `isScanResult` boolean flag for synthetic scan result tabs.
- **Store changes**: `startScan` removes existing `scan:results` tab before new scan. Scan completion handler creates synthetic `FileTab` with `id: "scan:results"`, `isScanResult: true`, and sets it as `activeTabId`. `closeTab` clears scan state when closing `scan:results`.
- **FileContentArea**: Renders `ScanResultsTab` when `activeTab.id === "scan:results"` (no problems panel or validation bar for scan results).
- **FileTab icon**: `renderIcon()` returns `FileSearch` icon when `tab.isScanResult` is true, checked before existing `isLoading`/`isXml` checks.

## Decisions Made

1. Synthetic tab pattern (`scan:results` as a FileTab with `isScanResult` flag) integrates scan results into existing tab system without a separate rendering path in explorer-shell.
2. CSV escaping follows RFC 4180 conventions (double-quote wrapping, internal quote doubling) to mitigate T-05-07 injection risk.
3. Export hook reads `scanResult` from store via `useExplorerStore.getState()` inside callbacks rather than via hook selector, avoiding stale closure issues in `useCallback`.
4. ScanFileRow does not use `scanRoot` prop -- the `relativePath` field from `ScanFileResult` already provides the display-ready path.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed unused scanRoot parameter from ScanFileRow**
- **Found during:** Task 1 build verification
- **Issue:** TypeScript `noUnusedParameters` flagged `scanRoot` as unused in `ScanFileRow` since `file.relativePath` already provides the display path.
- **Fix:** Removed destructuring of `scanRoot` from the component function signature (kept in props interface for API contract).
- **Files modified:** src/features/explorer/components/scan-file-row.tsx
- **Commit:** 6eae4ef

## Verification Results

- `npm run build`: Passes (TypeScript compiles, Vite builds)
- `npm run lint`: Passes with no errors
- `npm run test -- --run`: 193 tests pass across 29 test files (182 existing + 11 new export tests)

## Self-Check: PASSED

All 11 created files exist, both commits (6eae4ef, 9b8dd59) verified in git log.
