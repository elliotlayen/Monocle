# Phase 4: Single-File Validation - Context

**Gathered:** 2026-05-26
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase adds automatic validation to the existing file viewing experience. When a user opens a file, the Rust backend detects character-level and encoding issues (illegal XML characters, control characters, null bytes, BOM, non-UTF8 encoding) and surfaces them through three UI touchpoints: red/yellow badges on file nodes in the tree sidebar, a VS Code-style problems panel below the source view, and inline Monaco decorations (gutter markers + character highlights). No XML structural/well-formedness validation -- only byte-level and character-level checks. No bulk scanning (Phase 5). No folder-level indicators.

</domain>

<decisions>
## Implementation Decisions

### Problems Panel Layout
- **D-01:** Problems panel is a VS Code-style bottom split panel within the content area. It sits below the source/tree view with a drag handle for resizing. Collapsible.
- **D-02:** Panel auto-shows when validation finds issues on file open. If the file is clean, the panel stays hidden. User can manually collapse the panel and it stays collapsed until a new file with issues is opened.
- **D-03:** Panel shows problems for the active tab only. Switching tabs updates the problems panel to reflect the new active file's issues.
- **D-04:** A thin status bar at the bottom of the content area always shows error/warning counts (e.g., "2 errors, 1 warning") and the detected encoding (e.g., "UTF-8", "Windows-1252"). Clickable to toggle the problems panel. Always visible when a file is open.

### Validation Engine
- **D-05:** All validation runs in Rust, in the backend, alongside file reading. The `read_file_cmd` is extended to return validation results (problems array, detected encoding, BOM flag) alongside the file content.
- **D-06:** Character-level checks only in Phase 4: illegal XML characters (unescaped `&`, `<`, `>` in content), null bytes (0x00), invalid XML control characters (0x01-0x08, 0x0B, 0x0C, 0x0E-0x1F), and non-UTF8 bytes that couldn't cleanly transcode.
- **D-07:** No XML structural validation (mismatched tags, unclosed elements, duplicate attributes). The existing DOMParser-based tree view already surfaces parse errors. The Phase 4 validator is focused on byte/character-level issues that cause silent processing failures.

### Encoding Handling
- **D-08:** Rust reads files as raw bytes, detects encoding using encoding_rs (or similar), and transcodes to UTF-8 with lossy replacement. Bad bytes become the Unicode replacement character. Files are always viewable.
- **D-09:** Encoding is always shown in the status bar (e.g., "UTF-8", "Windows-1252", "ISO-8859-1"). Non-UTF8 encodings are additionally flagged as a warning in the problems panel.
- **D-10:** BOM presence is detected and flagged as a warning in the problems panel. The BOM bytes are not shown in the content.

### Severity Model
- **D-11:** Two severity levels: Error (red) and Warning (yellow).
- **D-12:** Errors: unescaped entities in content, null bytes, invalid XML control characters, non-UTF8 bytes that couldn't transcode.
- **D-13:** Warnings: BOM detected, non-UTF8 encoding (file was transcoded but works), bare CR without LF (unusual line ending).

### Tree Badges
- **D-14:** Files with errors show a red dot badge. Files with warnings only (no errors) show a yellow dot badge. No count on the badge.
- **D-15:** Badges persist for the session after a file is validated (even after closing the tab). Cleared on app restart.
- **D-16:** Re-opening a previously validated file reuses cached validation results (no re-scan).
- **D-17:** No indicator for clean files (no badge = either not scanned or clean).
- **D-18:** File nodes only -- no aggregate badges on parent folders (date folders, client folders, source nodes). Phase 5 bulk scan is the appropriate place for folder-level indicators.

