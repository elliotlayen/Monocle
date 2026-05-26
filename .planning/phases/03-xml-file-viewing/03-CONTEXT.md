# Phase 3: XML File Viewing - Context

**Gathered:** 2026-05-26
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the XML file viewing experience: clicking a file in the sidebar tree opens it in a tabbed content area where users can view syntax-highlighted source or a collapsible XML tree structure. Multiple files can be open simultaneously in tabs, and basic file actions (copy path, open in external editor, copy content, save copy) are available. No validation, search, or comparison -- just viewing and inspecting file content.

</domain>

<decisions>
## Implementation Decisions

### Source View
- **D-01:** Source view uses Monaco Editor (already bundled for SQL). Add XML language contribution with syntax highlighting and code folding. Read-only mode.
- **D-02:** Source view is the default when opening a file. Users toggle to tree view from the content header bar.
- **D-03:** Any file can be opened as text in the source view (not just XML). Tree view is only available for valid XML files.
- **D-04:** File content is read entirely into memory via a new Rust Tauri command (`read_file_cmd` or similar). No streaming or chunking. Simple loading spinner while reading.
- **D-05:** The file reading path goes through Rust (new Tauri command), consistent with Phase 2's directory listing pattern. Enables future Phase 4 validation additions in Rust without frontend changes.
- **D-06:** Monaco gets XML syntax highlighting plus code folding (collapse XML elements). No autocomplete or validation markers -- this is read-only viewing.

### XML Tree View
- **D-07:** VS Code-style tree rendering: element name as node label, attributes shown inline after the tag name (e.g., `Patient id="123" type="new"`), text content as a child leaf node.
- **D-08:** Tree starts fully collapsed -- only the root element visible. User expands manually. Fast for any file size.
- **D-09:** XML parsing for the tree view happens on the frontend using the browser's built-in DOMParser. No Rust-side XML parsing in this phase.
- **D-10:** Comments, processing instructions, and CDATA sections appear as distinct styled nodes in the tree. Comments show as `<!-- ... -->` in italic/muted style, PIs show as `<?target ...?>`, CDATA shows as `<![CDATA[...]]>`. Each has a unique icon or color to distinguish from elements.

### Tab Interface
- **D-11:** No hard limit on open tabs. Tabs scroll horizontally when they overflow the tab bar. Close button on each tab.
- **D-12:** Tab labels show filename only (e.g., `file1.xml`). Full path shown in tooltip on hover. If two files share the same name, append a parent folder disambiguator (e.g., `file1.xml - 20251223`).
- **D-13:** Tabs do not persist across sessions. App opens with no tabs and the empty state view.
- **D-14:** Clicking a file already open in a tab switches to that existing tab. No duplicate tabs for the same file.
- **D-15:** Content area empty state is context-aware: if no sources configured, show the settings prompt (Phase 1/2 empty state). If sources exist but no file is open, show "Click a file in the sidebar to open it" message.

### Content Header Bar
- **D-16:** A header bar between the tabs and the content area shows the current filename, file size, and a tree/source toggle control. File action buttons (copy path, copy content) also live here as icon buttons.

### File Actions
- **D-17:** File actions are available in two places: the content header bar has the most common actions (copy path, copy content), and right-click context menu on tabs and sidebar tree entries has the full set (copy path, open in external editor, copy content, save copy).
- **D-18:** "Open in external editor" uses the OS default application for the file type. No configurable editor path in this phase.
- **D-19:** "Save a copy" uses Tauri's native save dialog (already available via tauri-plugin-dialog, used by canvas feature). User picks destination and filename.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` -- Project overview, constraints (read-only, Tauri 2, lazy loading, cross-platform), folder structure, and key decisions
- `.planning/REQUIREMENTS.md` -- Requirements BRWS-04, BRWS-05, BRWS-06, BRWS-07 map to this phase
- `.planning/ROADMAP.md` -- Phase 3 goal, success criteria, and dependencies

