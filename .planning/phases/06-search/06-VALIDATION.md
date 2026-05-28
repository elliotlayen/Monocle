---
phase: 6
slug: search
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-05-28
---

# Phase 6 -- Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend), Rust built-in `#[test]` (backend) |
| **Config file** | `vitest.config.ts` (frontend), default cargo test (backend) |
| **Quick run command** | `npm run test -- --run` |
| **Full suite command** | `npm run test -- --run && cd src-tauri && cargo test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm run test -- --run`
- **After every plan wave:** Run `npm run test -- --run && cd src-tauri && cargo test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-T0 | 06-01 | 1 | SRCH-01, SRCH-02c, SRCH-03 | -- | N/A | unit | `npm run test -- --run` | Yes (tree-filter.test.ts exists; store.test.ts and scope-resolver.test.ts created as Wave 0 stubs) | ⬜ pending |
| 01-T1 | 06-01 | 1 | SRCH-02a, SRCH-02b | -- | N/A | unit | `cd src-tauri && cargo test parse_search_terms && cargo test search_summary` | No (created in task) | ⬜ pending |
| 01-T2 | 06-01 | 1 | SRCH-02c | -- | N/A | unit | `npm run test -- --run` | Yes (store.test.ts extended) | ⬜ pending |
| 02-T1 | 06-02 | 2 | SRCH-01 | -- | N/A | build | `npm run build && npm run lint && npm run test -- --run` | -- | ⬜ pending |
| 02-T2 | 06-02 | 2 | SRCH-02, SRCH-03 | T-06-05 | operationId validation | build | `npm run build && npm run lint && npm run test -- --run` | -- | ⬜ pending |
| 03-T1 | 06-03 | 3 | SRCH-01, SRCH-02 | -- | N/A | build | `npm run build && npm run lint && npm run test -- --run` | -- | ⬜ pending |
| 03-T2 | 06-03 | 3 | -- | -- | N/A | manual | Visual checkpoint | -- | ⬜ pending |

*Status: ⬜ pending / ✅ green / ❌ red / ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `src/features/explorer/utils/tree-filter.test.ts` -- already exists, covers SRCH-01 filename filtering
- [x] `src/features/explorer/store.test.ts` -- extended with search state describe block (SRCH-02c stubs) in Plan 06-01 Task 0
- [x] `src/features/explorer/utils/scope-resolver.test.ts` -- created as stub in Plan 06-01 Task 0 (SRCH-03)
- [x] `src-tauri/src/commands/explorer.rs` tests -- Rust unit tests created in Plan 06-01 Task 1 (SRCH-02a, SRCH-02b)

*All Wave 0 test infrastructure is covered by Plan 06-01.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Streaming results display progressively | SRCH-02 | Requires visual verification of real-time UI updates | Run content search on large folder, observe results appearing incrementally |
| Keyboard shortcuts (Cmd+F, Cmd+Shift+F) | SRCH-01 | Requires keyboard interaction in Tauri window | Press shortcuts, verify focus behavior |
| Network share disconnection handling | SRCH-02 | Requires simulating network failure | Disconnect VPN during active search, verify error message |
| Monaco search highlights visible | SRCH-02 | Requires visual verification of decorations | Click search result, verify yellow/amber highlights and scroll to first match |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready
