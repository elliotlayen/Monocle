# Feature Landscape: Integration Explorer

**Domain:** XML file browser / validation tool for network share integration files
**Researched:** 2026-05-22
**Overall confidence:** HIGH

## Table Stakes

Features users expect from a tool replacing Windows Explorer for XML file browsing. Missing any of these and users will revert to their current workflow.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Folder tree sidebar** (Root > Client > Date) | Core navigation. Users currently do this in Explorer -- must be at least as good. Tree views are the universal pattern for hierarchical file browsing (Windows Explorer, VS Code, every file manager). | Medium | Must support expand/collapse with visual indentation. Client codes and date folders are the two levels users think in. |
| **Lazy-loading folder contents** | Network shares over VPN make upfront scanning a non-starter. Every file manager handles remote/slow filesystems with on-demand loading. Users will abandon if the app freezes on open. | High | Critical path. Must load child nodes only when parent is expanded. Show loading spinners per-node. Cache previously loaded results in memory for session. |
| **XML file viewer (tree + raw source)** | Baseline expectation from any XML tool. Microsoft XML Notepad, XML Explorer, Oxygen, Altova XMLSpy -- all provide both tree and source views. Without this, users will open files in Notepad++ instead. | Medium | Tree view: collapsible nodes, color-coded tags/attributes/values. Source view: syntax highlighting. Toggle between views. |
| **Configurable folder sources** | Users have inbound and outbound roots, plus personal test folders. Every file manager supports multiple roots/bookmarks. Without this, users need separate instances. | Low | Add/remove/edit root paths. Persist across sessions. Show all roots in sidebar. |
| **Date folder formatting** | Raw YYYYMMDD folders are hard to scan. Showing "20251223 (Dec 23, 2025)" is the minimum formatting users need to stop mentally parsing dates. | Low | Display both raw and formatted. Sort chronologically (newest first by default). |
| **File search (filename pattern)** | Basic filename filtering is available in Windows Explorer already. Not providing it means the tool is worse than the status quo. | Low | Filter by filename pattern within current view. Instant results as user types. |
| **Content search (field-level)** | The primary reason to build this tool. Users currently cannot search inside XML files without opening each one. Finding a patient ID or account number across hundreds of files is the core pain point. | High | Search within current folder, current client, or all sources. Must handle large result sets with lazy rendering. Show file path + matched content in results. |
| **Illegal character detection** | The second primary reason for this tool. Silent failures from bad characters are the department's biggest operational pain. Flag XML-invalid characters (unescaped &, <, >, control characters, null bytes) and encoding issues (non-UTF8, BOM problems). | Medium | Must detect: characters outside XML 1.0 valid ranges, unescaped XML entities, encoding declaration mismatches, BOM presence. Per XML spec, U+0000 is always invalid; other invalid ranges are well-defined. |
| **Visual problem indicators** | Users need to see at a glance which files have issues without opening each one. Red badges/icons on files in the tree are standard in code editors (VS Code problems, IDE error markers). | Low | Red dot/badge on file nodes with detected issues. Count of issues if multiple. Clears if file is clean. |
| **Problems panel** | List of issues with line numbers and descriptions, like VS Code's Problems panel. Users expect this from any validation tool. Without it, they just get "bad" without knowing where or what. | Medium | Sortable list: line number, column, description, severity. Click to jump to location in source view. |
| **Inline problem highlighting** | Highlight the actual bad characters/lines in source view. Every IDE does this. Without it, users have to manually scan for issues. | Medium | Underline or highlight markers in source view at exact positions. Gutter markers for affected lines. Hover/click for description. |
| **File actions (copy path, open externally)** | Minimum file operations. Users will need to share file paths with colleagues, open files in other tools for further inspection. | Low | Right-click context menu: copy full path, copy filename, open in default editor, open containing folder. |
| **Copy content** | Users frequently need to paste XML content into tickets, emails, or other tools. | Low | Copy raw XML to clipboard. Copy formatted/pretty-printed XML. |
| **Tabbed interface** | Users routinely compare or reference multiple files during investigation. Without tabs, they lose context switching between files. VS Code, every browser, and XML Notepad all use tabs. | Medium | Open multiple files in tabs. Each tab maintains its own view state (tree vs. source, scroll position). Close individual tabs. Tab overflow handling. |

## Differentiators

