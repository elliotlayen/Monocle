# Phase 6: Search - Context

**Gathered:** 2026-05-28
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase adds search functionality to the Integration Explorer. Users can filter files by name in the sidebar tree (instant, client-side substring match) or search inside XML file content across multiple files (backend scan with streaming results). A single unified search bar in the sidebar replaces the existing filter input, with a Filename/Content toggle to switch modes. Content search is scoped to a user-selected folder, source root, or all sources, and results stream progressively into the sidebar as files are scanned. No indexing or pre-scanning -- all search is on-demand.

</domain>

<decisions>
## Implementation Decisions

### Search Bar & Toggle
- **D-01:** A single always-visible search bar sits at the top of the sidebar, replacing the existing `filterText` input. No separate client filter -- this one input handles both filename filtering and content search.
- **D-02:** A segmented control toggle next to the search bar switches between "Filename" and "Content" modes. Default mode is Filename.
- **D-03:** In Filename mode, typing instantly filters the tree (client-side substring match against file names and folder/client names). Same behavior as existing `tree-filter.ts` but applied to all loaded nodes regardless of scope.
- **D-04:** In Content mode, a compact controls row appears below the search bar containing: scope dropdown, file pattern input (default `*.xml`), and a Search button. Controls hidden in Filename mode.
- **D-05:** Filename pattern matching is simple substring (case-insensitive). No glob or regex support.
- **D-06:** Content search is always case-insensitive. No case-sensitivity toggle.
- **D-07:** Content search supports multiple space-separated terms with AND logic. All terms must be present in a file for it to match. Quoted strings for exact phrase matching.
- **D-08:** Keyboard shortcuts: Cmd+Shift+F toggles to Content mode and focuses the input. Cmd+F focuses the input in Filename mode.

### Scope Selection
- **D-09:** Three tree-relative scope options: "Selected folder" (recursive), "This source" (the root folder the selection belongs to), "All sources".
- **D-10:** Default scope is "Selected folder" -- narrowest and fastest over VPN.
- **D-11:** If no folder is selected when the user switches to Content mode, show a prompt: "Select a folder in the tree to set search scope" and disable the Search button. Prevents accidental search-everything over VPN.
- **D-12:** Scope dropdown shows the resolved folder/source name (e.g., "Folder: 20251223", "Source: Inbound") rather than generic labels.
- **D-13:** Scope auto-updates with tree selection during search setup (before executing a search). Once a search is running or results are displayed, scope is locked.
- **D-14:** File pattern filter sits in the controls row. Default `*.xml`, configurable (reuses Phase 5 D-03 pattern).
- **D-15:** Scope dropdown and file pattern remember their last-used values within the session. Reset on app restart.

### Results Display
- **D-16:** Content search results replace the folder tree in the sidebar. Tree is fully hidden while results are displayed. Clearing the search input (X button or Escape) restores the tree view.
- **D-17:** Results are grouped by parent folder with collapsible groups. Each file shows filename and total match count. Summary header above results shows total matches, files matched, and scope searched.
- **D-18:** Only matching files appear in results. Total files scanned shown in the summary header for context.
- **D-19:** Results stream progressively as files are scanned, with a progress indicator showing files scanned count and a cancel button. Same event streaming pattern as Phase 5 bulk scan (`app_handle.emit` + frontend event listener).
- **D-20:** Files sorted alphabetically by filename within each folder group.
- **D-21:** No result count limit -- all matching files shown, sidebar scrolls.

### File Opening from Search
- **D-22:** Clicking a search result opens the file in a content tab, scrolled to the first match, with all occurrences of the search term highlighted using Monaco find-match decorations.
- **D-23:** When using multi-term AND search, match count per file is the sum of all term matches combined.

### Mode Switching
- **D-24:** Switching from Content mode (with results showing) to Filename mode clears search results and restores the tree. The search input text is preserved and becomes a filename filter.
- **D-25:** Search query text and mode (Filename/Content) persist when switching to other app modes (Schema Graph, Canvas) and back. Session-only, cleared on app restart.

### Error Handling
- **D-26:** Files that can't be read during content search (permissions, corruption) appear in results with an error icon and error message, grouped separately at the bottom.
- **D-27:** If the network share becomes unreachable during a search, the search aborts immediately with a message: "Network share unreachable. Search stopped after N files." Results found so far are preserved and displayed.

### Backend
- **D-28:** Content search reuses the `detect_and_decode` encoding pipeline from Phase 4/5 (read raw bytes, detect encoding, transcode to UTF-8, then search). Handles non-UTF8 files correctly.
- **D-29:** Backend returns file path and total match count per file. No line numbers or positions returned -- the frontend uses Monaco's built-in find to locate matches when the file is opened.
- **D-30:** No file size limit for content search. Cancel button handles slow searches.
- **D-31:** Content search uses `spawn_blocking` with `std::fs` operations and `CancellationToken` pattern, consistent with `bulk_scan_cmd` (Phase 5 D-08, D-09).

