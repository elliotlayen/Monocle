# Technology Stack: Integration Explorer

**Project:** Monocle - Integration Explorer
**Researched:** 2026-05-22
**Scope:** Additions to existing Tauri 2 + React 19 + TypeScript + Rust stack

This document covers only the NEW dependencies needed for the Integration Explorer feature. The existing stack (React 19, Zustand, shadcn/ui, Monaco Editor, Tauri 2 with fs/dialog/process/updater/opener plugins, tiberius, etc.) is already documented in `.planning/codebase/STACK.md` and is not repeated here.

---

## Recommended Stack Additions

### Backend (Rust) -- XML Parsing

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `quick-xml` | 0.40 | XML parsing, validation, illegal character detection | Streaming parser that handles malformed XML gracefully instead of rejecting it outright. This is critical -- the whole point is detecting and reporting problems in XML files, not refusing to process them. `roxmltree` is read-only tree-based and fails fast on malformed input, making it unsuitable for validation/error-reporting workflows. `quick-xml` also supports serde deserialization (feature `serialize`) and non-UTF8 encodings (feature `encoding`). | HIGH |
| `encoding_rs` | 0.8 | Character encoding detection and BOM handling | The Encoding Standard implementation used by Firefox. Detects encoding from BOM, handles UTF-16LE/BE/UTF-8 transcoding. Essential for the requirement to flag encoding issues (non-UTF8, BOM problems). Extremely mature (750M+ downloads). | HIGH |

**Why quick-xml over roxmltree:** The Integration Explorer's primary value is detecting problems in XML files -- illegal characters, encoding issues, malformed entities. `roxmltree` (0.21) is a read-only tree parser that returns errors on malformed input rather than allowing you to inspect what went wrong. `quick-xml`'s streaming approach lets you read events one at a time, catching and reporting each issue with its location (line/column) without aborting the entire parse. It is also ~2x faster on medium-sized files (206K ns vs 421K ns per benchmark). The `encoding` feature flag adds automatic encoding detection from XML declarations.

### Backend (Rust) -- Text Diff

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `similar` | 2.7 | Text diffing between XML files | Implements Myers, Patience, and Hunt-McIlroy algorithms. Provides line-level, word-level, and character-level diffs with unified diff output. Dependency-free, 82M+ downloads, actively maintained by Armin Ronacher (of Flask/Sentry fame). The clear standard for text diffing in Rust. | HIGH |

### Backend (Rust) -- XPath Query (Deferred)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `xee-xpath` | 0.1 | XPath 3.1 query engine for power-user search | Modern XPath engine built by the creator of lxml. Implements XPath 3.1 with 92%+ of QT3 test suite passing. However, it is very new (0.1.x) and the API is still stabilizing. **Recommendation: defer to a later phase.** Use it when XPath query support is implemented, but do not make it a launch dependency. | LOW |

**Why not sxd-xpath:** Last released 7+ years ago (v0.4.2). Effectively abandoned. `xee-xpath` is the modern replacement but is still in early development.

### Backend (Rust) -- File Watching

No new crate needed. The existing `tauri-plugin-fs` already supports file watching via the `notify` crate when the `watch` feature flag is enabled. Currently Monocle's `Cargo.toml` lists `tauri-plugin-fs = "2"` without the watch feature -- just add it:

```toml
tauri-plugin-fs = { version = "2", features = ["watch"] }
```

The frontend already has `@tauri-apps/plugin-fs` which exposes `watch()` and `watchImmediate()` functions. No additional npm package needed.

**Confidence:** HIGH -- verified in official Tauri 2 docs.

### Backend (Rust) -- Report Export

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `csv` | 1.4 | CSV export for scan reports | The standard Rust CSV crate by BurntSushi. Serde integration for serializing structs directly to CSV rows. Already used by hundreds of thousands of projects. | HIGH |

Note: PDF export is already handled on the frontend via `jspdf` (existing dependency). JSON export uses `serde_json` (existing). Excel (.xlsx) export could be added later if needed via `rust_xlsxwriter`, but CSV covers the initial requirement.

### Backend (Rust) -- Desktop Notifications

No new Rust crate needed for basic notifications -- Tauri's event system can emit to the frontend which handles UI notifications via the existing notification store (`src/features/notifications/store.ts`). 

For OS-level desktop notifications (file watch alerts when app is in background), add the official Tauri notification plugin:

```toml
# Cargo.toml
tauri-plugin-notification = "2"
```

```bash
# Frontend
npm install @tauri-apps/plugin-notification
```

**Confidence:** HIGH -- official first-party Tauri plugin.

---

### Frontend (React/TypeScript) -- File Tree Browser

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `react-arborist` | 3.6 | Virtualized folder tree sidebar | Built specifically for file-explorer-style tree views (the docs literally say "build the equivalent of a VSCode sidebar, Mac Finder, Windows Explorer"). Virtualized rendering handles 10,000+ nodes. Supports keyboard navigation, ARIA attributes, selection, expand/collapse, and filtering. Actively maintained (published within the last week). Matches the project's "sidebar + content" layout pattern. | HIGH |