Features that set this tool apart from generic file browsers and XML editors. Not expected, but provide significant value for this specific workflow.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Configurable search scope** | Users often know whether to look within one client, one date, or everywhere. Scoped search dramatically reduces search time on slow network shares. No generic tool offers this hierarchy-aware scoping. | Medium | Three scopes: current folder, current client (all dates), all sources. UI should make scope selection prominent, not buried. Default to narrowest scope that makes sense. |
| **Bulk validation scan** | Validate an entire folder at once and produce a summary. No generic XML tool does this for a folder hierarchy. Turns a manual per-file process into a one-click operation. | High | Scan all files in a folder/client/date. Progress indicator essential for large scans. Cancellable. Summary: total files, files with issues, issue breakdown by type. |
| **Scan report export** | After bulk scanning, users need to share results with management or other teams. CSV/Excel for data analysis, PDF for formal reports. | Medium | Export formats: CSV, Excel (XLSX), PDF, JSON, clipboard text. Include file path, issue type, line number, description. |
| **File comparison (diff)** | Compare files across dates to see what changed, or inbound vs outbound to verify data integrity. Side-by-side and inline modes. While diff tools exist, having it integrated with the folder hierarchy eliminates context-switching. | High | Side-by-side and inline (unified) diff views. Color-coded additions/deletions/changes. Synchronized scrolling in side-by-side mode. Pick any two files to compare. |
| **Client favorites / pinning** | With hundreds of client codes, users typically work with 5-10 regularly. Pinning favorites to the top of the tree eliminates scrolling. Standard pattern from Windows Quick Access, browser bookmarks. | Low | Pin/unpin clients. Pinned clients appear at top of tree in dedicated "Favorites" section. Persist across sessions. |
| **Bookmarks** | Save references to specific files or folders for revisiting later. Deeper than favorites -- these are specific investigation waypoints. | Low | Bookmark any file or folder. Named bookmarks with optional notes. Quick access from a bookmarks panel. Persist across sessions. |
| **Client dashboard** | Per-client overview: file counts by date, error rates, last activity. Turns raw folder contents into actionable intelligence. No file manager provides this. | Medium | File count trends over time. Error rate summary from most recent scan. Last activity date. Quick health indicator. |
| **Error heatmap** | Visual overview showing which clients/dates have the most issues. Heatmaps are proven for quickly spotting patterns in data quality dashboards. | Medium | Grid: clients on one axis, dates on the other. Color intensity = issue density. Click cell to navigate to that client/date. Requires scan data to populate. |
| **Timeline view** | File volume over time (day/week/month). Spot trends, gaps, and anomalies. | Medium | Chart showing file counts over time. Zoom into day/week/month granularity. Click data points to navigate. Useful for identifying when integrations stopped or spiked. |
| **File size anomaly detection** | Flag unusually large or small files that may indicate truncated data, duplicate content, or processing errors. | Low | Statistical outlier detection (simple standard deviation from mean for the folder). Visual indicator on anomalous files. |
| **Folder watching** | Monitor configured folders for new files. Desktop notifications, in-app badges, auto-validate new files. Proactive instead of reactive. | High | File system watcher on configured paths. Configurable: notifications, badges, auto-validation each independently togglable. Must handle VPN disconnection gracefully. Platform-specific: FSEvents on macOS, ReadDirectoryChangesW on Windows. |
| **XPath query support** | Power user feature for precise XML content extraction. xml_grep and xgrep prove demand exists in the XML ecosystem. | Medium | XPath expression input with syntax hints. Evaluate against current file or across files. Results panel showing matches with context. Nice-to-have, not critical. |

## Anti-Features

Features to explicitly NOT build. These either violate the read-only constraint, add complexity without value for this audience, or creep beyond the tool's purpose.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **XML editing / fixing** | Scope creep. The department identifies issues and reports them -- they do not fix files themselves. Adding editing creates liability for corrupting production data. PROJECT.md explicitly marks this out of scope. | Provide "export cleaned version" as a save-as operation that strips known bad characters, but never modify source files. |
| **Schema (XSD/DTD) validation** | XML files come from many different schemas that are not documented or available. XSD validation would require maintaining schema definitions that do not exist. False positives would erode trust. | Focus on well-formedness validation and character-level issues, which are the actual pain points. |
| **XSLT transformation** | Power user feature that serves developers, not the department audience. Adds massive complexity (XSLT engine, template management) for near-zero workflow value. | If transformation is needed, users can export and use dedicated XSLT tools. |
| **Real-time file tailing / streaming** | These are batch integration files, not log streams. Real-time tailing adds complexity for a use case that does not exist. PROJECT.md explicitly marks this out of scope. | Folder watching with periodic polling covers the "new files" use case adequately. |
| **Database integration** | Linking XML content to SQL Server records creates a cross-feature dependency that massively increases complexity. The two features (schema viz and integration explorer) serve different workflows. PROJECT.md explicitly marks this out of scope. | Keep Integration Explorer and Schema Graph as independent modes. Users can switch between them but they do not share data. |
| **Multi-user / shared bookmarks** | Adds authentication, sync, conflict resolution. Way beyond scope for a desktop tool. PROJECT.md explicitly marks this out of scope. | Per-user bookmarks stored locally. Users can share file paths via copy-path feature. |
| **Full-text indexing** | Building a search index over all files would improve search speed but requires significant storage, index maintenance, and handling of stale data on network shares. The lazy-loading approach is more appropriate for VPN-accessed shares. | Search on-demand with progress indication. Cache recent search results in memory for session. Consider optional local caching as a future enhancement. |
| **XML pretty-printing / reformatting** | Modifying file presentation beyond the viewer is unnecessary. The raw view shows the file as-is; the tree view provides structured navigation. Reformatting implies the tool has opinions about formatting. | Tree view already provides structured viewing. Copy-as-formatted for clipboard use is sufficient. |
| **Automated remediation / file repair** | Beyond scope. Users should not be trusted to auto-fix production integration files. Even well-intentioned fixes could break downstream processing. PROJECT.md explicitly marks this out of scope. | Show what the fix would be in the problems panel description, but do not apply it. "Export cleaned version" for local analysis only. |

