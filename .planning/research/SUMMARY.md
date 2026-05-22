# Project Research Summary

**Project:** Monocle - Integration Explorer
**Domain:** Desktop XML file browser and validation tool for network share integration files
**Researched:** 2026-05-22
**Confidence:** HIGH

## Executive Summary

The Integration Explorer is a new major feature for Monocle that adds an XML file browser and validation tool alongside the existing SQL Server schema visualizer. The tool targets a department that manually browses network shares via Windows Explorer to inspect XML integration files, find illegal characters, and locate specific records across hundreds of client folders organized by date. Expert-built tools in this space (XML Notepad, Oxygen, VS Code) all follow the same pattern: tree sidebar for navigation, tabbed viewers for content, and a problems panel for validation results. The difference here is that this tool must operate over VPN-accessed SMB network shares, which fundamentally changes every architectural decision around I/O.

The recommended approach is to build the Integration Explorer as an isolated feature module within Monocle's existing Tauri 2 + React + Rust architecture. A new `explorer/` Rust module handles all file system and XML parsing operations, a dedicated Zustand store manages explorer state independently from the schema store, and the frontend follows the established feature-based component structure. The stack additions are minimal and high-confidence: `quick-xml` for streaming XML parsing (critical for analyzing malformed files), `encoding_rs` for encoding detection, `similar` for text diffing, `react-arborist` for the virtualized folder tree, and `recharts` for analytics dashboards. All recommended libraries are mature, actively maintained, and well-suited to their purpose.

The dominant risk is network I/O performance over VPN-accessed SMB shares. Every operation -- directory listing, file reading, searching, bulk scanning -- goes over a network link with 20-30ms per round-trip latency and no native file-watching support. Five of the fifteen identified pitfalls relate directly to network I/O. Mitigation requires aggressive lazy loading, timeouts on every I/O call, Tauri Channels for streaming results, polling-based file watching (not native watchers), and graceful handling of VPN disconnection. These patterns must be established in the first phase because every subsequent feature inherits them. A secondary risk is the parser design: the tool's purpose is finding malformed XML, so the parser must handle broken files gracefully rather than rejecting them -- a two-pass approach (byte-level scan then structural parse) solves this.

## Key Findings

### Recommended Stack

The existing Monocle stack (Tauri 2, React 19, TypeScript, Rust, Zustand, shadcn/ui, Monaco Editor) requires only targeted additions. No framework-level changes are needed. All new dependencies are additive and well-isolated.

**Core technologies (Rust):**
- `quick-xml` 0.40: XML streaming parser -- handles malformed XML gracefully for validation/error-reporting; 2x faster than alternatives; supports encoding detection and serde
- `encoding_rs` 0.8: Character encoding detection -- WHATWG standard implementation; deterministic BOM detection; handles UTF-16/Windows-1252/ISO-8859-1
- `similar` 2.7: Text diffing -- Myers/Patience algorithms; line/word/character diffs; standard Rust diff crate by Armin Ronacher
- `csv` 1.4: CSV export for scan reports -- serde integration for struct-to-row serialization

**Core technologies (Frontend):**
- `react-arborist` 3.6: Virtualized tree view -- handles 10,000+ nodes; keyboard navigation; ARIA accessibility; built for file-explorer UIs
- `react-diff-viewer-continued` 4.2: Diff visualization -- split/inline view; word-level highlighting; takes simple old/new strings
- `recharts` 3.8: Charts for client dashboard, error heatmap, timeline -- composable React API; 2.4M weekly downloads
- Monaco Editor (existing): XML syntax highlighting via `language: "xml"` -- already bundled; DiffEditor built-in for file comparison

**No-install items:** File watching via existing `tauri-plugin-fs` (just enable `watch` feature flag). Notifications via existing toast store for in-app, `tauri-plugin-notification` for OS-level. Tabs via Radix UI (already a dependency). Date parsing via `chrono` (already in Cargo.toml).

