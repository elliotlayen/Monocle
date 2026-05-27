---
status: partial
phase: 05-bulk-validation-reporting
source: [05-VERIFICATION.md]
started: 2026-05-27T12:30:00Z
updated: 2026-05-27T12:30:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Full scan lifecycle
expected: Right-click a folder, select "Scan for Issues", see progress panel with bar/counts/cancel, scan completes, results tab opens with file list and export dropdown
result: [pending]

### 2. Concurrent scan dialog
expected: Start a scan, then try starting another scan on a different folder -- confirmation dialog appears asking to cancel current scan
result: [pending]

### 3. Folder badge aggregation
expected: After scan, folders in the tree show aggregate badges reflecting worst severity of their children (red for errors, yellow for warnings)
result: [pending]

### 4. Toolbar scan button
expected: Toolbar scan button enabled when a folder is selected, disabled otherwise. File pattern input defaults to *.xml. Clicking starts scan on last-interacted folder
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
