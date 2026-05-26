---
phase: 03-xml-file-viewing
plan: 01
subsystem: explorer-file-viewing
tags: [tauri-command, zustand-store, monaco-editor, tab-management, file-reading]
dependency_graph:
  requires: [phase-02-folder-sources-tree-sidebar]
  provides: [read-file-cmd, tab-state, xml-source-view, file-tab-bar]
  affects: [explorer-shell, folder-tree, explorer-empty-state]
tech_stack:
  added: [tauri-plugin-clipboard-manager, monaco-xml-loader]
  patterns: [tdd-red-green, lazy-monaco-loading, zustand-tab-state, rust-spawn-blocking-timeout]
key_files:
  created:
    - src/features/explorer/utils/file-size-format.ts
    - src/features/explorer/utils/tab-disambiguator.ts
    - src/features/explorer/utils/file-size-format.test.ts
    - src/features/explorer/utils/tab-disambiguator.test.ts
    - src/features/explorer/store.test.ts
    - src/lib/monaco-xml-loader.ts
    - src/features/explorer/components/file-tab-bar.tsx
    - src/features/explorer/components/file-tab.tsx
    - src/features/explorer/components/file-content-area.tsx
    - src/features/explorer/components/file-content-header.tsx
    - src/features/explorer/components/xml-source-view.tsx
  modified:
    - src-tauri/Cargo.toml
    - src-tauri/src/commands/explorer.rs
    - src-tauri/src/commands/mod.rs
    - src-tauri/src/lib.rs
    - src-tauri/capabilities/default.json
    - src/features/explorer/types.ts
    - src/services/tauri.ts
    - src/features/explorer/services/explorer-service.ts
    - src/features/explorer/store.ts
    - src/features/explorer/components/explorer-shell.tsx
    - src/features/explorer/components/explorer-empty-state.tsx
    - src/features/explorer/components/folder-tree-node.tsx
    - src/features/explorer/components/folder-tree.tsx
    - package.json
    - package-lock.json
decisions:
  - "TDD approach: RED tests first, then GREEN implementation, no refactor needed"
  - "Monaco XML loader follows existing SQL loader singleton pattern"
  - "Tab state co-located in existing explorer Zustand store (not separate store)"
  - "File tab keyed by filePath to force Monaco remount on tab switch"
metrics:
  duration: 9m
  completed: "2026-05-26T15:42:00Z"
---

# Phase 03 Plan 01: Core File Viewing Slice Summary

Tabbed file viewer with Rust backend file reading, Zustand tab management, and Monaco XML syntax highlighting

## Commits

| Task | Name | Commit | Type |
|------|------|--------|------|
| 1 (RED) | Failing tests for utilities and store | b9830f6 | test |
| 1 (GREEN) | Backend file reading + store + utilities | bc01f9f | feat |
| 2 | Tab bar, content area, source view, shell wiring | 8356e3c | feat |

## What Was Built

**Rust Backend:**
- `read_file_cmd` Tauri command: reads file content with 30s timeout via `tokio::spawn_blocking`
- `FileContent` struct with `content: String` and `size: u64`
- `tauri-plugin-clipboard-manager` registered in plugin chain
- Capabilities: `opener:allow-open-path`, `clipboard-manager:allow-write-text`

**TypeScript Types and Services:**
- `ViewMode`, `FileContent`, `FileTab` types in explorer types
- `readFile` method in `tauri.ts` IPC wrapper and `explorer-service.ts`

**Store Extension:**
- Tab state (`tabs: FileTab[]`, `activeTabId: string | null`)
- Actions: `openFile`, `closeTab`, `closeOtherTabs`, `closeAllTabs`, `setActiveTab`, `setViewMode`, `setScrollPosition`
- Disambiguation: tab names recomputed on every tab change

**Utilities:**
- `formatFileSize`: human-readable file size formatting (B, KB, MB, GB)
- `disambiguateTabNames`: resolves duplicate filenames with parent folder suffix

**Components:**
- `FileTabBar`: horizontal scrollable tab container with hidden scrollbar
- `FileTab`: individual tab with context menu, tooltip, close button, middle-click
- `FileContentArea`: renders header + source/tree view based on active tab state
- `FileContentHeader`: filename, file size, tree/source segmented toggle, action buttons
- `XmlSourceView`: Monaco Editor wrapper with XML/plaintext, code folding, scroll persistence
- `monaco-xml-loader.ts`: lazy XML language contribution loader (singleton)

**Shell Integration:**
- `ExplorerShell` conditionally renders tabs+content when files open, empty state otherwise
- `ExplorerEmptyState` message updated: "Click a file in the sidebar to open it."
- `FolderTreeNode` file nodes now clickable with `cursor-pointer` and `hover:bg-muted`
- `FolderTree` passes `onFileClick` to all 3 FolderTreeNode/FolderTreeSourceNode render sites

## Tests

- 24 new tests across 3 test files (8 file-size, 5 tab-disambiguator, 11 store tab management)
- Full suite: 164 tests passing
- cargo check: passes
- npm run build: passes (TypeScript compiles)
- npm run lint: passes (no errors)

## Deviations from Plan

None - plan executed exactly as written.

## TDD Gate Compliance

- RED gate commit exists: `b9830f6` (test)
- GREEN gate commit exists: `bc01f9f` (feat)
- No REFACTOR gate needed (code was clean after GREEN)

## Known Stubs

| File | Line | Stub | Reason |
|------|------|------|--------|
| file-content-header.tsx | Copy/ClipboardCopy buttons | onClick handlers are no-op | Plan 03 implements file actions hook |
| file-content-area.tsx | Tree view branch | Placeholder "Tree view coming soon" | Plan 02 implements XmlTreeView |

These stubs are intentional -- they represent work explicitly scheduled for Plans 02 and 03.

## Self-Check: PASSED

- All 20 key files: FOUND
- All 3 commits: FOUND (b9830f6, bc01f9f, 8356e3c)
- Build: PASSED
- Tests: 164/164 PASSED
- Lint: PASSED
- cargo check: PASSED