**Why not shadcn Tree View:** The shadcn tree view is a recipe/pattern, not a published package. It lacks virtualization and would need significant custom work to handle the scale of hundreds of client folders with years of date subfolders loaded lazily. react-arborist solves this out of the box.

**Why not TanStack Virtual directly:** TanStack Virtual is a low-level virtualization primitive. You would need to build the entire tree interaction model (expand/collapse, keyboard nav, selection, indentation) on top of it. react-arborist provides all of this already.

### Frontend (React/TypeScript) -- XML Rendering

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Monaco Editor (existing) | 0.55 | XML raw source view with syntax highlighting | Already in the project. Monaco has built-in XML language support -- just set `language: "xml"` on the editor model. Provides line numbers, search, folding, and the ability to add inline decorations (for marking problem lines with red squigglies). No new dependency needed. | HIGH |

**Custom XML tree view:** For the collapsible tree view of XML structure (showing elements, attributes, namespaces, comments), build a custom component using react-arborist with the parsed XML data from the Rust backend. The XML is parsed by quick-xml in Rust, serialized to a tree structure via serde, and react-arborist renders it with custom node renderers showing element names, attributes, and values. This avoids adding a third-party XML viewer component (react-xml-viewer and similar are unmaintained or too limited for the requirements around namespaces, comments, and processing instructions).

**Why not react-xml-viewer:** The existing libraries (react-xml-viewer 3.0.4, @j3lte/react-xml-view) are simplistic -- they render basic expandable tags but don't support the full requirement set (namespaces, attributes, comments, processing instructions, inline problem highlighting). Building on react-arborist with custom renderers gives full control and consistent styling with the rest of the app.

### Frontend (React/TypeScript) -- Diff Viewer

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `react-diff-viewer-continued` | 4.2 | Side-by-side and inline diff visualization | Actively maintained fork of the original react-diff-viewer. Supports split view, inline view, word-level diff highlighting, line highlighting, and virtualization for large files. JSON-optimized diff method. TypeScript types included. 500K+ weekly downloads. The diff computation happens in Rust (via `similar`), and this component just renders the result. | HIGH |

**Why not react-diff-view:** react-diff-view requires git unified diff format as input, adding unnecessary coupling. react-diff-viewer-continued takes simple old/new string pairs, which maps cleanly to "compare two XML files" without format translation.

### Frontend (React/TypeScript) -- Charts & Analytics

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `recharts` | 3.8 | Client dashboard, error heatmap, timeline view, file size trends | Recharts v3 is the most popular React charting library (2.4M weekly downloads). Composable, declarative API that fits React patterns. ~150KB bundle. Full TypeScript support. Covers all needed chart types: bar charts (file counts by date), line charts (timeline/trends), heatmaps (error rates). The app already uses shadcn/ui which pairs well with Recharts' customizable styling. | HIGH |

**Why not Tremor:** Tremor is built on Recharts and adds ~50KB of opinionated dashboard styling. The Integration Explorer needs specific chart types (heatmaps, timelines) that require Recharts-level customization anyway. Adding Tremor would mean two layers of abstraction with no benefit.

**Why not Nivo:** 500KB+ bundle for features not needed. Nivo shines with exotic chart types and server-side rendering -- neither applies here.

### Frontend (React/TypeScript) -- Tabs

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `@radix-ui/react-tabs` | latest | Tabbed interface for multiple open XML files | Radix UI is already a core dependency (7 Radix primitives in package.json). Adding Tabs follows the same pattern. shadcn/ui has a Tabs recipe built on this primitive. Accessible, keyboard-navigable, composable. | HIGH |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| XML Parsing (Rust) | `quick-xml` | `roxmltree` | Fails on malformed XML instead of reporting errors; read-only tree model doesn't support streaming error collection |
| XML Parsing (Rust) | `quick-xml` | `xml-rs` | 5-10x slower than quick-xml; pull-parser model is less ergonomic |
| Text Diff (Rust) | `similar` | `imara-diff` | Less ergonomic API; `similar` has better high-level interfaces (TextDiff) and wider adoption |
| XPath (Rust) | `xee-xpath` (deferred) | `sxd-xpath` | Abandoned (7+ years since last release) |
| Tree View (React) | `react-arborist` | shadcn Tree View | No virtualization, no built-in keyboard nav, requires significant custom code |
| Tree View (React) | `react-arborist` | `@tanstack/react-virtual` | Low-level primitive -- would need to build tree interaction model from scratch |
| XML View (React) | Custom (on react-arborist) | `react-xml-viewer` | Too simplistic; lacks namespace/comment/PI support; no inline problem highlighting |
| Diff View (React) | `react-diff-viewer-continued` | `react-diff-view` | Requires git unified diff format input; unnecessary coupling |
| Charts (React) | `recharts` | `tremor` | Extra abstraction layer over Recharts with no benefit for this use case |
| Charts (React) | `recharts` | `nivo` | 500KB+ bundle; features (SSR, exotic charts) not needed |
| File Watch (Rust) | `tauri-plugin-fs` + watch feature | `notify` directly | The Tauri plugin already wraps notify; using it directly would bypass Tauri's permission system |
| Notifications | `tauri-plugin-notification` | Custom notification system | Official plugin handles OS-level notifications cross-platform; no need to reinvent |

