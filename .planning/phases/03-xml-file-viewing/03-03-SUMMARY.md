---
phase: 03-xml-file-viewing
plan: 03
subsystem: explorer-file-actions
tags: [clipboard, external-editor, save-copy, context-menu, tauri-plugins]
dependency_graph:
  requires: [03-01]
  provides: [file-actions-hook, tab-context-menu, file-context-menu]
  affects: [file-content-header, file-tab, folder-tree-node]
tech_stack:
  added: []
  patterns: [useCallback-stateless-hook, tauri-plugin-clipboard-manager, tauri-plugin-opener, tauri-plugin-dialog-save]
key_files:
  created:
    - src/features/explorer/hooks/use-file-actions.ts
  modified:
    - src/features/explorer/components/file-content-header.tsx
    - src/features/explorer/components/file-tab.tsx
    - src/features/explorer/components/folder-tree-node.tsx
decisions:
  - "useFileActions is stateless -- no loading state needed for quick clipboard/OS operations"
  - "Sidebar file context menu disables Copy Content and Save Copy when file is not open in a tab (simpler than on-demand file reading)"
  - "Used useExplorerStore.getState() inline for tab lookup to avoid re-renders when tabs change"
metrics:
  duration: 3m
  completed: "2026-05-26T15:51:00Z"
---

# Phase 03 Plan 03: File Actions Summary

Clipboard copy, external editor launch, and save-copy actions via Tauri plugins wired into header bar, tab context menus, and sidebar file context menus

## Commits

| Task | Name | Commit | Type |
|------|------|--------|------|
| 1 | File actions hook | a449d37 | feat |
| 2 | Wire file actions into header, tabs, and sidebar | 6dbe8c7 | feat |

## What Was Built

**useFileActions hook (src/features/explorer/hooks/use-file-actions.ts):**
- `copyPath(filePath)`: writes file path to clipboard via `@tauri-apps/plugin-clipboard-manager` writeText, shows success toast
- `copyContent(content)`: writes raw file content to clipboard, shows success toast
- `openExternal(filePath)`: opens file in OS default application via `@tauri-apps/plugin-opener` openPath
- `saveCopy(fileName, content)`: opens native save dialog via `@tauri-apps/plugin-dialog` save, writes file via `@tauri-apps/plugin-fs` writeFile
- All four functions wrapped in `useCallback` with no dependencies (args passed directly)
- Error handling with error toasts on all four actions

**FileContentHeader wiring:**
- Copy path button now calls `copyPath(tab.filePath)`
- Copy content button now calls `copyContent(tab.content)`
- Replaces no-op handlers from Plan 01

**FileTab context menu extension:**
- Added separator after Close All
- Added: Copy Path, Open in External Editor, Copy Content (disabled while loading), Save Copy... (disabled while loading)
- Content-dependent actions disabled when `tab.isLoading` is true

**FolderTreeNode file context menu:**
- File nodes now wrapped with ContextMenu (third branch in wrappedRow conditional)
- Copy Path and Open in External Editor always available
- Copy Content and Save Copy... disabled when file is not open in a tab
- Uses `useExplorerStore.getState()` for inline tab lookup (avoids re-renders)

## Deviations from Plan

None -- plan executed exactly as written.

## Self-Check: PASSED

- All 4 key files: FOUND
- All 2 commits: FOUND (a449d37, 6dbe8c7)
- Build: PASSED
- Tests: 164/164 PASSED
- Lint: PASSED