**Deferred:** `xee-xpath` for XPath query support -- too new (0.1.x), API unstable. Defer to a later phase or cut entirely.

See [STACK.md](STACK.md) for full rationale and alternatives analysis.

### Expected Features

**Must have (table stakes) -- users will not switch from Windows Explorer without these:**
- Folder tree sidebar with lazy-loading (Root > Client > Date > Files)
- Configurable folder sources (inbound, outbound, personal roots)
- XML file viewer with tree + raw source toggle
- Tabbed interface for multiple open files
- Illegal character detection with visual indicators, problems panel, and inline highlighting
- Date folder formatting (YYYYMMDD displayed as human-readable)
- File search (filename pattern) and content search (field-level, across files)
- File actions (copy path, open externally, copy content)

**Should have (differentiators) -- significant value above generic tools:**
- Bulk validation scan with progress streaming and export (CSV, PDF, JSON)
- Configurable search scope (folder / client / all sources)
- File comparison with side-by-side and inline diff
- Client favorites / pinning
- Client dashboard with file counts, error rates, timeline
- Error heatmap across clients and dates

**Defer (v2+):**
- Folder watching with desktop notifications (complex due to network share limitations)
- Bookmarks with notes
- XPath query support (niche power-user feature)
- File size anomaly detection (nice-to-have analytics)

**Anti-features (explicitly do not build):**
- XML editing/fixing (read-only tool; identifies issues, does not modify source files)
- Schema (XSD/DTD) validation (schemas not available; focus on well-formedness)
- XSLT transformation (developer feature, not target audience)
- Database integration (Explorer and Schema Graph are independent modes)
- Full-text indexing (lazy-loading approach fits VPN-accessed shares better)

See [FEATURES.md](FEATURES.md) for dependency graph and detailed rationale.

### Architecture Approach

The Integration Explorer integrates as a new top-level mode in App.tsx (alongside "home", "schema", and "canvas") with a completely separate state domain. The Rust backend gets a new `explorer/` module parallel to `db/` (not inside it), containing `folder_reader.rs`, `xml_parser.rs`, `xml_search.rs`, `file_watcher.rs`, and `types.rs`. Thin command handlers in `commands/explorer.rs` delegate to this module, following the existing `commands/schema.rs` -> `db/` pattern. The frontend gets a new `features/integration-explorer/` directory with its own Zustand store, services, hooks, and components -- zero coupling to the schema feature.

**Major components:**
1. `ExplorerView` -- Shell layout: sidebar + tabs + content + panels (problems, search)
2. `FolderTree` -- Sidebar tree using react-arborist with lazy-loaded nodes from Rust
3. `XmlViewer` -- Tab content: tree view (react-arborist with custom XML node renderers) + source view (Monaco with inline problem markers)
4. `ProblemsPanel` -- VS Code-style issue list with line numbers; click to jump in source
5. `ExplorerStore` (Zustand) -- All explorer state: tree nodes, open tabs, active file, search results, validation results
6. `explorer/xml_parser.rs` (Rust) -- Streaming XML parse with quick-xml; two-pass validation (byte scan + structural parse)
7. `explorer/folder_reader.rs` (Rust) -- Async directory listing with timeout, pagination, and SMB cache awareness

**Key architectural decisions:**
- Tauri Channels (not events) for streaming search results and bulk scan progress
- All file I/O in Rust via custom commands (not tauri-plugin-fs from frontend) to enable encoding detection, validation, and structured result serialization
- Flat `Record<string, TreeNode>` map in Zustand for O(1) node lookups instead of nested tree
- LRU cache for open tab content to prevent memory leaks during all-day usage

See [ARCHITECTURE.md](ARCHITECTURE.md) for system diagram, data flows, and layer dependency graph.

### Critical Pitfalls