### Claude's Discretion
- **D-CD-01:** Match count display for multi-term AND search: sum of all term matches chosen for relevance signal.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` -- Project overview, constraints (read-only, Tauri 2, lazy loading, cross-platform), folder structure
- `.planning/REQUIREMENTS.md` -- Requirements SRCH-01, SRCH-02, SRCH-03 map to this phase
- `.planning/ROADMAP.md` -- Phase 6 goal, success criteria, and dependencies

### Prior Phase Context
- `.planning/phases/02-folder-sources-tree-sidebar/02-CONTEXT.md` -- Phase 2 decisions on tree sidebar, folder sources, and filter behavior that this phase extends
- `.planning/phases/04-single-file-validation/04-CONTEXT.md` -- Phase 4 decisions on encoding detection/transcoding pipeline (D-05 through D-10) reused for content search
- `.planning/phases/05-bulk-validation-reporting/05-CONTEXT.md` -- Phase 5 decisions on event streaming (D-08, D-09), cancellation pattern (D-04), `spawn_blocking` with `std::fs` (D-31), and directory walking patterns that content search reuses

### Codebase Integration Points
- `src/features/explorer/components/explorer-sidebar.tsx` -- Sidebar component where unified search bar replaces the existing filter input
- `src/features/explorer/utils/tree-filter.ts` -- Existing `filterTreeNodes` function used for filename mode filtering
- `src/features/explorer/store.ts` -- Explorer Zustand store to extend with search state (mode, query, scope, results, progress)
- `src/features/explorer/types.ts` -- Types to extend with search-related types (SearchResult, SearchProgress, SearchScope)
- `src/features/explorer/services/explorer-service.ts` -- Service to extend with content search invocation and event listeners
- `src-tauri/src/commands/explorer.rs` -- New `content_search_cmd` command goes here, following `bulk_scan_cmd` pattern
- `src-tauri/src/validation/mod.rs` -- `detect_and_decode` function reused for encoding detection during content search
- `src/features/explorer/components/xml-source-view.tsx` -- Monaco editor where search term highlighting (find-match decorations) is applied when opening a file from search results
- `src/services/tauri.ts` -- IPC gateway where new search command is registered
- `src/services/events.ts` -- Event hub pattern for search progress events
- `src-tauri/src/lib.rs` -- Command registration for new search commands

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/features/explorer/utils/tree-filter.ts`: `filterTreeNodes()` is the core filename filtering function -- reuse directly for Filename mode. Already handles recursive child filtering and case-insensitive substring matching.
- `src-tauri/src/validation/mod.rs`: `detect_and_decode()` handles raw bytes -> encoding detection -> UTF-8 transcoding. Reuse for reading each file during content search before applying substring search.
- `src-tauri/src/commands/explorer.rs`: `bulk_scan_cmd` with `walkdir`, `CancellationToken`, and `app_handle.emit` for progress streaming. Content search command follows the same structural pattern.
- `src/services/events.ts`: `createEventHub` pattern for Tauri event subscription. Use for content search progress/result events.
- `src/features/explorer/store.ts`: Explorer store with `filterText` and `setFilterText`. These get replaced/extended with the new unified search state.

### Established Patterns
- IPC pattern: Rust command in `commands/*.rs` -> registered in `lib.rs` -> typed method on `tauri` object in `services/tauri.ts` -> feature service wraps it.
- Event streaming: `app_handle.emit("event-name", payload)` from Rust, `listen("event-name", callback)` from `@tauri-apps/api/event` on frontend. Same pattern as Phase 5 scan progress.
- Cancellation: `CancellationToken` from `tokio_util::sync`, stored in `ExplorerState`, checked per iteration in `spawn_blocking`.
- Store pattern: Zustand with `useShallow` selectors. Search state (mode, query, scope, results, progress) extends the explorer store.

### Integration Points
- New Rust command: `content_search_cmd` -- accepts search terms, folder path, file pattern, operation ID. Recursively walks directory, reads + decodes each matching file, searches for terms, emits per-file result events, returns summary.
- New Rust command: `cancel_search_cmd` -- cancels active search via `CancellationToken`.
- Explorer store extends: search mode (filename/content), search results list, search progress state, active search scope.
- Sidebar replaces: existing filter input becomes the unified search bar with toggle, controls row appears in Content mode.
- Monaco integration: when opening a file from search results, pass the search query to `xml-source-view.tsx` for find-match decorations.

</code_context>

<specifics>
## Specific Ideas

- The segmented control toggle should be compact (small pill-style buttons: "Filename" | "Content") sitting to the right of the search input, not below it.
- The controls row in Content mode should be tight: scope dropdown (left), file pattern input (center, narrow), Search button (right). All on one line.
- Summary header format: "12 files, 47 matches in Folder: 20251223" with a small X to clear results.
- Folder groups in results: folder path as a collapsible header (bold), files listed below with filename and match count in muted text (e.g., "patient001.xml  3 matches").
- The "Select a folder" prompt when no selection exists should be a muted message in the sidebar area where the tree/results normally appear, not a blocking modal.
- When content search is running, the progress indicator should appear inline at the top of the sidebar results area: "Searching... 45 of 200 files" with a cancel button.
- Error files at the bottom of results should be in a separate "Errors" collapsible group with a red header.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

</deferred>

---

*Phase: 6-Search*
*Context gathered: 2026-05-28*
