---
phase: 04-single-file-validation
verified: 2026-05-26T15:30:00Z
status: gaps_found
score: 8/10 must-haves verified
overrides_applied: 0
gaps:
  - truth: "Opening a file triggers character-level and encoding validation in Rust"
    status: partial
    reason: "Validator detects null bytes, invalid control chars, FFFD with decode errors, bare CR, BOM, and non-UTF8 encoding -- but does NOT detect unescaped '&', '<', '>' as required by VALD-01, D-06, D-12, and the plan task spec. The validator module comment says 'unescaped entities' but implements none. This omission directly affects VALD-01 satisfaction."
    artifacts:
      - path: "src-tauri/src/validation/validator.rs"
        issue: "No code for unescaped-ampersand, unescaped-less-than, or unescaped-greater-than detection. Lines 81-158 cover only null bytes, invalid XML control chars, FFFD with decode errors, and bare CR. The document comment on line 3 says 'unescaped entities' but is aspirational, not descriptive."
    missing:
      - "Implement detection of bare '&' (code: 'unescaped-ampersand'), bare '<' (code: 'unescaped-less-than'), and bare '>' (code: 'unescaped-greater-than') per plan task 1 spec and VALD-01 requirement"
      - "OR explicitly document and accept the omission via override (since RESEARCH D-07 notes no structural validation and REVIEW CR-02 flags massive false-positives as a consequence)"

  - truth: "Files with errors show a red dot badge in the tree sidebar (reactive)"
    status: partial
    reason: "The badge rendering logic is correct (red dot for error, yellow for warning) but folder-tree-node.tsx reads validation status via useExplorerStore.getState().getValidationStatus() directly in render (line 175). getState() bypasses Zustand subscription, so the badge will NOT update reactively when validation results arrive after file open. The badge only appears if the tree node re-renders for an unrelated reason. This means users do not see the badge on recently-opened files as intended by D-14 to D-17."
    artifacts:
      - path: "src/features/explorer/components/folder-tree-node.tsx"
        issue: "Line 175: 'useExplorerStore.getState().getValidationStatus(node.path)' -- reads state without subscribing to changes. Should use useExplorerStore((state) => isFile ? state.getValidationStatus(node.path) : undefined) to trigger re-renders when validationCache is updated."
    missing:
      - "Replace useExplorerStore.getState().getValidationStatus() call at line 175 with a reactive hook selector: const validationStatus = useExplorerStore((state) => isFile ? state.getValidationStatus(node.path) : undefined)"
---

# Phase 4: Single-File Validation Verification Report

