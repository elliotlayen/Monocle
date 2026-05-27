---
phase: "05"
plan: "01"
subsystem: "explorer-bulk-scan"
tags: [bulk-validation, scan, progress-streaming, badge-aggregation, cancellation]
dependency_graph:
  requires: [phase-04-validation-pipeline]
  provides: [bulk-scan-command, scan-progress-events, folder-badges, scan-ui]
  affects: [explorer-store, explorer-tree, explorer-shell, tauri-commands]
tech_stack:
  added: [walkdir, glob, radix-progress, radix-alert-dialog]
  patterns: [tauri-event-streaming, cancellation-token, aggregate-badge-computation]
key_files:
  created:
    - src/features/explorer/utils/badge-aggregation.ts
    - src/features/explorer/utils/badge-aggregation.test.ts
    - src/features/explorer/components/scan-progress-panel.tsx
    - src/features/explorer/hooks/use-scan.ts
    - src/components/ui/progress.tsx
    - src/components/ui/alert-dialog.tsx
  modified:
    - src-tauri/Cargo.toml
    - src-tauri/src/commands/explorer.rs
    - src-tauri/src/commands/mod.rs
    - src-tauri/src/lib.rs
    - src/features/explorer/types.ts
    - src/features/explorer/store.ts
    - src/features/explorer/services/explorer-service.ts
    - src/services/tauri.ts
    - src/services/events.ts
    - src/features/explorer/components/folder-tree-node.tsx
    - src/features/explorer/components/explorer-nav-bar.tsx
    - src/features/explorer/components/explorer-shell.tsx
    - src/components/ui/button.tsx
    - package.json
    - package-lock.json
    - src-tauri/Cargo.lock
decisions:
  - "Glob pattern * matches path separators by default in the glob crate; bulk_scan_cmd matches against filename only (e.file_name()) to ensure correct behavior"
  - "D-04 confirmation implemented via AlertDialog + pendingScanRequest store field rather than toast actions, for cleaner UX"
  - "Scan progress events throttled at 50ms intervals to prevent frontend flooding"
  - "updateScanProgress creates synthetic validation cache entries (with severity markers) so tree badges update in real-time during scan"
metrics:
  duration: "9m 24s"
  completed: "2026-05-27"
---

# Phase 05 Plan 01: Bulk Scan Vertical Slice Summary

Recursive folder scan with real-time streaming progress, cancellation support, and automatic validation badge propagation to tree nodes and parent folders.

## What Was Built

### Rust Backend (Task 1)

- **bulk_scan_cmd**: Two-phase command that first collects matching files via WalkDir + glob pattern, then validates each file through the existing detect_and_decode + validate_characters pipeline. Emits throttled `scan-progress` events (50ms minimum interval) via Tauri's app.emit(). Supports cancellation via CancellationToken (shared with directory listing operations). Returns ScanSummary with per-file results.
- **cancel_scan_cmd**: Looks up operation_id in active_listings and triggers CancellationToken cancellation.
- **ScanProgressPayload, ScanFileResult, ScanSummary**: Three serde-serializable structs with camelCase field naming for frontend consumption.
- **3 Rust unit tests**: Pattern matching validation, serde camelCase serialization verification, Clone derive verification.

### Frontend Types/Services/Store (Task 1)

- **Types**: ScanProgressPayload, ScanFileResult, ScanSummary, ScanStatus added to explorer types.
- **Event hub**: scanProgressHub wired to `scan-progress` Tauri events.
- **IPC**: bulkScan and cancelScan methods added to tauri.ts and explorer-service.ts.
- **Store**: Full scan lifecycle state (scanStatus, scanOperationId, scanProgress, scanResult, folderBadgeCache, lastInteractedFolderPath, pendingScanRequest) with actions (requestScan, startScan, updateScanProgress, cancelScan, clearScanResult, setScanFilePattern, setLastInteractedFolder, confirmPendingScan, dismissPendingScan).
- **Badge aggregation**: computeAggregateBadges walks all parent directories from each file up to scan root, tracking worst severity. computeAggregateBadge provides per-folder cache lookup. 6 passing vitest tests.
- **shadcn components**: Progress (radix-ui/react-progress) and AlertDialog (radix-ui/react-alert-dialog) installed.

### UI Components (Task 2)

- **ScanProgressPanel**: Displays folder name, progress bar, file count with percentage, current file name, error/warning running totals with colored dots, and cancel button. Shows brief completion/cancellation state before clearing.
- **useScan hook**: Subscribes to scanProgressHub and dispatches updateScanProgress to store on each event.
- **Context menu**: "Scan for Issues..." item added to all folder nodes (both direct children with favorites toggle and deeper folders).
- **Toolbar**: ScanSearch button (spins as Loader2 during scan) with file pattern Input (120px, default "*.xml") added to explorer nav bar.
- **Confirmation dialog**: AlertDialog renders when pendingScanRequest is set (D-04), showing "Cancel and Rescan" / "Keep Current Scan" options.
- **Folder badges**: renderBadge() extended to show red/amber dots on folder nodes from folderBadgeCache (D-06).
- **Content area wiring**: ScanProgressPanel renders in explorer-shell when scanning (above file content if tabs open, or as sole content if no tabs).

## Decisions Made

1. Glob crate's `*` matches path separators, but our code matches against `e.file_name()` only -- safe by design.
2. D-04 confirmation uses AlertDialog (not toast actions) for a cleaner, non-dismissible confirmation UX.
3. Event throttling at 50ms prevents frontend flooding while maintaining responsive feel.
4. Synthetic validation cache entries during scan progress allow tree badges to update in real-time before full results arrive.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed glob test assertion for path separator matching**
- **Found during:** Task 1 Rust tests
- **Issue:** Test asserted `*.xml` pattern would NOT match `subdir/file.xml`, but the glob crate's `*` matches path separators by default.
- **Fix:** Updated assertion to match actual glob crate behavior; added comment documenting that bulk_scan_cmd matches against filename only.
- **Files modified:** src-tauri/src/commands/explorer.rs
- **Commit:** 606ac10

## Verification Results

- `cargo check`: Passes with no errors
- `cargo test`: 37 tests passed (including 3 new bulk scan tests)
- `npm run build`: Succeeds
- `npm run lint`: Passes with no errors
- `npm run test -- --run`: 182 tests passed across 26 test files (including 6 new badge-aggregation tests)

## Self-Check: PASSED

All created files exist, both commits verified in git log.
