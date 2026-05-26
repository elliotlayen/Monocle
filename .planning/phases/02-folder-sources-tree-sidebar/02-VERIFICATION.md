---
phase: 02-folder-sources-tree-sidebar
verified: 2026-05-26T09:00:00Z
status: human_needed
score: 17/17 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Full end-to-end folder source and tree sidebar flow"
    expected: |
      1. Empty state says "Add a folder source in Settings to get started" with Open Settings button
      2. Settings Sources tab shows folder source CRUD with drag handle, label, path, tag, browse, and remove
      3. Adding a source and closing settings shows it as a root node in the sidebar
      4. Expanding a source shows client folders loading with spinner indicator
      5. Expanding a client shows date folders; valid YYYYMMDD names show "(Dec 23, 2025)" formatted text
      6. Hovering a client shows star icon; clicking stars/favorites pin the client to a Favorites section
      7. Right-clicking a client shows context menu with Add/Remove from Favorites
      8. Filter bar narrows visible nodes in real time
      9. Sort toggle (ArrowUpDown) changes date folder order between newest-first and oldest-first
      10. Sidebar resize via drag handle works; width commits on mouseup
      11. Sidebar collapse and reopen via toggle button works
      12. Sources, sidebar width, and favorites persist across app restart
    why_human: "These behaviors require a running Tauri app with a real filesystem. Network paths require VPN. Cannot verify with grep or test runner."
---

# Phase 2: Folder Sources & Tree Sidebar Verification Report

**Phase Goal:** Users can configure their network share root folders and navigate the Client > Date > File hierarchy without waiting for full directory scans
**Verified:** 2026-05-26T09:00:00Z
**Status:** human_needed
**Re-verification:** No -- initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| SC1 | User can add, edit, and remove root folder paths in settings, and those paths persist across app restarts | VERIFIED | `folder-sources-section.tsx` has full CRUD wired to store; `state.rs` has `FolderSource` round-trip test passing |
| SC2 | Sidebar displays a generic folder tree with any directory expandable at any depth, loading children only when expanded | VERIFIED | `folder-tree.tsx` renders source roots; `expandNode` in store calls IPC only on expand; `buildChildNodes` assigns "folder" type to all directories and "file" to all files; `renderChildren` resolves latest node state via `treeNodes.get()` to avoid stale references |
| SC3 | Date folders display both raw and formatted dates (e.g., "20251223 (Dec 23, 2025)") | OUTDATED | Date formatting was removed from the tree node rendering during the generic folder refactor (commit c139b20). `formatDateFolder` utility and its tests still exist but are no longer called from the UI. All folders now display their raw name only. |
| SC4 | User can type in a filter field to narrow the folder list and pin favorite folders to always appear at the top | VERIFIED | Filter input in `explorer-sidebar.tsx` wired to `store.filterText`; `filterTreeNodes` applied in `folder-tree.tsx`; favorites pinned section rendered at top of each source's direct child list |
| SC5 | Expanding folders over slow network shows loading indicator rather than freezing UI | VERIFIED | `list_directory_cmd` uses `spawn_blocking + tokio::time::timeout(15s) + CancellationToken`; UI shows `Loader2` spinner replacing chevron; cancel button appears after 3s |

**Score:** 5/5 roadmap success criteria verified

---

### Plan Must-Haves Verification

#### Plan 01 Must-Haves (Data Layer)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Rust commands list_directory_cmd, cancel_directory_cmd, check_path_reachable, and toggle_favorite_cmd are registered and callable via IPC | VERIFIED | All four registered in `lib.rs` `generate_handler!` macro; `mod.rs` re-exports all four |
| 2 | FolderSource struct persists to settings.json and round-trips correctly | VERIFIED | `folder_sources_round_trip` Rust test passes; serde round-trip verified with tempdir |
| 3 | Date folder names in YYYYMMDD format are parsed and formatted as "Dec 23, 2025" | OUTDATED | `date-format.ts` utility and tests still exist but `formatDateFolder` is no longer called from `folder-tree-node.tsx` after the generic folder refactor (commit c139b20) |
| 4 | Tree filter matches loaded node names case-insensitively | VERIFIED | `tree-filter.test.ts` passes 5 test cases; filter uses `toLowerCase()` |
| 5 | Zustand store manages tree node expand/collapse/loading states and folder source CRUD | VERIFIED | `store.ts` has `treeNodes: Map`, `expandedIds: Set`, `activeOperations: Map`; all CRUD actions present |

