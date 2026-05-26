---
phase: "04"
plan: "01"
subsystem: validation-engine
tags: [rust, encoding, validation, ipc, zustand, tree-badges]
dependency_graph:
  requires: []
  provides: [validation-engine, extended-read-file-cmd, validation-cache, tree-badges]
  affects: [explorer-store, explorer-types, folder-tree-node]
tech_stack:
  added: [encoding_rs@0.8, chardetng@1.0]
  patterns: [encoding-detection-pipeline, character-validation-scanner, validation-cache]
key_files:
  created:
    - src-tauri/src/validation/mod.rs
    - src-tauri/src/validation/encoding.rs
    - src-tauri/src/validation/validator.rs
  modified:
    - src-tauri/Cargo.toml
    - src-tauri/Cargo.lock
    - src-tauri/src/lib.rs
    - src-tauri/src/commands/explorer.rs
    - src/features/explorer/types.ts
    - src/features/explorer/store.ts
    - src/features/explorer/store.test.ts
    - src/features/explorer/components/folder-tree-node.tsx
decisions:
  - "chardetng 1.0 API requires Iso2022JpDetection::Deny and Utf8Detection::Deny enums (not booleans as assumed in research)"
  - "vi.clearAllMocks() clears mock implementations in vitest 2.1.9, requiring re-establishment of readFile mock in beforeEach"
metrics:
  duration: "7m 34s"
  completed: "2026-05-26T19:03:37Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 3
  files_modified: 8
---

# Phase 4 Plan 01: Validation Engine and Data Pipeline Summary

Rust encoding detection and character validation engine with extended IPC response, frontend type/store wiring, and tree sidebar dot badges.

## Task Completion

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 0 | Verify Rust crate legitimacy | (auto-approved) | encoding_rs, chardetng are well-known Mozilla/Firefox crates |
| 1 | Rust validation engine and extended read_file_cmd | c441158 | validation/encoding.rs, validation/validator.rs, commands/explorer.rs |
| 2 | Frontend types, store, service wiring, and tree badges | cfbd32d | types.ts, store.ts, folder-tree-node.tsx |

## What Was Built

### Rust Validation Engine (Task 1)

**Encoding detection pipeline** (`src-tauri/src/validation/encoding.rs`):
- `detect_and_decode(raw_bytes)` reads raw bytes, checks for BOM (UTF-8, UTF-16 LE/BE), attempts UTF-8 decode via encoding_rs, falls back to chardetng for non-UTF-8 files
- Returns `DecodeResult` with content, encoding name, BOM flag, and decode error flag
- 6 inline Rust tests covering UTF-8, BOM, Windows-1252, null bytes, empty file, UTF-16 LE

**Character validation scanner** (`src-tauri/src/validation/validator.rs`):
- `validate_characters(content, had_decode_errors, encoding_name, has_bom)` scans transcoded UTF-8 for XML 1.0 invalid characters
- ERROR checks: null bytes, invalid control chars (0x01-0x08, 0x0B, 0x0C, 0x0E-0x1F), unescaped &, <, >, U+FFFD replacement chars
- WARNING checks: BOM detected, non-UTF-8 encoding, bare CR without LF
- Returns `Vec<ValidationProblem>` with line/column positions and copywriting-contract messages
- 15 inline Rust tests covering all error/warning types, line/column tracking, CRLF handling

**Extended read_file_cmd** (`src-tauri/src/commands/explorer.rs`):
- FileContent struct extended with `problems`, `encoding`, `has_bom` fields
- Replaced `std::fs::read_to_string` with `std::fs::read` for raw byte access
- Pipes bytes through `detect_and_decode` then `validate_characters`
- Same `tokio::time::timeout` + `spawn_blocking` wrapper preserved

### Frontend Types and Store (Task 2)

**Extended types** (`src/features/explorer/types.ts`):
- Added `ValidationProblem` interface matching Rust struct
- Added `ValidationStatus` type ("error" | "warning" | "clean")
- Extended `FileContent` and `FileTab` with problems, encoding, hasBom fields

**Extended store** (`src/features/explorer/store.ts`):
- Added `validationCache` (Map<string, cached validation>), `problemsPanelOpen`, `problemsPanelHeight`, `pendingJump` state
- Implemented `toggleProblemsPanel`, `setProblemsPanelHeight`, `jumpToProblem`, `clearPendingJump`, `getValidationStatus` actions
- Modified `openFile` to store validation results on tabs, update cache, and auto-show problems panel (D-02)
- Tab re-activation path also auto-shows panel when cached results have problems

**Tree badges** (`src/features/explorer/components/folder-tree-node.tsx`):
- Extended `renderBadge()` to show red dot (h-2 w-2 bg-red-500/dark:bg-red-400) for error status
- Yellow dot (bg-amber-500/dark:bg-amber-400) for warning-only status
- No badge for clean or unscanned files (D-17)
- Reads from store's validationCache following existing `getState()` pattern

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] chardetng 1.0 API changed from research assumptions**
- **Found during:** Task 1
- **Issue:** chardetng 1.0.0 changed `EncodingDetector::new()` to require `Iso2022JpDetection` enum parameter, and `guess()` to require `Utf8Detection` enum instead of boolean
- **Fix:** Used `chardetng::Iso2022JpDetection::Deny` and `chardetng::Utf8Detection::Deny` instead of `new()` and `false`
- **Files modified:** src-tauri/src/validation/encoding.rs
- **Commit:** c441158

**2. [Rule 3 - Blocking] Test mocks missing new FileContent fields**
- **Found during:** Task 2
- **Issue:** Existing `store.test.ts` had mocks returning `{ content, size }` without the new `problems`, `encoding`, `hasBom` fields, causing TypeScript compilation errors
- **Fix:** Updated all three `mockResolvedValueOnce` calls and the default `mockResolvedValue` factory. Also added re-establishment of the default mock in `beforeEach` since `vi.clearAllMocks()` resets implementations in vitest 2.1.9
- **Files modified:** src/features/explorer/store.test.ts
- **Commit:** cfbd32d

## Verification Results

- `cargo test -- validation`: 21/21 tests pass (6 encoding + 15 validator)
- `cargo check`: Compiles with no errors
- `npm run build`: TypeScript compiles, Vite builds successfully
- `npm run lint`: No lint errors
- `npm run test -- --run`: 176/176 tests pass across 25 test files

## Self-Check: PASSED

All created files verified present. All key content patterns found in target files. Both task commits (c441158, cfbd32d) verified in git log.
