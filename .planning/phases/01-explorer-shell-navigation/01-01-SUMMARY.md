---
phase: 01-explorer-shell-navigation
plan: 01
subsystem: explorer-shell
tags: [explorer, navigation, shell, zustand, mode-state]
dependency_graph:
  requires: []
  provides: [explorer-mode-state, explorer-shell-layout, explorer-nav-bar, explorer-empty-state]
  affects: [App.tsx, schema-graph-store, home-screen]
tech_stack:
  added: []
  patterns: [zustand-mode-union, presentational-component, callback-props]
key_files:
  created:
    - src/features/explorer/store-integration.test.ts
    - src/features/explorer/components/explorer-nav-bar.tsx
    - src/features/explorer/components/explorer-empty-state.tsx
    - src/features/explorer/components/explorer-shell.tsx
  modified:
    - src/features/schema-graph/store.ts
    - src/features/connection/components/home-screen.tsx
    - src/App.tsx
decisions:
  - "Explorer mode only sets mode field, preserving all other store state (no reset like canvas mode)"
  - "exitExplorerMode returns to connected mode, not initial state"
  - "Integration Explorer button placed between Canvas Mode and Settings on home screen"
metrics:
  duration: "4m 11s"
  completed: "2026-05-22"
  tasks_completed: 3
  tasks_total: 3
---

# Phase 01 Plan 01: Explorer Shell & Navigation Summary

Explorer mode as a first-class Zustand mode with three presentational components, home screen button, Cmd+E shortcut, and App.tsx conditional rendering.

## What Was Built

### Task 1: Store extension with TDD (0bf1732)

Extended the Zustand store mode union type from `"connected" | "canvas"` to `"connected" | "canvas" | "explorer"`. Added `enterExplorerMode` and `exitExplorerMode` actions. Unlike canvas mode which resets all state, explorer mode only sets the mode field, preserving schema data, connection info, and all other state fields through a round trip. Four unit tests verify enter, exit, state preservation, and mode distinctness.

### Task 2: Explorer components, wiring, and shortcuts (e704745)

Created three new presentational components following existing codebase patterns:

- **ExplorerNavBar**: Horizontal bar with "Monocle" branding (JetBrains Mono), Home button, and Settings gear button. Uses same CSS as existing Toolbar component. Both buttons wrapped in Tooltip components.
- **ExplorerEmptyState**: Centered layout with FolderSync icon, "Integration Explorer" heading, description text, and "Open Settings" CTA button (default variant).
- **ExplorerShell**: Full-screen flex-column layout composing ExplorerNavBar and ExplorerEmptyState.

Modified HomeScreen to add Integration Explorer button with FolderSync icon and Cmd+E badge, positioned between Canvas Mode and Settings buttons.

Modified App.tsx to:
- Select enterExplorerMode/exitExplorerMode from the store
- Derive isExplorerMode from mode state
- Add handleEnterExplorer/handleExitExplorer callbacks
- Register Cmd+E keyboard shortcut in existing useEffect handler
- Exclude explorer mode from showHome conditional
- Render ExplorerShell when isExplorerMode is true (between HomeScreen and ReactFlowProvider branches)

### Task 3: Visual verification (auto-approved)

Auto-approved in auto-advance mode. All automated verification passed: lint clean, TypeScript build clean, 128 tests passing (including 4 new explorer store tests).

## Verification Results

- `npm run lint`: PASS (clean)
- `npm run build`: PASS (TypeScript compiles without errors)
- `npx vitest run --run`: PASS (128 tests, 19 test files, including 4 new explorer tests)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed AuthType value in test**
- **Found during:** Task 1 GREEN phase
- **Issue:** Test used `authType: "sql"` but the correct value is `"sqlServer"` per the AuthType union type
- **Fix:** Changed to `authType: "sqlServer"` in store-integration.test.ts
- **Files modified:** src/features/explorer/store-integration.test.ts
- **Commit:** 0bf1732

## Self-Check: PASSED

All 7 files exist, both commit hashes verified, all 11 content assertions confirmed.