**Phase Goal:** Users can instantly see whether an open file has problems and pinpoint the exact location of every issue
**Verified:** 2026-05-26T15:30:00Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Opening a file triggers character-level and encoding validation in Rust | PARTIAL | `read_file_cmd` calls `detect_and_decode` + `validate_characters`. Encoding pipeline fully implemented. Character checks cover null bytes, control chars, FFFD, bare CR, BOM, non-UTF8 -- but unescaped `&`, `<`, `>` are NOT detected despite being required by VALD-01 and the plan spec. |
| 2 | Validation results (problems, encoding, hasBom) arrive on the frontend via the extended FileContent IPC response | VERIFIED | `FileContent` struct in `explorer.rs` has `problems: Vec<ValidationProblem>`, `encoding: String`, `has_bom: bool`. TypeScript `FileContent` interface has matching fields. IPC pipeline complete. |
| 3 | Files with errors show a red dot badge in the tree sidebar | PARTIAL | Badge rendering logic exists (red dot for error, yellow for warning) in `renderBadge()`. BUT validation status is read via `useExplorerStore.getState()` (line 175 of `folder-tree-node.tsx`) which is NOT reactive -- badge will not update when validation completes after file open. |
| 4 | Files with warnings only show a yellow dot badge in the tree sidebar | PARTIAL | Same stale-read issue as truth 3. Logic is correct; reactivity is broken. |
| 5 | Validation results are cached per file path and reused when re-opening a closed tab | VERIFIED | `validationCache: Map<string, {...}>` in store, updated in `openFile`. Re-activation path checks cache and auto-shows panel at `store.ts:356-361`. |
| 6 | Clean files show no badge in the tree | VERIFIED | `renderBadge()` returns null for file nodes when `validationStatus` is undefined or "clean". |
| 7 | A problems panel lists all issues with line number, column, description, and severity | VERIFIED | `ProblemsPanel` + `ProblemRow` components exist, render `line:column` + severity icon + message. Sorted by line then column. |
| 8 | Clicking a problem in the panel jumps to that location in source view | VERIFIED | `ProblemRow.onClick` calls `store.jumpToProblem` which sets `pendingJump`. `XmlSourceView` effect at line 101 calls `setPosition` + `revealLineInCenterIfOutsideViewport` + `focus`. |
| 9 | A status bar at the bottom always shows error/warning counts and encoding | VERIFIED | `ValidationStatusBar` rendered unconditionally in `file-content-area.tsx:230`. Shows counts with singular/plural, encoding, "No problems" when clean. |
| 10 | Lines with issues have gutter markers and inline highlights in Monaco | VERIFIED | `useValidationDecorations` hook creates `IEditorDecorationsCollection` with `glyphMarginClassName`, `className`, `overviewRuler`, `hoverMessage`. `glyphMargin: true` and `overviewRulerLanes: 2` set in editor options. CSS injected on first mount. |

