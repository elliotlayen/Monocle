---
phase: 06-search
plan: 02
subsystem: explorer-search-ui
tags: [search, ui, components, sidebar, streaming-results]
dependency_graph:
  requires: [content_search_cmd, SearchSummary, SearchResultFile, searchResultHub, searchProgressHub, search-store-state]
  provides: [SearchBar, SearchControlsRow, SearchResults, SearchResultGroup, SearchResultRow, SearchProgress, useSearch-hook]
  affects: [explorer-sidebar]
tech_stack:
  added: []
  patterns: [segmented-toggle, conditional-rendering, event-subscription, folder-grouping]
key_files:
  created:
    - src/features/explorer/components/search-bar.tsx
    - src/features/explorer/components/search-controls-row.tsx
    - src/features/explorer/components/search-progress.tsx
    - src/features/explorer/components/search-result-group.tsx
    - src/features/explorer/components/search-result-row.tsx
    - src/features/explorer/components/search-results.tsx
    - src/features/explorer/hooks/use-search.ts
  modified:
    - src/features/explorer/components/explorer-sidebar.tsx
decisions:
  - "SearchBar uses native button elements for segmented toggle instead of Radix ToggleGroup for lighter DOM"
  - "useSearch hook validates operationId via getState() call for latest value rather than stale closure"
  - "No-selection prompt renders above FolderTree (not replacing it) so tree remains navigable in content mode"
  - "Scope label for SearchResults derived from store searchSummary.scopeLabel when available, falling back to live computation"
metrics:
  duration: 343s
  completed: 2026-05-28
  tasks_completed: 2
  tasks_total: 2
  files_created: 7
  files_modified: 1
---

# Phase 06 Plan 02: Search UI Components Summary

Complete search UI with unified search bar, Filename/Content toggle, scope-aware content search controls, streaming results display grouped by folder, and inline progress indicator with cancel.

## What Was Built

### Task 1: SearchBar, SearchControlsRow, and Sidebar Wiring
- SearchBar component: unified input with Search icon, X clear button, and Filename/Content segmented toggle with tooltips
- Input has role="searchbox", toggle container has role="group" with aria-pressed on each button
- Placeholder text changes dynamically: "Search files..." vs "Search file contents..."
- Enter key in content mode triggers search execution via onSearchExecute prop
- SearchControlsRow component: scope dropdown (folder/source/all), file pattern input (default *.xml), Search Files button
- Scope dropdown disabled when searchStatus is not idle (D-13 lock)
- Search Files button disabled when no folder selected and scope is not "all" (D-11)
- ExplorerSidebar: replaced old filter input with SearchBar, conditionally renders SearchControlsRow in content mode
- Scope auto-update useEffect: sets scope to "folder" when tree selection changes while idle (D-13)

### Task 2: SearchResults, Result Components, useSearch Hook, and Conditional Rendering
- useSearch hook: subscribes to searchResultHub and searchProgressHub via useTauriEvent, validates operationId on all incoming events (T-06-05 threat mitigation)
- resolveSearchScope utility function: converts scope enum + paths to { paths, label } for startContentSearch
- SearchProgress component: Loader2 spinner, "Searching... N of M files" text, Stop Search button with role="status" aria-live="polite"
- SearchResultGroup: collapsible folder header with ChevronDown/ChevronRight, Folder icon, file count; error variant with AlertCircle and destructive styling; files sorted alphabetically (D-20)
- SearchResultRow: FileText icon with match count ("1 match" singular, "N matches" plural); error variant with AlertCircle and error message
- SearchResults container: summary header with stats and clear button, SearchProgress inline during search, grouped results via Map, error group last and collapsed by default, no-results message ("No matches found"), ScrollArea wrapper
- ExplorerSidebar conditional rendering: SearchResults when content search active/has results, "Select a folder" prompt when content mode with no selection, FolderTree otherwise

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- `npm run build` -- TypeScript compiles successfully with all 7 new components
- `npm run lint` -- no lint errors
- `npm run test -- --run` -- 200 tests pass (30 test files)

## Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | SearchBar, SearchControlsRow, sidebar wiring | 9f2418f | search-bar.tsx, search-controls-row.tsx, explorer-sidebar.tsx |
| 2 | SearchResults, result components, useSearch hook | 7acb067 | search-results.tsx, search-result-group.tsx, search-result-row.tsx, search-progress.tsx, use-search.ts, explorer-sidebar.tsx |

## Self-Check: PASSED

All 7 created files verified present on disk. Both commits (9f2418f, 7acb067) verified in git log. No unexpected file deletions. No untracked files remaining.