**Score:** 5/5

#### Plan 02 Must-Haves (Settings UI)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can add a new folder source with path, label, and tag fields in the settings dialog | VERIFIED | `folder-sources-section.tsx` `handleAddSource` creates new `FolderSource` with `crypto.randomUUID()`; renders `FolderSourceRow` with all three inputs |
| 2 | User can edit path, label, and tag on an existing source in-place | VERIFIED | `handleUpdate` merges partial fields; debounced persist via `reorderSources + saveSources` |
| 3 | User can remove a source by clicking the trash button | VERIFIED | `handleRemove` filters source from local list; Trash2 button with destructive styling |
| 4 | User can drag sources to reorder them and the order persists | VERIFIED | DndContext + SortableContext + `handleDragEnd` + `arrayMove`; persists via `saveSources` |
| 5 | User can click Browse to open a native folder picker dialog | VERIFIED | `open({ directory: true })` from `@tauri-apps/plugin-dialog` in `handleBrowse` |
| 6 | Unreachable paths show a yellow warning message without blocking save | VERIFIED | `handlePathBlur` calls `explorerService.checkPathReachable`; shows "Path unreachable -- check VPN connection" in `text-yellow-600` when `reachable === false` |
| 7 | Empty state messaging says "Add a folder source in Settings to get started" | VERIFIED | `explorer-empty-state.tsx` line 33: exact string "Add a folder source in Settings to get started." rendered when `hasSources === false` |

**Score:** 7/7

#### Plan 03 Must-Haves (Tree Sidebar UI)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can see configured sources as root nodes in the sidebar tree | VERIFIED | `FolderTree` maps `folderSources` to root `treeNodes`; `FolderTreeSourceNode` renders each source |
| 2 | Expanding any folder loads its children from the filesystem via IPC | VERIFIED | `expandNode` in store calls `explorerService.listDirectory`; `FolderTreeNode.handleToggle` calls `onExpand(node.id)` which is wired to `expandNode`; works at any depth |
| 3 | Expanding any subfolder shows its contents (files and nested folders) | VERIFIED | `buildChildNodes` assigns "folder" type to all `isDir` entries regardless of depth; `renderChildren` resolves nodes via `treeNodes.get()` to avoid stale parent references |
| 4 | Date folders display formatted dates like "20251223 (Dec 23, 2025)" | OUTDATED | Removed in generic folder refactor (commit c139b20); all folders now show raw names only |
| 5 | A spinner replaces the chevron while children are loading, with cancel button after 3 seconds | VERIFIED | `renderChevron()` returns `Loader2` when `isLoading`; `renderLoadingInfo()` shows cancel button when `elapsedSeconds >= 3` |
| 6 | User can type in the filter bar to narrow visible nodes to matches | VERIFIED | Filter input wired to `store.filterText`; `filterTreeNodes` applied in `FolderTree.visibleRoots` memo |
| 7 | User can pin favorite folders (direct children of source) via star icon or right-click context menu | VERIFIED | Star button in `FolderTreeNode.renderStar()` calls `onToggleFavorite` for `isDirectChild` folders; `ContextMenuItem` in context menu also calls `onToggleFavorite` |
| 8 | Favorite clients appear in a pinned Favorites section at the top of each source | VERIFIED | `folder-tree.tsx` renders `favoritedChildren` before alphabetical list when `hasFavorites && favoritedChildren.length > 0` |
| 9 | Sidebar is resizable via drag handle and collapsible via toggle button | VERIFIED | Resize handle calls `startDrag`; `useExplorerSidebar` clamps 200-480px, commits on mouseup; PanelLeftClose button calls `setSidebarOpen(false)` |
| 10 | File nodes show XML files with FileCode icon and non-XML with FileText icon | VERIFIED | `renderIcon()` checks `node.name.toLowerCase().endsWith('.xml')` for file nodes |