**Score:** 8/10 truths fully verified (2 partial -- both blocking)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src-tauri/src/validation/mod.rs` | Module re-exports | VERIFIED | `pub mod encoding; pub mod validator; pub use encoding::detect_and_decode; pub use validator::validate_characters;` |
| `src-tauri/src/validation/encoding.rs` | Encoding detection and transcoding pipeline | VERIFIED | `detect_and_decode()` with BOM sniff, UTF-8 fast path, chardetng fallback. 6 inline tests pass. |
| `src-tauri/src/validation/validator.rs` | Character-level XML validation scanning | PARTIAL | `validate_characters()` exists with 11 tests. Missing: unescaped `&`, `<`, `>` detection codes. These are in the plan spec and VALD-01. |
| `src-tauri/src/commands/explorer.rs` | Extended read_file_cmd with validation data | VERIFIED | `FileContent` has `problems`, `encoding`, `has_bom`. Uses `std::fs::read` for raw bytes. Pipeline: `detect_and_decode` -> `validate_characters`. |
| `src/features/explorer/types.ts` | ValidationProblem and extended types | VERIFIED | `ValidationProblem` interface, `ValidationStatus` type, extended `FileContent` and `FileTab` with `problems`, `encoding`, `hasBom`. |
| `src/features/explorer/store.ts` | Validation cache, panel state, jump action | VERIFIED | `validationCache`, `problemsPanelOpen`, `problemsPanelHeight`, `pendingJump` state. Actions: `toggleProblemsPanel`, `setProblemsPanelHeight`, `jumpToProblem`, `clearPendingJump`, `getValidationStatus`. |
| `src/features/explorer/components/folder-tree-node.tsx` | Validation dot badges | PARTIAL | Badge logic correct, but `getState()` call at line 175 breaks reactivity. |
| `src/features/explorer/components/problems-panel.tsx` | VS Code-style collapsible problems panel | VERIFIED | `ProblemsPanel` with header, sorted `ProblemRow` entries, `ScrollArea`, `role="region"`, `aria-expanded`. |
| `src/features/explorer/components/problem-row.tsx` | Single problem entry row component | VERIFIED | `ProblemRow` with `CircleAlert`/`TriangleAlert` icons, `line:column`, message, `tabIndex=0`, `role="listitem"`, Enter/Space keyboard support. |
| `src/features/explorer/components/validation-status-bar.tsx` | Thin status bar with counts and encoding | VERIFIED | Error/warning counts with singular/plural, "No problems" fallback, encoding on right, `role="status"`, `aria-live="polite"`. |
| `src/features/explorer/hooks/use-validation-decorations.ts` | Hook to apply Monaco decorations | VERIFIED | Creates `IEditorDecorationsCollection`, CSS injection, per-line glyph deduplication, overview ruler markers, cleanup on unmount. |
| `src/features/explorer/components/xml-source-view.tsx` | Monaco with decorations and jump support | VERIFIED | `glyphMargin: true`, `overviewRulerLanes: 2`, `useValidationDecorations(editorMounted, problems ?? [])`, `pendingJump` effect. |
| `src/features/explorer/components/file-content-area.tsx` | Wired content area with panel and status bar | VERIFIED | `ProblemsPanel` + `ValidationStatusBar` rendered, drag-resize via Y-axis mouse events, `handleProblemClick` wired to `jumpToProblem`. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src-tauri/src/commands/explorer.rs` | `src-tauri/src/validation/` | `detect_and_decode` + `validate_characters` calls | WIRED | Lines 2-3: `use crate::validation::{detect_and_decode, validate_characters}`. Lines 128-134: both functions called in `read_file_cmd`. |
| `src/features/explorer/store.ts` | `src/features/explorer/types.ts` | `ValidationProblem` type import | WIRED | Line 8: `import type { ..., ValidationProblem, ValidationStatus, } from "./types"`. |
| `src/features/explorer/components/folder-tree-node.tsx` | `src/features/explorer/store.ts` | `validationCache` access for badge | WIRED (non-reactive) | Line 175: `useExplorerStore.getState().getValidationStatus(node.path)`. Structurally wired but non-reactive due to `getState()` anti-pattern. |
| `src/features/explorer/components/file-content-area.tsx` | `problems-panel.tsx` | JSX composition | WIRED | Lines 9, 210-216 and 220-226: `<ProblemsPanel problems={...} isOpen={...} onToggle={...} onProblemClick={...} />`. |
| `src/features/explorer/components/file-content-area.tsx` | `validation-status-bar.tsx` | JSX composition at bottom | WIRED | Lines 10, 230-235: `<ValidationStatusBar errorCount={...} ... onClick={toggleProblemsPanel} />`. |
| `src/features/explorer/components/xml-source-view.tsx` | `use-validation-decorations.ts` | Hook call with editor instance | WIRED | Line 6: import. Line 90: `useValidationDecorations(editorMounted, problems ?? [])`. |
| `src/features/explorer/components/problems-panel.tsx` | `src/features/explorer/store.ts` | `jumpToProblem` via `onProblemClick` | WIRED | `ProblemsPanel.onProblemClick` -> `file-content-area.tsx:handleProblemClick` -> `jumpToProblem(activeTabId, line, column)`. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `folder-tree-node.tsx` | `validationStatus` | `useExplorerStore.getState().getValidationStatus(node.path)` via `validationCache` | Yes -- cache populated by `openFile` action from real IPC response | HOLLOW_REACTIVE -- data is real but non-reactive read means badge won't update until component re-renders for unrelated reason |
| `problems-panel.tsx` | `problems` | `activeTab.problems` from store (set in `openFile` from IPC response `result.problems`) | Yes -- populated from Rust `validate_characters` output | FLOWING |
| `validation-status-bar.tsx` | `errorCount`, `warningCount`, `encoding` | Derived from `activeTab.problems` and `activeTab.encoding` in `file-content-area.tsx` | Yes | FLOWING |
| `use-validation-decorations.ts` | `problems` | Passed from `XmlSourceView`, which receives from `file-content-area.tsx` `activeTab.problems` | Yes | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Rust validation tests | `cd src-tauri && cargo test -- validation` | 19/19 pass | PASS |
| Frontend tests | `npm run test -- --run` | 176/176 pass | PASS |
| TypeScript build | `npm run build` | Builds successfully | PASS |
| ESLint | `node_modules/.bin/eslint src/` | No output (no errors) | PASS |

