---
phase: 5
slug: bulk-validation-reporting
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-27
---

# Phase 5 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend), #[cfg(test)] (Rust) |
| **Config file** | vitest.config.ts (frontend), inline in source files (Rust) |
| **Quick run command** | `npm run test -- --run` |
| **Full suite command** | `npm run test -- --run && cd src-tauri && cargo test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run && cd src-tauri && cargo test`
- **After every plan wave:** Run `npm run test -- --run && cd src-tauri && cargo test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-01-T1 | 01 | 1 | VALD-05 | T-05-01 | Glob pattern validation | unit (Rust) | `cd src-tauri && cargo test bulk_scan` | Created by 05-01-T1 | pending |
| 05-01-T1 | 01 | 1 | VALD-05 | -- | Badge aggregation correctness | unit (TS) | `npm run test -- --run src/features/explorer/utils/badge-aggregation.test.ts` | Created by 05-01-T1 | pending |
| 05-02-T1 | 02 | 2 | VALD-06 | T-05-07 | CSV export format + escaping | unit (TS) | `npm run test -- --run src/features/explorer/utils/scan-csv-export.test.ts` | Created by 05-02-T1 | pending |
| 05-02-T1 | 02 | 2 | VALD-06 | -- | JSON export structure | unit (TS) | `npm run test -- --run src/features/explorer/utils/scan-json-export.test.ts` | Created by 05-02-T1 | pending |
| 05-02-T1 | 02 | 2 | VALD-06 | -- | Clipboard text/markdown format | unit (TS) | `npm run test -- --run src/features/explorer/utils/scan-clipboard-export.test.ts` | Created by 05-02-T1 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

All test files are created inline within the plan tasks that produce the corresponding production code:

- **Plan 01, Task 1** creates:
  - Rust `#[cfg(test)] mod tests` in `src-tauri/src/commands/explorer.rs` (test_glob_pattern_matching, test_scan_summary_serialization, test_scan_progress_payload_clone)
  - `src/features/explorer/utils/badge-aggregation.test.ts` (6 test cases)

- **Plan 02, Task 1** creates:
  - `src/features/explorer/utils/scan-csv-export.test.ts` (4 test cases)
  - `src/features/explorer/utils/scan-json-export.test.ts` (3 test cases)
  - `src/features/explorer/utils/scan-clipboard-export.test.ts` (4 test cases)

*No separate Wave 0 plan needed -- tests are co-located with their production code tasks.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Right-click context menu triggers scan | VALD-05 | UI interaction requires manual verification | Right-click folder in tree, select "Scan for issues", verify scan starts |
| D-04 confirmation dialog when scan active | VALD-05 | UI dialog interaction | Start scan, attempt to start another scan, verify confirmation dialog appears offering to cancel current scan |
| Progress bar streams in real time | VALD-05 | Visual streaming behavior | Start scan on folder with 50+ files, verify progress updates smoothly |
| Cancel button stops active scan | VALD-05 | UI + backend cancellation flow | Start scan, click cancel mid-scan, verify scan stops and partial results shown |
| Export dropdown with CSV/PDF/JSON/clipboard | VALD-06 | UI dropdown interaction | Complete scan, click export dropdown, verify all format options present |
| PDF export renders correctly | VALD-06 | Visual document verification | Export as PDF, open file, verify summary section and file detail listing |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