1. **Blocking UI on network I/O** -- Every SMB call can take 50ms-30s over VPN. ALL file I/O must run on Tokio thread pool with `tokio::time::timeout()`. Show skeleton/loading states immediately. Use Tauri Channels for streaming. This pattern must be established in the first phase; everything inherits it.

2. **`tokio::fs::read_dir` hangs on network paths** -- Known tokio issue (#5473) where directory iteration never terminates on UNC paths. Wrap in timeout, set max entry count per directory (10,000), consider `std::fs::read_dir` in manual `spawn_blocking` for more control.

3. **Cross-platform path incompatibility** -- Windows UNC (`\\server\share`) vs macOS mount points (`/Volumes/`). Use `std::path::Path` abstractions, validate paths at configuration time, never attempt to normalize across platforms.

4. **File watcher silent failure on network shares** -- Native watchers (FSEvents, ReadDirectoryChangesW) do not deliver events for network filesystems. Must use polling via `notify::PollWatcher` with configurable interval (30-60s). Auto-detect network paths and fall back to polling.

5. **Large file IPC serialization** -- A 50MB XML file doubles in memory through JSON serialization over Tauri IPC. Stream content in chunks via Channels. Parse XML in Rust and send structured tree data, not raw XML. Set file size warning thresholds.

See [PITFALLS.md](PITFALLS.md) for all 15 pitfalls with detection strategies and phase assignments.

## Implications for Roadmap

Based on combined research, the architecture dependency graph and feature dependencies strongly suggest a 5-phase structure. Layers 4, 5, and 6 from the architecture (validation, search, comparison) can proceed in parallel once the core is stable.

### Phase 1: Core Browsing and File Viewing

**Rationale:** The folder tree, file viewer, and tabs form the foundational layer (Architecture Layers 0-3). Every subsequent feature depends on being able to navigate folders and open files. This phase also establishes the critical I/O patterns (async + timeout + loading states) that all later phases inherit. Users must be able to replace their Windows Explorer workflow or they will never adopt the tool.

**Delivers:** Navigable folder tree with lazy loading, XML file viewer (tree + source), tabbed interface, configurable folder sources, date folder formatting, file actions, client favorites.

**Addresses features:** Folder tree sidebar, lazy-loading, XML file viewer (tree + raw), configurable folder sources, date folder formatting, tabbed interface, file actions, copy content, client favorites.

**Avoids pitfalls:** #1 (blocking UI), #2 (read_dir hangs), #3 (cross-platform paths), #5 (large file serialization), #7 (stale SMB cache), #10 (tab memory leaks), #11 (date folder naming), #12 (file size metadata), #15 (FS plugin scope).

**Stack used:** quick-xml, encoding_rs, react-arborist, Monaco Editor (XML mode), tauri-plugin-fs (watch feature flag), Radix Tabs.

### Phase 2: Validation Engine

**Rationale:** Illegal character detection is the primary value proposition -- the single strongest reason to adopt the tool. It depends on the file viewer being stable (needs inline markers in source view and the problems panel) but has no dependency on search or comparison. Architecture Layer 4.

**Delivers:** Illegal character detection, visual problem indicators on tree nodes, problems panel with line numbers and click-to-jump, inline problem highlighting in source view, bulk validation scan with progress, scan report export.

**Addresses features:** Illegal character detection, visual problem indicators, problems panel, inline problem highlighting, bulk validation scan, scan report export.

**Avoids pitfalls:** #6 (strict parser on malformed XML -- must use two-pass approach), #13 (encoding detection accuracy -- use encoding_rs with confidence levels), #14 (bulk scan taking hours -- streaming progress, cancellation, partial reports).

**Stack used:** quick-xml (lenient mode), encoding_rs, csv (export), similar (for diff-based validation context).

### Phase 3: Search

**Rationale:** Content search is the second value proposition. It can be built in parallel with Phase 2 since both depend on the Phase 1 core but not on each other. Architecture Layer 5. Requires the Tauri Channel streaming pattern established in Phase 1.

**Delivers:** Filename search/filtering, field-level content search across files, configurable search scope (folder / client / all sources), streaming results.

**Addresses features:** File search, content search, configurable search scope.

**Avoids pitfalls:** #8 (excessive network traffic -- rate-limit concurrent reads, show scope estimate before executing, streaming results with cancellation), #9 (VPN disconnection -- idempotent operations, timeout + recovery).

**Stack used:** quick-xml (for XML content parsing during search), Tauri Channels (streaming results).

### Phase 4: Comparison and Analytics

**Rationale:** File comparison and analytics dashboards build on Phases 1-2. Comparison needs the file viewer; analytics needs bulk scan data. Architecture Layers 6-7 (minus file watching). These are differentiator features that deepen the tool's value but are not required for initial adoption.

**Delivers:** Side-by-side and inline file diff, client dashboard with file counts and error rates, error heatmap, timeline view, file size anomaly detection.

**Addresses features:** File comparison (diff), client dashboard, error heatmap, timeline view, file size anomaly detection.

**Avoids pitfalls:** #5 (large file serialization in diff -- chunk-based loading), #10 (memory from holding two large files -- virtualized diff rendering).

**Stack used:** similar (Rust-side diff computation), react-diff-viewer-continued (or Monaco DiffEditor), recharts (dashboard charts).

### Phase 5: Monitoring and Power Features

**Rationale:** Folder watching is complex due to network share limitations (Pitfall #4) and should only be built once the core tool is stable and adopted. XPath and bookmarks serve power users and are not adoption-critical. Architecture Layer 7.

**Delivers:** Folder watching with polling fallback for network shares, desktop notifications for new files, bookmarks with notes, XPath query support (optional).

**Addresses features:** Folder watching, bookmarks, XPath query support.

**Avoids pitfalls:** #4 (watcher silent failure -- poll-based with auto-detection of network paths), #7 (stale SMB cache -- polling interval > SMB cache lifetime).

**Stack used:** tauri-plugin-fs (watch feature), tauri-plugin-notification, xee-xpath (if XPath is included).

### Phase Ordering Rationale

- **Phase 1 first** because every other feature depends on folder navigation and file viewing. The I/O patterns (async + timeout + streaming + loading states) established here are inherited by all subsequent phases.
- **Phases 2 and 3 can overlap** -- validation and search are independent features that both depend on Phase 1 but not on each other. Architecture confirms Layers 4 and 5 are parallel.
- **Phase 4 after Phase 2** because analytics dashboards need bulk scan data to populate, and diff needs the file viewer infrastructure.
- **Phase 5 last** because folder watching has the highest risk (network share limitations) and lowest adoption impact. Building it on a stable foundation reduces risk.
- **This ordering matches the FEATURES.md MVP recommendation** and the ARCHITECTURE.md layer dependency graph, providing strong cross-validation.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** Network I/O patterns on SMB over VPN need validation with real shares. The `tokio::fs::read_dir` hang issue (#5473) may require testing specific workarounds. react-arborist integration with lazy-loaded async data needs prototyping.
- **Phase 3:** Search performance at scale (hundreds of clients, thousands of files) over VPN is hard to predict without profiling. Caching/indexing strategy may need adjustment based on real usage patterns.
- **Phase 5:** File watcher behavior on network shares is inherently platform-specific and poorly documented. Polling interval tuning requires real-world testing.

Phases with standard patterns (skip research-phase):
- **Phase 2:** XML validation and illegal character detection are well-documented domains. quick-xml's streaming parser is well-suited. The two-pass approach (byte scan + structural parse) is a known pattern.
- **Phase 4:** Diff computation with `similar` and rendering with react-diff-viewer-continued are straightforward integrations. Recharts dashboards follow standard patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All recommended crates/packages are mature (millions of downloads), actively maintained, and verified on crates.io/npm. Versions confirmed as of 2026-05-22. No experimental dependencies except deferred xee-xpath. |
| Features | HIGH | Feature landscape derived from established tools (XML Notepad, VS Code, Oxygen) and the specific workflow described in PROJECT.md. Feature dependencies are well-understood. Anti-features clearly scoped. |
| Architecture | HIGH | Architecture follows Monocle's existing patterns (feature modules, service layer, Zustand stores, thin Tauri commands). No novel architectural decisions -- extending a proven structure. Layer dependency graph is clear. |
| Pitfalls | HIGH | 12 of 15 pitfalls backed by specific GitHub issues, Microsoft documentation, or Tauri official docs. Network I/O pitfalls are well-known in the SMB/VPN domain. Two pitfalls (encoding detection, date parsing) are lower-confidence edge cases. |

**Overall confidence:** HIGH

### Gaps to Address

- **Real-world VPN/SMB performance profiling:** All latency estimates are based on documented SMB behavior, not measured on the target infrastructure. Phase 1 should include a performance test pass with actual network shares.
- **tokio::fs::read_dir workaround validation:** The recommended workaround (manual `spawn_blocking` with `std::fs::read_dir` and timeout) needs testing on Windows UNC paths specifically. The tokio issue is confirmed but the workaround is community-suggested.
- **react-arborist async lazy loading:** The library supports lazy loading but integration with Tauri IPC async calls needs prototyping. If the integration proves awkward, TanStack Virtual with custom tree logic is the fallback.
- **Monaco DiffEditor vs react-diff-viewer-continued:** Two viable options for file comparison. Monaco DiffEditor is already bundled but is full-featured (possibly overkill). react-diff-viewer-continued is lighter but adds a new dependency. Decision can be deferred to Phase 4 implementation.
- **Large file threshold:** The 10MB warning threshold for file loading is an estimate. Real-world XML integration files should be profiled to determine actual size distribution and set an appropriate threshold.

## Sources

### Primary (HIGH confidence)
- [quick-xml on crates.io](https://crates.io/crates/quick-xml) -- XML parsing capabilities, version, features
- [encoding_rs on crates.io](https://crates.io/crates/encoding_rs) -- encoding detection, WHATWG standard
- [similar on crates.io](https://crates.io/crates/similar) -- diff algorithms, API design
- [react-arborist on npm](https://www.npmjs.com/package/react-arborist) -- virtualized tree, API, maintenance status
- [Tauri 2 File System plugin docs](https://v2.tauri.app/plugin/file-system/) -- watch feature, scope configuration
- [Tauri 2 Calling Frontend docs](https://v2.tauri.app/develop/calling-frontend/) -- Channels vs events for streaming
- [tokio-rs/tokio#5473](https://github.com/tokio-rs/tokio/issues/5473) -- read_dir network path issue
- [notify-rs/notify#475](https://github.com/notify-rs/notify/issues/475) -- NFS mount watching failure
- [Microsoft: SMB Directory Cache Lifetime](https://woshub.com/slow-network-shared-folder-refresh-windows-server/) -- SMB caching behavior
- [Tauri #13405](https://github.com/tauri-apps/tauri/issues/13405) -- IPC payload size limitations

### Secondary (MEDIUM confidence)
- [react-diff-viewer-continued on npm](https://www.npmjs.com/package/react-diff-viewer-continued) -- diff rendering capabilities
- [recharts on npm](https://www.npmjs.com/package/recharts) -- charting for dashboards
- [Mirazon: SMB over VPN performance](https://www.mirazon.com/issues-with-smb-file-transfer-performance-over-vpn/) -- VPN latency multipliers
- [usethe.computer: XMHell](https://usethe.computer/posts/14-xmhell.html) -- large XML handling in Rust

### Tertiary (LOW confidence)
- [xee-xpath on GitHub](https://github.com/Paligo/xee) -- XPath 3.1 engine; promising but 0.1.x; needs validation before adoption

---
*Research completed: 2026-05-22*
*Ready for roadmap: yes*