### Probe Execution

No probe scripts defined for this phase. Step 7c: SKIPPED (no `scripts/*/tests/probe-*.sh` found).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| VALD-01 | 04-01-PLAN.md | App detects XML-invalid characters (unescaped entities, control characters, null bytes) and encoding issues | PARTIAL | Null bytes, control chars, FFFD, encoding issues detected. Unescaped `&`, `<`, `>` NOT implemented despite being explicitly called out in requirement text, D-06, D-12, and plan task 1 spec. |
| VALD-02 | 04-01-PLAN.md | Files with detected issues show a red badge/icon in the folder tree | PARTIAL | Badge logic and colors correct. Stale `getState()` read means badge does not update reactively after validation completes. |
| VALD-03 | 04-02-PLAN.md | Problems panel lists all detected issues with line number, column, description, severity, click-to-jump | VERIFIED | `ProblemsPanel` + `ProblemRow` + `jumpToProblem` fully implemented and wired. |
| VALD-04 | 04-02-PLAN.md | Source view highlights bad characters inline with gutter markers on affected lines | VERIFIED | `useValidationDecorations` creates glyph margin, inline highlight, overview ruler decorations. `glyphMargin: true`, `overviewRulerLanes: 2` set. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/features/explorer/components/folder-tree-node.tsx` | 175 | `useExplorerStore.getState().getValidationStatus()` in render | BLOCKER | Badge reads state without subscribing -- does not update reactively when `validationCache` is updated after file open. Core Phase 4 visual feature (tree badge) is effectively broken in normal usage flow. |
| `src/features/explorer/components/folder-tree-node.tsx` | 278, 281 | `useExplorerStore.getState().tabs` in render | WARNING | Context menu enabled state is stale (does not affect Phase 4 goal directly). |
| `src-tauri/src/validation/validator.rs` | 3 | Doc comment claims "unescaped entities" not implemented | WARNING | Misleading documentation; the comment says the function checks unescaped entities but it does not. |

### Human Verification Required

None identified. The gaps above are deterministically verifiable from code inspection.

### Gaps Summary

Two gaps block full goal achievement:

**Gap 1: Unescaped entity detection missing from validator (VALD-01, PARTIAL)**

VALD-01 explicitly requires detecting "unescaped entities" alongside control characters and null bytes. The plan task 1 spec enumerates `unescaped-ampersand`, `unescaped-less-than`, and `unescaped-greater-than` error codes. The CONTEXT document D-06 and D-12 both list unescaped `&`, `<`, `>` as required error checks. The implemented validator detects null bytes, control chars, FFFD with decode errors, bare CR, BOM, and non-UTF8 encoding -- but has no code for any of the three unescaped-entity checks.

Note: The REVIEW.md (CR-02) documents this as a known issue: implementing the checks naively flags every XML tag delimiter as an error (massive false positives on valid XML files). The fix is either to implement minimal context-awareness or to formally scope-reduce VALD-01 to exclude unescaped entity detection in Phase 4.

**Gap 2: Validation badge in tree sidebar is non-reactive (VALD-02, PARTIAL)**

The tree badge (red/yellow dot for error/warning) reads validation status via `useExplorerStore.getState().getValidationStatus()` during component render. Zustand's `getState()` does NOT subscribe the component to state changes. When a file is opened and `validationCache` is populated by the async `openFile` action, the tree node component is NOT re-rendered. The badge only appears if the tree re-renders for an unrelated reason (e.g., folder expand/collapse). The fix is a one-line change: replace the `getState()` call with a reactive `useExplorerStore()` selector.

---

_Verified: 2026-05-26T15:30:00Z_
_Verifier: Claude (gsd-verifier)_
