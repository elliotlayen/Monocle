# Phase 2: Folder Sources & Tree Sidebar - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers configurable folder source management and a lazy-loading tree sidebar for navigating the Client > Date > File hierarchy on network shares. Users can add root folder paths in settings, see them as expandable nodes in a sidebar, browse clients and date folders, and pin favorite clients per source. No file viewing or content inspection -- just navigation and folder structure browsing.

</domain>

<decisions>
## Implementation Decisions

### Source Configuration UX
- **D-01:** Folder sources are configured in a dedicated "Folder Sources" section of the existing settings sheet. No inline sidebar controls for source CRUD.
- **D-02:** Each source has three fields: path (string), label (display name), and tag (freeform text, e.g., "Inbound", "Outbound", "Test Data").
- **D-03:** Adding a source uses a text input for path entry (supports UNC paths like `\\server\share`) with an optional native Browse button (via tauri-plugin-dialog) for local paths.
- **D-04:** On save, the app validates path reachability. If unreachable, save succeeds but a yellow warning is shown ("Path unreachable -- check VPN connection"). Does not block saving.
- **D-05:** Sources support drag-to-reorder in the settings sheet. Display order in the sidebar matches the user's configured order.
- **D-06:** No limit on the number of sources. Sidebar handles many sources with scrolling.
- **D-07:** Full edit capability -- users can change path, label, and tag on existing sources in-place.
- **D-08:** First-time experience: the Phase 1 empty state is updated to say "Add a folder source in Settings to get started" with the existing "Open Settings" button. No guided wizard.

### Tree Sidebar Behavior
- **D-09:** Tree hierarchy is flat roots. Each configured source is a root node. Expand source -> client folders. Expand client -> date folders. Expand date -> files. Three levels of nesting below the source.
- **D-10:** Nodes display name + child count badge. Counts are fetched on expand only (lazy) -- parent nodes show no count until expanded.
- **D-11:** Date folders are sorted with a user-togglable control: newest-first (default) or oldest-first. Sort preference is session-only, resets to newest-first on app restart.
- **D-12:** Loading indicator is a small spinner replacing the expand chevron while children load. Children appear below when ready.
- **D-13:** Clicking a file does nothing in Phase 2. File viewing is deferred to Phase 3. Content area keeps the getting-started empty state.
- **D-14:** All files are shown in date folders (not just XML). XML files are visually highlighted with distinct icon/styling compared to non-XML files.
- **D-15:** Sidebar follows Phase 1 decisions: resizable via drag handle (width persists), collapsible via toggle button matching schema-browser-sidebar pattern.