### Prior Phase Context
- `.planning/phases/01-explorer-shell-navigation/01-CONTEXT.md` -- Phase 1 decisions (D-01 nav bar, D-05 empty state, D-13 visual style) that constrain this phase
- `.planning/phases/02-folder-sources-tree-sidebar/02-CONTEXT.md` -- Phase 2 decisions (D-09 tree hierarchy, D-13 file click deferred, D-14 all files shown, D-15 sidebar layout) that this phase builds on

### Codebase Integration Points
- `src/features/explorer/components/explorer-shell.tsx` -- Shell component where tabbed content area replaces the empty state
- `src/features/explorer/components/explorer-sidebar.tsx` -- Sidebar tree where file click handlers get wired in
- `src/features/explorer/store.ts` -- Explorer Zustand store to extend with file/tab state
- `src/features/explorer/types.ts` -- Types to extend with file content and tab types
- `src/features/explorer/services/explorer-service.ts` -- Service to extend with file reading
- `src/services/tauri.ts` -- IPC gateway where new read_file command is registered
- `src/lib/monaco-sql-loader.ts` -- Existing lazy Monaco loader pattern to extend for XML language
- `src/features/canvas/services/canvas-file-service.ts` -- Reference for Tauri FS plugin and save dialog usage
- `src-tauri/src/commands/` -- Where new file reading Rust command goes
- `src-tauri/src/lib.rs` -- Command registration

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/monaco-sql-loader.ts`: Lazy Monaco loading pattern. Extend to also load `xml.contribution.js` for XML language support.
- `src/features/canvas/services/canvas-file-service.ts`: Uses `@tauri-apps/plugin-fs` readFile and `@tauri-apps/plugin-dialog` save dialog. Reference for "save copy" file action.
- `src/components/ui/tabs.tsx` (shadcn): Tab primitives for the file tab bar.
- `src/components/ui/scroll-area.tsx` (shadcn): Scrollable container for the XML tree view.
- `src/components/ui/tooltip.tsx` (shadcn): Tooltips for tab full paths and action button labels.
- `src/features/schema-graph/components/sidebar-toggle.tsx`: Toggle button pattern reused in Phase 2.

### Established Patterns
- IPC pattern: Rust command in `commands/*.rs` -> registered in `lib.rs` -> typed method on `tauri` object in `services/tauri.ts` -> feature service wraps it.
- Store pattern: Zustand store with `useShallow` selectors. Explorer store already manages tree state; file/tab state extends this.
- Component architecture: Components are presentational. State/side-effects in hooks. Tauri IPC in services.
- Lazy loading: Monaco is lazy-loaded via dynamic import. Same pattern applies for XML language contribution.

### Integration Points
- `ExplorerShell` currently renders `ExplorerNavBar` + sidebar + `ExplorerEmptyState`. Phase 3 replaces the empty state area with a tabbed file viewer when files are open.
- File click in `FolderTree` / `FolderTreeNode` needs an onClick handler that triggers file opening in the store.
- New Rust command needed: `read_file_cmd` for reading file content with path input, returning string content.
- The explorer store needs new state: open tabs list, active tab ID, per-tab view mode and scroll position.

</code_context>

<specifics>
## Specific Ideas

- The content header bar pattern: filename on the left, file size as muted text, tree/source segmented control or toggle in the center-right area, action icon buttons on the right.
- Tab disambiguator: when two tabs share the same filename, show the nearest distinguishing parent folder name (typically the date folder like `20251223`).
- Non-XML files get source view only (no tree view toggle). The toggle control is hidden or disabled for non-XML files.
- DOMParser error handling: if DOMParser fails to parse the XML (malformed), show the source view with a subtle banner "Unable to parse XML tree -- showing source view" and disable the tree toggle.
- Each tab maintains its own view mode (tree or source) and scroll position independently.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

</deferred>

---

*Phase: 3-XML File Viewing*
*Context gathered: 2026-05-26*
