---
phase: "04"
plan: "02"
subsystem: validation-ui
tags: [react, monaco, decorations, problems-panel, status-bar, drag-resize]
dependency_graph:
  requires: [validation-engine, extended-read-file-cmd, validation-cache, tree-badges]
  provides: [problems-panel, validation-status-bar, monaco-decorations, click-to-jump]
  affects: [file-content-area, xml-source-view]
tech_stack:
  added: []
  patterns: [monaco-decorations-collection, drag-resize-panel, pending-jump-pattern]
key_files:
  created:
    - src/features/explorer/components/problem-row.tsx
    - src/features/explorer/components/problems-panel.tsx
    - src/features/explorer/components/validation-status-bar.tsx
    - src/features/explorer/hooks/use-validation-decorations.ts
  modified:
    - src/features/explorer/components/file-content-area.tsx
    - src/features/explorer/components/xml-source-view.tsx
decisions:
  - "Used IRange plain object instead of monaco.Range constructor to avoid importing full monaco-editor package (prevents 3.7MB bundle bloat)"
  - "CSS class-based dark mode selectors (.dark .validation-glyph-*) matching existing theme-provider pattern"
  - "Glyph margin deduplication: track highest-severity per line, only assign glyph to first matching decoration"
metrics:
  duration: "4m 45s"
  completed: "2026-05-26T19:11:40Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 4
  files_modified: 2
---

# Phase 4 Plan 02: Validation UI Components Summary

Problems panel, status bar, Monaco gutter/inline decorations, and click-to-jump navigation for the complete single-file validation experience.

## Task Completion

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Problems panel, problem row, and validation status bar components | 04b54f2 | problem-row.tsx, problems-panel.tsx, validation-status-bar.tsx |
| 2 | Content area layout with resizable panel, Monaco decorations hook, and click-to-jump | 3335c12 | use-validation-decorations.ts, file-content-area.tsx, xml-source-view.tsx |

## What Was Built

### Presentational Components (Task 1)

**ProblemRow** (`src/features/explorer/components/problem-row.tsx`):
- Severity icon (CircleAlert red for errors, TriangleAlert amber for warnings)
- Line:column location in monospace font, right-aligned in fixed-width column
- Truncated message description
- Keyboard accessible: tabIndex=0, Enter/Space triggers onClick, role="listitem"

**ProblemsPanel** (`src/features/explorer/components/problems-panel.tsx`):
- VS Code-style collapsible panel with header showing "Problems (N)" count
- Header displays error/warning count indicators with CircleDot and AlertTriangle icons
- Body uses ScrollArea with ProblemRow entries sorted by line then column
- Collapsed state shows only header (isOpen=false hides body)
- ARIA: role="region" aria-label="Problems panel", header aria-expanded

**ValidationStatusBar** (`src/features/explorer/components/validation-status-bar.tsx`):
- Thin 24px bar showing error/warning counts with correct singular/plural
- Encoding label on the right side
- "No problems" text when both counts are zero
- Click toggles problems panel, hover highlights with accent/50
- ARIA: role="status" aria-live="polite" with descriptive aria-label

### Monaco Decorations and Layout Wiring (Task 2)

**useValidationDecorations** (`src/features/explorer/hooks/use-validation-decorations.ts`):
- Side-effect hook accepting editor instance and problems array
- Creates IEditorDecorationsCollection with gutter markers (14px colored circles via ::before pseudo-element)
- Inline highlights with semi-transparent background and bottom border
- Overview ruler markers (red for errors, amber for warnings at OverviewRulerLane.Right)
- Hover messages on both inline decorations and glyph margin
- Per-line glyph deduplication: error severity takes precedence over warning
- Injects CSS styles on first mount using class-based dark mode selectors (.dark prefix)
- Clears old decorations before applying new ones; cleanup on unmount

**XmlSourceView changes** (`src/features/explorer/components/xml-source-view.tsx`):
- glyphMargin: false -> true (enables gutter icon area)
- overviewRulerLanes: 0 -> 2 (enables scrollbar markers)
- Accepts problems, pendingJump, onJumpHandled props
- Uses editorMounted state to pass editor instance to decoration hook
- pendingJump effect: setPosition, revealLineInCenterIfOutsideViewport, focus, then clearPendingJump

**FileContentArea changes** (`src/features/explorer/components/file-content-area.tsx`):
- New layout: source/tree view in flex-1, problems panel below with drag handle, status bar at bottom
- Drag resize: mousedown on 4px handle, mousemove on document (inverted Y-axis), mouseup commits height
- Resize bounds: min 100px, max 50% of content area height
- When panel open: drag handle + panel at stored height
- When panel closed but problems exist: collapsed header only (h-8)
- When no problems and never manually opened: no panel, just status bar
- ValidationStatusBar always visible when file is open
- Passes problems, pendingJump, onJumpHandled through to XmlSourceView

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Full monaco-editor import caused 3.7MB bundle bloat**
- **Found during:** Task 2
- **Issue:** `import * as monaco from "monaco-editor"` for Range constructor pulled entire Monaco editor into the main bundle (index chunk grew from 1.5MB to 5.2MB)
- **Fix:** Used `IRange` plain object interface `{ startLineNumber, startColumn, endLineNumber, endColumn }` instead of `new monaco.Range()`. Monaco's createDecorationsCollection accepts IRange, not just Range instances.
- **Files modified:** src/features/explorer/hooks/use-validation-decorations.ts
- **Commit:** 3335c12

**2. [Rule 1 - Bug] Monaco minimap position type incompatibility**
- **Found during:** Task 2
- **Issue:** TypeScript rejected `minimap: { color: undefined, position: 0 }` because `0` is not assignable to `MinimapPosition` enum type
- **Fix:** Removed minimap option entirely from decorations since minimap is already disabled in editor options
- **Files modified:** src/features/explorer/hooks/use-validation-decorations.ts
- **Commit:** 3335c12

## Verification Results

- `npm run build`: TypeScript compiles, Vite builds successfully (1.5MB index chunk, no bloat)
- `npm run lint`: No lint errors
- `npm run test -- --run`: 176/176 tests pass across 25 test files

## Self-Check: PASSED