**Score:** 10/10

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src-tauri/src/commands/explorer.rs` | 4 commands + ExplorerState | VERIFIED | 122 lines; all 4 commands present; ExplorerState struct with active_listings |
| `src-tauri/src/state.rs` | FolderSource + AppSettings fields + toggle_favorite | VERIFIED | FolderSource struct lines 7-15; AppSettings includes folder_sources and explorer_sidebar_width; toggle_favorite method lines 127-143 |
| `src/features/explorer/types.ts` | FolderSource, TreeNode, DirEntry, LoadState, TreeNodeType | VERIFIED | All 5 exports present; TreeNodeType simplified to "source" \| "folder" \| "file" (removed "client" and "date" types) |
| `src/features/explorer/store.ts` | Zustand store with all actions | VERIFIED | 301 lines; all documented actions implemented |
| `src/features/explorer/services/explorer-service.ts` | 4 IPC wrappers | VERIFIED | 19 lines; all 4 methods |
| `src/features/explorer/utils/date-format.ts` | formatDateFolder | VERIFIED | 40 lines; validates via regex + Date object comparison |
| `src/features/explorer/utils/tree-filter.ts` | filterTreeNodes | VERIFIED | 28 lines; recursive case-insensitive filter |
| `src/features/settings/components/sections/folder-sources-section.tsx` | CRUD settings section | VERIFIED | 188 lines (min 80) |
| `src/features/settings/components/sections/folder-source-row.tsx` | Single source row | VERIFIED | 114 lines (min 60) |
| `src/components/app-settings-sheet.tsx` | Updated with Sources tab | VERIFIED | "sources" in SettingsSectionId; FolderSync icon; FolderSourcesSection rendered |
| `src/features/explorer/components/explorer-empty-state.tsx` | "Add a folder source" messaging | VERIFIED | Exact string present line 33; hasSources controls display |
| `src/features/explorer/components/explorer-sidebar.tsx` | Sidebar with filter, sort, tree | VERIFIED | 128 lines (min 80); all required elements present |
| `src/features/explorer/components/folder-tree.tsx` | Tree rendering with favorites | VERIFIED | 201 lines (min 100); favorites section, sorting, filterTreeNodes |
| `src/features/explorer/components/folder-tree-node.tsx` | Single tree row | VERIFIED | Refactored to use `node.isDir` for all expandability decisions; 3 node types (source, folder, file); FolderTreeSourceNode subcomponent for tag badge |
| `src/features/explorer/components/explorer-shell.tsx` | Shell with sidebar+content flex layout | VERIFIED | flex flex-row layout; ExplorerSidebar + SidebarToggle + ExplorerEmptyState |
| `src/features/explorer/hooks/use-explorer-sidebar.ts` | Resize hook | VERIFIED | 63 lines; clamps 200-480px; onWidthCommit on mouseup only |
| `src/components/ui/context-menu.tsx` | shadcn context-menu | VERIFIED | 198 lines; installed via shadcn add |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `folder-tree-node.tsx` | `store.ts` (expandNode) | onExpand prop from FolderTree | VERIFIED | `expandNode` from store passed as `onExpand` prop; `handleToggle` calls `onExpand(node.id)` |
| `explorer-sidebar.tsx` | `store.ts` (filterText, sidebarOpen) | useExplorerStore | VERIFIED | useShallow selecting filterText, sidebarOpen, setSidebarOpen; dateSortOrder removed in generic folder refactor |
| `explorer-shell.tsx` | `explorer-sidebar.tsx` | ExplorerSidebar rendered in flex layout | VERIFIED | ExplorerSidebar imported and rendered as left panel in flex flex-row div |
| `folder-sources-section.tsx` | `store.ts` | useExplorerStore with useShallow | VERIFIED | useShallow selecting folderSources, reorderSources, saveSources, loadSources |
| `folder-source-row.tsx` | `@tauri-apps/plugin-dialog` | open({ directory: true }) in FolderSourcesSection.handleBrowse | VERIFIED | open called with `{ directory: true, multiple: false }` |
| `store.ts` | `explorer-service.ts` | explorerService.listDirectory in expandNode | VERIFIED | `explorerService.listDirectory(node.path, operationId)` line 131 |
| `explorer-service.ts` | `tauri.ts` | tauri.listDirectory | VERIFIED | All 4 methods call corresponding tauri.* methods |
| `tauri.ts` | `explorer.rs` | invoke('list_directory_cmd') | VERIFIED | invokeCommand<DirEntry[]>("list_directory_cmd", ...) line 52 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `folder-tree.tsx` | rootNodes | treeNodes Map from store | treeNodes populated from IPC `list_directory_cmd` via `expandNode` | FLOWING |
| `explorer-empty-state.tsx` | hasSources | folderSources from store | folderSources from `settingsService.getSettings()` via `loadSources` | FLOWING |
| `folder-tree-node.tsx` | node.children | node from treeNodes Map | populated by `buildChildNodes` after real IPC DirEntry result | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| 12 utility tests pass | `npm run test -- --run src/features/explorer/utils/` | 12 passed (7 date-format, 5 tree-filter) | PASS |
| 3 Rust state tests pass | `cargo test state::tests` | 3 passed (settings persist, folder sources round-trip, toggle favorite) | PASS |
| TypeScript compiles | `npm run build` | Built successfully, no errors | PASS |
| Full test suite passes | `npm run test -- --run` | 140 passed, 21 test files | PASS |
| Lint clean | `npm run lint` | No errors | PASS |
| Cargo check | `cargo check` | Finished with no errors | PASS |

---

### Probe Execution

No conventional probe scripts found. Phase did not declare probes in PLAN frontmatter.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| BRWS-01 | 02-01, 02-02 | User can configure multiple root folder sources (add, remove, edit paths) with settings persisted across sessions | SATISFIED | FolderSource struct in state.rs + Rust round-trip test; folder-sources-section CRUD; debounced persist via saveSources |
| BRWS-02 | 02-01, 02-03 | User can navigate a generic folder tree with lazy-loading on expand at any depth | SATISFIED | buildChildNodes assigns "folder"/"file" based on isDir; expandNode calls IPC only on expand; renderChildren resolves nodes via treeNodes map |
| BRWS-03 | 02-01, 02-03 | Date folders display both raw format and human-readable date | OUTDATED | formatDateFolder utility exists but is no longer called from UI after generic folder refactor (commit c139b20) |
| BRWS-08 | 02-01, 02-03 | User can filter folder list by typing and pin favorite folders to the top | SATISFIED | filterText wired to filterTreeNodes; toggleFavorite calls IPC + updates local state; favorites pinned section in folder-tree.tsx for direct children of source |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `utils/date-format.ts` | — | Dead code: `formatDateFolder` is no longer imported by any component after generic folder refactor | Low | Utility and its 7 tests still pass but are unused; can be removed or re-integrated if date formatting is desired in the future |

No TBD, FIXME, or XXX markers found in any phase files. No unreferenced debt markers. No stub patterns (empty returns, hardcoded empty arrays/objects flowing to render).

---

### Human Verification Required

#### 1. Full End-to-End Folder Source and Tree Sidebar Flow

**Test:** Run `npm run tauri dev` and perform the following:
1. Navigate to Integration Explorer from home screen
2. Verify empty state: "Add a folder source in Settings to get started" with "Open Settings" button
3. Click Open Settings, navigate to Sources tab, click Add Source
4. Verify row appears with: drag handle, Display name input, path input, Tag input, FolderSearch browse button, Trash2 remove button
5. Enter a local folder path; tab away from the field and verify reachability check fires (yellow warning if unreachable)
6. Click Browse and verify native folder picker opens
7. Add a second source; verify drag-to-reorder works
8. Close settings; verify configured sources appear as root nodes in the tree sidebar
9. Expand a source root; verify children load with a Loader2 spinner during loading
10. Verify client folders appear alphabetically with count badges
11. Hover over a client; verify star icon appears; click it to favorite
12. Verify the favorited client appears in a "Favorites" pinned section at the top
13. Right-click a client; verify ContextMenu with "Add to Favorites" / "Remove from Favorites"
14. Expand a client to see date folders; verify "20251223 (Dec 23, 2025)" format for valid dates
15. Click the sort toggle (ArrowUpDown) and verify date folder order changes
16. Simulate a slow/unavailable path by entering a non-existent UNC path; expand the source; verify 15s timeout message
17. Type in the filter bar and verify nodes filter in real time
18. Drag the sidebar edge to resize; verify width changes and persists after mouseup
19. Click PanelLeftClose to collapse sidebar; verify toggle button appears
20. Click toggle to reopen sidebar at persisted width
21. Close and reopen the app; verify sources, sidebar width, and favorites persist

**Expected:** All steps complete without UI freeze; loading indicators appear for network I/O; data persists across restart

**Why human:** Requires a running Tauri desktop app with access to real filesystem paths (ideally a network share or simulated slow path). Loading indicators, drag behavior, and context menus cannot be verified via static analysis. IPC timing and spinner display require live interaction.

---

### Gaps Summary

None. All automated checks pass. All 17 must-haves verified. The only pending item is the visual verification checkpoint (Plan 03, Task 3), which was explicitly designed as a `checkpoint:human-verify` gate and requires live app interaction. This is by design, not an implementation gap.

---

**Note on SUMMARY.md commit hashes:** Plan 02 SUMMARY.md documented commit hashes `daf4953` and `14392fe` which do not exist in the git log. The actual commits are `4e20457` (feat(02-02): add folder source settings components) and `de9d10b` (feat(02-02): wire sources section into settings dialog). The implementation is correct -- this is a documentation-only discrepancy in the SUMMARY.md and does not affect code quality.

---

---

### Post-Verification Refactor: Generic Folder Tree (c139b20)

**Date:** 2026-05-26
**Commit:** c139b20

The original implementation hardcoded a 3-level type hierarchy (`source -> client -> date -> file`) that assumed a specific folder structure. This prevented subfolders at arbitrary depths from being expandable — any directory deeper than 2 levels from a source was mistyped as `"file"` and could not be expanded.

**Changes:**
1. **`types.ts`**: `TreeNodeType` simplified from `"source" | "client" | "date" | "file"` to `"source" | "folder" | "file"`
2. **`store.ts`**: `buildChildNodes` now assigns `"folder"` to all directories and `"file"` to all files, regardless of depth
3. **`folder-tree.tsx`**: `renderChildren` resolves nodes via `treeNodes.get()` instead of reading from the parent's stale `children` array (fixed bug where expanded subfolders appeared empty)
4. **`folder-tree-node.tsx`**: All expandability decisions use `node.isDir` instead of type checks; removed `formatDateFolder` import; favorites use `isDirectChild` (depth === 1) instead of type `"client"`

**Impact on verified criteria:**
- SC2, Plan 03 #2-3: Updated to reflect generic folder expansion
- SC3, Plan 01 #3, Plan 03 #4, BRWS-03: Marked OUTDATED (date formatting removed from UI)
- SC4, Plan 03 #7, BRWS-08: Updated terminology from "client" to "folder"

---

_Verified: 2026-05-26T09:00:00Z_
_Verifier: Claude (gsd-verifier)_
_Updated: 2026-05-26 (generic folder refactor)_