---

## Installation

### Rust (add to `src-tauri/Cargo.toml`)

```toml
# XML parsing with encoding support
quick-xml = { version = "0.40", features = ["serialize", "encoding"] }

# Character encoding detection (BOM, non-UTF8)
encoding_rs = "0.8"

# Text diffing for file comparison
similar = "2.7"

# CSV export for scan reports
csv = "1.4"

# Desktop notifications (file watch alerts)
tauri-plugin-notification = "2"

# Update existing entry to enable watch feature
# Change: tauri-plugin-fs = "2"
# To:
tauri-plugin-fs = { version = "2", features = ["watch"] }
```

### Frontend (npm install)

```bash
# File tree browser (virtualized)
npm install react-arborist

# Diff viewer
npm install react-diff-viewer-continued

# Charts for analytics dashboards
npm install recharts

# Desktop notifications (Tauri plugin frontend)
npm install @tauri-apps/plugin-notification

# Tabs (shadcn/ui primitive -- likely already available via Radix)
npx shadcn@latest add tabs
```

### No-Install Items (already available)

- **Monaco Editor** -- XML syntax highlighting via `language: "xml"` (already in project)
- **Zustand** -- New stores for explorer state, bookmarks, favorites (already in project)
- **jspdf** -- PDF export for scan reports (already in project)
- **serde/serde_json** -- Serializing XML tree data to frontend (already in project)
- **tauri-plugin-fs** -- File reading, directory listing (already in project, just needs `watch` feature)
- **tauri-plugin-dialog** -- Folder picker for configuring sources (already in project)
- **chrono** -- Date parsing for YYYYMMDD folder names (already in project)
- **regex** -- Filename pattern matching (already in project)

---

## Version Verification

| Package | Verified Version | Source | Date Checked |
|---------|-----------------|--------|--------------|
| `quick-xml` | 0.40.1 | crates.io | 2026-05-22 |
| `encoding_rs` | 0.8.35 | crates.io / docs.rs | 2026-05-22 |
| `similar` | 2.7.0 | crates.io | 2026-05-22 |
| `csv` | 1.4.0 | crates.io | 2026-05-22 |
| `roxmltree` | 0.21.1 | crates.io (not recommended) | 2026-05-22 |
| `react-arborist` | 3.6.1 | npm | 2026-05-22 |
| `react-diff-viewer-continued` | 4.2.2 | npm | 2026-05-22 |
| `recharts` | 3.8.1 | npm | 2026-05-22 |
| `tauri-plugin-notification` | 2.x | crates.io + npm | 2026-05-22 |
| `tauri-plugin-fs` (watch feature) | 2.x | Tauri official docs | 2026-05-22 |
| `xee-xpath` | 0.1.6 | crates.io (deferred) | 2026-05-22 |

---

## Sources

- [quick-xml on crates.io](https://crates.io/crates/quick-xml)
- [quick-xml docs](https://docs.rs/quick-xml/latest/quick_xml/)
- [roxmltree on GitHub](https://github.com/RazrFalcon/roxmltree)
- [similar on GitHub](https://github.com/mitsuhiko/similar)
- [similar on crates.io](https://crates.io/crates/similar)
- [encoding_rs on crates.io](https://crates.io/crates/encoding_rs)
- [encoding_rs on GitHub](https://github.com/hsivonen/encoding_rs)
- [csv on crates.io](https://crates.io/crates/csv)
- [xee-xpath on GitHub](https://github.com/Paligo/xee)
- [Xee announcement blog post](https://blog.startifact.com/posts/xee/)
- [react-arborist on npm](https://www.npmjs.com/package/react-arborist)
- [react-arborist on GitHub](https://github.com/brimdata/react-arborist)
- [react-diff-viewer-continued on npm](https://www.npmjs.com/package/react-diff-viewer-continued)
- [react-diff-viewer-continued on GitHub](https://github.com/Aeolun/react-diff-viewer-continued)
- [recharts on npm](https://www.npmjs.com/package/recharts)
- [Recharts v3 migration guide](https://github.com/recharts/recharts/wiki/3.0-migration-guide)
- [Tauri 2 File System plugin docs](https://v2.tauri.app/plugin/file-system/)
- [Tauri 2 Notification plugin docs](https://v2.tauri.app/plugin/notification/)
- [Monaco Editor XML language support](https://deepwiki.com/microsoft/monaco-editor/3.1-language-support-system)
- [XML parsing in Rust comparison](https://mainmatter.com/blog/2020/12/31/xml-and-rust/)
- [Recharts vs Tremor vs Nivo comparison](https://www.pkgpulse.com/guides/recharts-v3-vs-tremor-vs-nivo-react-charting-2026)

---

*Stack research: 2026-05-22*