### Inline Source Highlighting
- **D-19:** Lines with issues get a gutter icon in Monaco (red circle for errors, yellow circle for warnings).
- **D-20:** The specific bad character or byte gets an inline background highlight (red underline/background for errors, yellow for warnings).
- **D-21:** Clicking a problem in the problems panel auto-switches to source view (if in tree view) and jumps to the relevant line/column.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` -- Project overview, constraints (read-only, Tauri 2, lazy loading, cross-platform), folder structure, and key decisions
- `.planning/REQUIREMENTS.md` -- Requirements VALD-01, VALD-02, VALD-03, VALD-04 map to this phase
- `.planning/ROADMAP.md` -- Phase 4 goal, success criteria, and dependencies

### Prior Phase Context
- `.planning/phases/02-folder-sources-tree-sidebar/02-CONTEXT.md` -- Phase 2 decisions on tree sidebar (D-09 hierarchy, D-10 child counts, D-14 all files shown) that constrain badge placement
- `.planning/phases/03-xml-file-viewing/03-CONTEXT.md` -- Phase 3 decisions on file reading (D-04 read into memory, D-05 Rust reading path), Monaco (D-01, D-06), tab interface (D-11 through D-16), content header bar (D-16), and the `read_file_cmd` that Phase 4 extends

### Codebase Integration Points
- `src-tauri/src/commands/explorer.rs` -- Contains `read_file_cmd` that needs to be extended with validation results
- `src/features/explorer/types.ts` -- `FileContent`, `FileTab`, and `TreeNode` types to extend with validation data
- `src/features/explorer/store.ts` -- Explorer Zustand store to extend with validation state and session cache
- `src/features/explorer/components/xml-source-view.tsx` -- Monaco editor component where gutter markers and inline decorations are added
- `src/features/explorer/components/folder-tree-node.tsx` -- Tree node component where badges are rendered (already has Badge import and `renderBadge` function)
- `src/features/explorer/components/file-content-area.tsx` -- Content area where the problems panel and status bar are added
- `src/features/explorer/services/explorer-service.ts` -- Service to update with new response shape from `read_file_cmd`
- `src/services/tauri.ts` -- IPC gateway where updated command response type is registered
- `src-tauri/src/lib.rs` -- Command registration (no new commands needed, just extended response)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/features/explorer/components/folder-tree-node.tsx`: Already imports `Badge` from shadcn/ui and has a `renderBadge()` function for source tag badges. Validation badges extend this pattern.
- `src/features/explorer/components/xml-source-view.tsx`: Monaco Editor with `@monaco-editor/react`. Supports `onMount` handler to access the editor instance for decorations API (`deltaDecorations`, `IModelDeltaDecoration`).
- `src/components/ui/badge.tsx` (shadcn): Badge component for tree node indicators.
- `src/components/ui/scroll-area.tsx` (shadcn): Scrollable container for the problems panel list.
- `src/features/explorer/store.ts`: Explorer store with `openFile` action that calls `explorerService.readFile()` -- validation results integrate into this flow.

### Established Patterns
- IPC pattern: Rust command in `commands/*.rs` -> registered in `lib.rs` -> typed method on `tauri` object in `services/tauri.ts` -> feature service wraps it. Phase 4 extends the existing `read_file_cmd` response shape rather than adding new commands.
- Store pattern: Zustand with `useShallow` selectors. Validation state (problem cache, panel visibility) extends the explorer store.
- Error pattern: `read_file_cmd` uses `spawn_blocking` + timeout. Validation errors are data (returned in the response), not command failures.
- File reading: `std::fs::read_to_string` in Rust. Phase 4 changes this to `std::fs::read` (raw bytes) + encoding detection + lossy transcode.

### Integration Points
- `read_file_cmd` returns `FileContent { content, size }`. Phase 4 extends this to also include `problems: Vec<Problem>`, `encoding: String`, `hasBom: bool`.
- `FileTab` type gets new fields for validation results. `TreeNode` type gets an optional validation status for badge rendering.
- Monaco `onMount` callback in `xml-source-view.tsx` receives the editor instance, which exposes `deltaDecorations()` for gutter and inline markers.
- Content area layout changes: `file-content-area.tsx` adds a resizable bottom panel (problems list) and a status bar.

</code_context>

<specifics>
## Specific Ideas

- The problems panel header shows "Problems (N)" where N is the total count. Expand/collapse icon on the left. Error and warning counts shown separately as colored indicators.
- Each problem row: severity icon (red/yellow), line:column location (clickable), description text. Rows grouped or sorted by line number.
- Status bar format: left side shows "N errors, N warnings" with colored icons; right side shows detected encoding name. Entire bar is clickable to toggle the problems panel.
- Monaco decorations should use the standard `overviewRuler` markers so the scrollbar shows red/yellow marks at problem locations (built-in Monaco feature).
- The validation cache in the store should be keyed by file path, storing problems + encoding + hasBom. When a tab is re-opened for the same path, skip re-validation and use cached results.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope.

</deferred>

---

*Phase: 4-Single-File Validation*
*Context gathered: 2026-05-26*
