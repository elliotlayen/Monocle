---
phase: 02-folder-sources-tree-sidebar
plan: 02
subsystem: settings-folder-sources
tags: [react, dnd-kit, settings, folder-sources, tauri-dialog]
dependency_graph:
  requires: [explorer-rust-commands, explorer-types, explorer-store, explorer-service]
  provides: [folder-sources-settings-ui, empty-state-guidance]
  affects: [app-settings-sheet, explorer-empty-state]
tech_stack:
  added: ["@dnd-kit/core", "@dnd-kit/sortable"]
  patterns: [DndContext-SortableContext-useSortable, debounced-persist-500ms, inline-edit-with-local-state]
key_files:
  created:
    - src/features/settings/components/sections/folder-sources-section.tsx
    - src/features/settings/components/sections/folder-source-row.tsx
  modified:
    - src/components/app-settings-sheet.tsx
    - src/features/explorer/components/explorer-empty-state.tsx
    - package.json
    - package-lock.json
decisions:
  - "Used local state + debounced persist pattern to avoid IPC flood on every keystroke"
  - "FolderSourceRow uses useSortable with CSS.Transform for drag animation"
  - "Path reachability check fires on input blur (not on every change) for performance"
  - "Empty state reads store directly rather than accepting hasSources as prop"
metrics:
  duration: "3m 27s"
  completed: "2026-05-22T22:13:49Z"
  tasks_completed: 2
  tasks_total: 2
  tests_added: 0
  files_created: 2
  files_modified: 4
---

# Phase 2 Plan 2: Settings Folder Sources UI Summary

Full CRUD settings section with drag-to-reorder via @dnd-kit, native folder picker, path reachability validation, and contextual empty state messaging.

## Task Results

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Install dependencies and create folder source settings components | daf4953 | folder-sources-section.tsx, folder-source-row.tsx, package.json |
| 2 | Wire settings section into dialog and update empty state | 14392fe | app-settings-sheet.tsx, explorer-empty-state.tsx |

## What Was Built

### Task 1: Folder Source Settings Components
- **FolderSourceRow** -- sortable row with GripVertical drag handle, label input (w-32), path input (flex-1), tag input (w-24), FolderSearch browse button, Trash2 remove button
- **FolderSourcesSection** -- DndContext with closestCenter collision detection, SortableContext with verticalListSortingStrategy, Plus/Add Source button, empty state centered text
- Path validation: onBlur triggers `explorerService.checkPathReachable()`, displays "Path unreachable -- check VPN connection" in text-yellow-600
- Browse: calls `open({ directory: true })` from `@tauri-apps/plugin-dialog`
- Persistence: 500ms debounced save via `reorderSources()` + `saveSources()` to avoid IPC flood
- Dependencies: `@dnd-kit/core@^6.3.1`, `@dnd-kit/sortable@^10.0.0`

### Task 2: Settings Dialog Integration and Empty State
- **app-settings-sheet.tsx** -- added `"sources"` to SettingsSectionId union, added `{ id: "sources", label: "Sources", icon: FolderSync }` between Appearance and About, added switch case rendering FolderSourcesSection
- **explorer-empty-state.tsx** -- reads folderSources from useExplorerStore, shows contextual messaging:
  - No sources: "Add a folder source in Settings to get started." + Open Settings button
  - Has sources: "Expand a source in the sidebar to browse folders." (no button)

## Verification

- `npm run build` -- TypeScript compiles, Vite builds successfully
- `npm run lint` -- no errors
- `npm run test -- --run` -- all 140 tests pass (21 test files)

## Deviations from Plan

None -- plan executed exactly as written.

## Known Stubs

None. All data flows are fully wired: settings UI mutates local state, debounce persists to store, store delegates to settingsService IPC. Empty state reads from store and displays contextual messaging.

## Self-Check: PASSED

- [x] `src/features/settings/components/sections/folder-sources-section.tsx` exists
- [x] `src/features/settings/components/sections/folder-source-row.tsx` exists
- [x] Commit daf4953 exists in git log
- [x] Commit 14392fe exists in git log