## Feature Dependencies

```
Configurable folder sources --> Folder tree sidebar (sidebar needs sources to display)
Folder tree sidebar --> Lazy loading (sidebar expansion triggers loading)
Folder tree sidebar --> File viewer (selecting a file opens it)
File viewer --> Tabbed interface (each opened file is a tab)
File viewer (source view) --> Inline problem highlighting (markers overlay source)
File viewer (source view) --> Syntax highlighting (prerequisite for any source view)
Illegal character detection --> Visual problem indicators (indicators need detection results)
Illegal character detection --> Problems panel (panel displays detection results)
Illegal character detection --> Inline problem highlighting (highlighting needs detection positions)
Illegal character detection --> Bulk validation scan (scan runs detection across files)
Bulk validation scan --> Scan report export (export needs scan results)
Bulk validation scan --> Error heatmap (heatmap needs aggregated scan data)
Bulk validation scan --> Client dashboard (dashboard needs scan statistics)
Content search --> Configurable search scope (scope modifies search behavior)
Client favorites --> Folder tree sidebar (favorites modify tree rendering)
Bookmarks --> File viewer OR Folder tree sidebar (bookmarks reference files/folders)
File comparison --> File viewer (diff view is a specialized viewer)
File comparison --> Tabbed interface (diff opens in a tab)
Folder watching --> Illegal character detection (auto-validate needs detection)
Folder watching --> Visual problem indicators (new file badges)
Timeline view --> Folder tree sidebar (needs date folder metadata)
XPath query --> File viewer (evaluates against current file content)
```

## MVP Recommendation

**Phase 1 -- Core browsing and viewing (must ship first):**
1. Configurable folder sources (foundation for everything)
2. Folder tree sidebar with lazy loading (core navigation)
3. Date folder formatting (quick win, improves navigation)
4. XML file viewer with tree + source toggle (core viewing)
5. Tabbed interface (users need multiple files open)
6. File actions (copy path, open externally, copy content)
7. Client favorites / pinning (low cost, high daily value)

**Phase 2 -- Validation (the primary value proposition):**
1. Illegal character detection engine
2. Visual problem indicators on tree nodes
3. Problems panel with line numbers
4. Inline problem highlighting in source view
5. Bulk validation scan with progress
6. Scan report export (CSV, PDF, JSON)

**Phase 3 -- Search (the second value proposition):**
1. Filename search / filtering
2. Content search (field-level, across files)
3. Configurable search scope (folder / client / all)

**Phase 4 -- Analysis and comparison:**
1. File comparison (side-by-side + inline diff)
2. Client dashboard
3. Error heatmap
4. Timeline view
5. File size anomaly detection

**Phase 5 -- Monitoring and power features:**
1. Folder watching with notifications
2. Bookmarks
3. XPath query support

**Defer:** XPath query support can ship last or be cut entirely. It serves a small subset of power users.

**Rationale for ordering:**
- Phase 1 must replace the basic Windows Explorer workflow or users will not switch.
- Phase 2 delivers the primary value (finding bad files) and creates the strongest reason to adopt.
- Phase 3 delivers the second value (finding specific records) and depends on Phase 1's navigation being solid.
- Phase 4 builds on Phase 2's validation data to provide insights.
- Phase 5 adds proactive features that only matter once the reactive workflow is established.

## Sources

- [XML Explorer (GitHub)](https://github.com/xmlexplorer/windows) -- lightweight XML viewer with XPath, tree view, schema validation
- [Microsoft XML Notepad](https://microsoft.github.io/XmlNotepad/) -- tree view, diff, validation, find/replace with XPath
- [Valid characters in XML (Wikipedia)](https://en.wikipedia.org/wiki/Valid_characters_in_XML) -- definitive reference for invalid character ranges
- [Invalid Characters in XML (Baeldung)](https://www.baeldung.com/java-xml-invalid-characters) -- practical guide to detection
- [Tree View Pattern (W3C WAI)](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/) -- accessibility patterns for tree views
- [Tree View UX (Microsoft)](https://learn.microsoft.com/en-us/windows/apps/develop/ui/controls/tree-view) -- design guidance for tree views
- [FileSystemWatcher (.NET)](https://learn.microsoft.com/en-us/dotnet/api/system.io.filesystemwatcher) -- file monitoring API patterns
- [WinMerge](https://winmerge.org/) -- reference implementation for file comparison features
- [Data Quality Dashboards (DQOps)](https://dqops.com/how-to-make-a-data-quality-dashboard/) -- heatmap and dashboard patterns
