---
phase: 2
slug: folder-sources-tree-sidebar
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-22
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 2.1.2 (frontend), Rust built-in test (backend) |
| **Config file** | `vitest.config.ts` (frontend), `Cargo.toml [dev-dependencies]` (backend) |
| **Quick run command** | `npm run test -- --run` |
| **Full suite command** | `npm run test && cd src-tauri && cargo test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run`
- **After every plan wave:** Run `npm run test && cd src-tauri && cargo test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | BRWS-01 | — | N/A | unit | `npm run test -- --run src/features/explorer/store.test.ts` | No -- Wave 0 | ⬜ pending |
| 02-01-02 | 01 | 1 | BRWS-01 | — | N/A | unit (Rust) | `cd src-tauri && cargo test state::tests` | Partial | ⬜ pending |
| 02-01-03 | 01 | 1 | BRWS-02 | — | N/A | unit | `npm run test -- --run src/features/explorer/store.test.ts` | No -- Wave 0 | ⬜ pending |
| 02-01-04 | 01 | 1 | BRWS-03 | — | N/A | unit | `npm run test -- --run src/features/explorer/utils/date-format.test.ts` | No -- Wave 0 | ⬜ pending |
| 02-01-05 | 01 | 1 | BRWS-08 | — | N/A | unit | `npm run test -- --run src/features/explorer/utils/tree-filter.test.ts` | No -- Wave 0 | ⬜ pending |
| 02-01-06 | 01 | 1 | BRWS-08 | — | N/A | unit | `npm run test -- --run src/features/explorer/store.test.ts` | No -- Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/features/explorer/store.test.ts` — stubs for BRWS-01 (source CRUD), BRWS-02 (expand/collapse/load state), BRWS-08 (favorites)
- [ ] `src/features/explorer/utils/date-format.test.ts` — stubs for BRWS-03 (date parsing, invalid dates, non-date folders)
- [ ] `src/features/explorer/utils/tree-filter.test.ts` — stubs for BRWS-08 (filter matching on loaded nodes)
- [ ] Extend `src-tauri/src/state.rs` tests for `FolderSource` persistence round-trip

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Sidebar resize persists width | BRWS-02 / D-15 | Requires mouse drag interaction in real app | Drag sidebar edge, restart app, verify width restored |
| Drag-to-reorder sources in settings | BRWS-01 / D-05 | Requires pointer events not available in unit tests | Open settings, drag source rows, verify order persists |
| Native folder picker opens | BRWS-01 / D-03 | Requires Tauri runtime with OS dialog | Click browse button, verify native dialog opens |
| Loading spinner + cancel on slow network | BRWS-02 / D-23 | Requires network latency simulation | Expand node over slow connection, verify spinner shows at 0s, cancel appears at 3s |
| Unreachable source visual state | BRWS-02 / D-22 | Requires unreachable network path | Configure invalid UNC path, verify greyed-out state with warning icon |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