### Favorites & Filtering
- **D-16:** Favorite clients appear in a "Favorites" pinned section at the top of each source's client list. Pinned clients also remain in their normal alphabetical position below.
- **D-17:** Users favorite a client via star icon on hover (quick toggle) AND right-click context menu entry (discoverability). Both paths available.
- **D-18:** Favorites persist in Rust AppSettings (settings.json), scoped per-source. Each source maintains its own favorites list.
- **D-19:** The pinned Favorites section only appears for sources that have favorites. No favorites = no section header.
- **D-20:** Client filter is a permanently visible filter bar above the tree (matching schema-browser-sidebar's search input pattern). Typing narrows the visible node list in real time.
- **D-21:** Filter matches against all visible (already-loaded) nodes -- client names, date folders, and filenames. Does not trigger new network fetches for unloaded nodes.

### Network I/O Resilience
- **D-22:** Unreachable sources show as greyed-out with a warning icon and tooltip ("Unreachable -- check VPN connection"). User can try expanding to retry.
- **D-23:** Timeout for folder listing is 15 seconds. After 3 seconds, a cancel button appears alongside the spinner. Elapsed time is shown ("Loading... 8s").
- **D-24:** No caching -- every expand re-fetches the directory listing from the filesystem. Always fresh, simple implementation.
- **D-25:** Cancel actually aborts the directory read operation on the Rust side (drops the task). Node collapses back to unexpanded state.
- **D-26:** No automatic retries. After a failed load, user manually re-clicks the expand chevron to retry.
- **D-27:** No proactive network health checking. The app only reacts to failures when they occur during user-initiated operations.
- **D-28:** Load all children in one call (no pagination). Virtual scrolling handles rendering performance for directories with many entries.

### Claude's Discretion
- **D-29:** UNC path hang workaround -- researcher should investigate the best approach for handling `tokio::fs::read_dir` issues on Windows UNC paths (spawn_blocking + timeout vs dedicated std::fs thread pool vs other).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` -- Project overview, constraints (read-only, Tauri 2, lazy loading, cross-platform), folder structure, and key decisions
- `.planning/REQUIREMENTS.md` -- Requirements BRWS-01, BRWS-02, BRWS-03, BRWS-08 map to this phase
- `.planning/ROADMAP.md` -- Phase 2 goal, success criteria, and dependencies

### Prior Phase Context
- `.planning/phases/01-explorer-shell-navigation/01-CONTEXT.md` -- Phase 1 decisions (D-06 through D-08, D-13) that constrain this phase's sidebar implementation

### Codebase Integration Points
- `src/features/explorer/components/explorer-shell.tsx` -- Shell component where sidebar gets wired in
- `src/features/explorer/components/explorer-empty-state.tsx` -- Empty state to update with folder source guidance
- `src/features/schema-graph/components/schema-browser-sidebar.tsx` -- Existing sidebar tree pattern to follow
- `src-tauri/src/state.rs` -- AppSettings struct where folder sources and favorites persist
- `src-tauri/src/commands/settings.rs` -- Settings commands pattern to extend
- `src/services/tauri.ts` -- IPC gateway where new commands are registered
- `src/features/settings/components/settings-sheet.tsx` -- Settings panel where Folder Sources section goes

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/features/schema-graph/components/schema-browser-sidebar.tsx`: Full tree component with expand/collapse, search filter, icons, scroll area. Pattern for the explorer sidebar tree.
- `src/features/schema-graph/components/sidebar-toggle.tsx`: Toggle button for collapsible sidebar. Reuse directly.
- `src/components/ui/scroll-area.tsx` (shadcn): Scrollable container for the tree content.
- `src/components/ui/input.tsx` (shadcn): Filter input field above the tree.
- `src/components/ui/button.tsx` (shadcn): Buttons for settings, toggle, browse.
- `tauri-plugin-dialog`: Already installed, provides native folder picker dialog.
- `tauri-plugin-fs`: Already installed, provides filesystem access from the Tauri WebView.

### Established Patterns
- Settings persistence: `AppState` -> `Mutex<AppSettings>` -> `settings.json`. Folder sources will be a new `Vec<FolderSource>` field on `AppSettings`.
- IPC pattern: Rust command in `commands/*.rs` -> registered in `lib.rs` -> typed method on `tauri` object in `services/tauri.ts` -> feature service wraps it.
- Feature module structure: `src/features/explorer/components/`, `services/`, `hooks/`, `store.ts`, `types.ts`.
- Component architecture: Components are presentational. State/side-effects in hooks. Tauri IPC in services.

### Integration Points
- `ExplorerShell` currently renders `ExplorerNavBar` + `ExplorerEmptyState`. Phase 2 adds a sidebar panel alongside the content area.
- New Rust commands needed: `list_directory` (or similar) for lazy-loading folder contents.
- `AppSettings` needs new fields: `folder_sources: Vec<FolderSource>`, `explorer_sidebar_width: Option<f64>`.
- The filter bar in the sidebar operates on already-loaded (expanded) nodes only -- no new network calls for filtering.

</code_context>

<specifics>
## Specific Ideas

- The getting-started empty state (Phase 1) should update its messaging to reference folder sources when none are configured, but should remain as-is otherwise.
- Date folder formatting: "20251223 (Dec 23, 2025)" -- raw YYYYMMDD first, human-readable in parentheses.
- The filter matches against visible nodes only (already loaded via expansion). It does not search into unloaded/collapsed subtrees.
- Source label in the tree root should be prominent (the label they gave it), with the tag shown as a subtle badge or secondary text.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

</deferred>

---

*Phase: 2-Folder Sources & Tree Sidebar*
*Context gathered: 2026-05-22*
