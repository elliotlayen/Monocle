# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Monocle is a Tauri desktop application for visualizing SQL Server database schemas. It connects to SQL Server via tiberius (TDS protocol), loads table/column/foreign key metadata, and renders an interactive relationship graph similar to Supabase's schema visualizer.

## Common Commands

```bash
# Development (runs Vite dev server + Tauri)
npm run tauri dev

# Build for production
npm run tauri build

# Frontend only (no Tauri)
npm run dev

# Type check and build frontend
npm run build

# Run tests
npm run test

# Lint code
npm run lint
npm run lint:fix    # Auto-fix issues

# Format code
npm run format      # Write formatted files
npm run format:check  # Check without writing
```

## Architecture

### Frontend (React + TypeScript)

The frontend uses a feature-based architecture with a services layer for Tauri IPC.

```
src/
  features/
    connection/
      components/
        home-screen.tsx             - Landing page with recent connections
        connection-modal.tsx        - Database connection dialog
        server-connection-form.tsx  - Shared server connection form
        monocle-logo.tsx            - Logo component
      services/
        connection-service.ts       - Tauri IPC for connection history
        connection-settings.ts      - Connection settings localStorage persistence
        database-service.ts         - Tauri IPC for database operations
    schema-graph/
      components/
        schema-graph.tsx            - Main graph view with filtering/focus
        schema-browser-sidebar/     - Virtualized, store-connected sidebar
          index.tsx                 - Sidebar shell (search, tree, keyboard nav)
          sidebar-tree.ts           - Pure tree build/flatten (tested)
          sidebar-row.tsx           - Memoized row renderer
        sidebar-toggle.tsx          - Toggle button for sidebar
        table-node.tsx              - Table node (thin variant over shared body)
        view-node.tsx               - View node (thin variant over shared body)
        table-view-node-shared.tsx  - Shared table/view node body and column rows
        trigger-node.tsx            - Custom node for triggers
        stored-procedure-node.tsx   - Custom node for procedures
        scalar-function-node.tsx    - Custom node for functions
        layout.ts                   - Layered overview layout (Tarjan + Kahn)
        focus-layout.ts             - Focus-mode compact neighborhood layout
        focus-state.ts              - Focus dimming/renderable set derivation
        aux-layout.ts               - Shared aux lane layout helpers
        edge-state.ts               - Edge derivation, styling, equivalence
        edge-visibility.ts          - Edge/handle renderability checks
        node-render-update.ts       - Efficient node render diffing
        zoom-band.ts                - Discrete zoom band thresholds
        detail-inspector.tsx        - Floating inspector panel for object details
        detail-drawer.tsx           - Bottom drawer for object details
        detail-content.tsx          - Content for detail popover
        sql-code-block.tsx          - Monaco SQL syntax highlighting (readonly)
      hooks/
        useFilteredCounts.ts        - Filter statistics hook
        use-detail-view.ts          - Detail view state, presence, dismissal hooks
      services/
        schema-service.ts           - Tauri IPC for schema loading
      utils/
        object-filtering.ts         - Shared object filtering logic
        browse-visibility.ts        - Browse-mode visible-set derivation
      store.ts                      - Zustand store for schema state
      types.ts                      - TypeScript types (SchemaGraph, TableNode, etc.)
    settings/
      components/
        sections/                   - Per-section panels (display-options.ts, node-style-field.tsx, graph-display-fields.tsx shared)
        node-style-preview.tsx      - Live preview of the selected graph node style
        xml-node-style-preview.tsx  - Live preview of the selected explorer node style
      services/
        settings-service.ts         - Tauri IPC for settings persistence
    toolbar/
      components/
        toolbar.tsx                 - Main toolbar with controls
        filter-info-bar.tsx         - Active filter display
        database-selector.tsx       - Database dropdown
        focus-selector.tsx          - Focus/browse selection dropdown
      types.ts                      - Search result types
    export/
      components/
        export-button.tsx           - Export dropdown button
      hooks/
        useExport.ts                - Export logic hook
      services/
        export-service.ts           - Export service
      utils/
        png-export.ts               - PNG export logic
        pdf-export.ts               - PDF export logic
        json-export.ts              - JSON export logic
    canvas/
      components/
        sql-editor.tsx              - Monaco SQL editor (editable)
        create-table-dialog.tsx     - Create table dialog
        create-view-dialog.tsx      - Create view dialog
        create-function-dialog.tsx  - Create function dialog
        create-procedure-dialog.tsx - Create procedure dialog
        create-trigger-dialog.tsx   - Create trigger dialog
        import-from-database-dialog.tsx       - Import from database dialog
        import-from-database-dialog-state.ts  - Import dialog session state
        object-dialog-layout.ts     - Dialog layout CSS class constants
        column-editor.tsx           - Column editor for table dialogs
        parameter-editor.tsx        - Parameter editor for procedure/function dialogs
    notifications/
      store.ts                      - Notification state
  services/
    tauri.ts                        - Centralized Tauri IPC wrapper
    events.ts                       - Event hub for Tauri events
  lib/
    schema-index.ts                 - Schema search index and relationship lookups
    monaco-sql-loader.ts            - Lazy Monaco Editor + SQL language loader
    monaco-themes.ts                - Monocle Monaco themes (hexes mirror index.css tokens)
    sql-intellisense.ts             - SQL autocomplete provider for schema objects
  utils/
    index.ts                        - Utility exports
    formatting.ts                   - String/number formatting helpers
  hooks/
    use-resolved-theme.ts           - Theme resolution hook (system/dark/light)
  types/                            - TypeScript type declarations
  components/
    app-settings-sheet.tsx          - Settings dialog shell (section nav + panes)
    ui/                             - shadcn/ui components
  constants/
    edge-colors.ts                  - Edge color constants
  providers/
    theme-provider.tsx              - Theme context provider
  App.tsx                           - Root component
  main.tsx                          - Entry point
```

### Backend (Rust + Tauri)

```
src-tauri/src/
  lib.rs              - Tauri app setup, registers commands and state
  main.rs             - Entry point
  state.rs            - AppState with Mutex<AppSettings> for thread-safe persistence
  commands/
    schema.rs         - load_schema_cmd (real database)
    mock.rs           - load_schema_mock (test data)
    connections.rs    - Connection history CRUD commands
    databases.rs      - Database listing commands
    settings.rs       - Settings persistence commands
    explorer.rs       - Explorer file browsing, content search, bulk scan commands
  db/
    connection.rs     - Tiberius connection management
    queries.rs        - SQL queries for metadata
    schema_loader.rs  - Parses results into SchemaGraph
  validation/
    validator.rs      - XML validation (illegal chars, encoding, BOM detection)
  types/
    schema.rs         - Rust type definitions mirroring frontend types
```

### Key Data Flow

1. Frontend calls service (e.g., `schemaService.loadSchema(params)`)
2. Service invokes Tauri command via `invoke<SchemaGraph>("load_schema_cmd", { params })`
3. Rust connects via tiberius, executes SQL Server metadata queries
4. Results parsed into `SchemaGraph` struct, serialized to JSON
5. Frontend receives data, stores in Zustand, converts to React Flow nodes/edges

### State Persistence

- `AppState` in Rust manages settings via `Mutex<AppSettings>`
- Settings persist to `{app_data_dir}/settings.json`
- Connection history (last 10) saved automatically on successful connect
- Connection settings (server, auth type, username) persist to localStorage
- Schema filter preference restored on app launch

## Architecture Guidelines

### Frontend Guidelines

- **Components**: Presentational only. Props in, UI out. No direct Tauri IPC calls.
- **Hooks**: Own state, side effects, and event wiring.
- **Services**: All Tauri IPC goes through `src/features/*/services/`.
- **Store**: Schema state managed via Zustand in `src/features/schema-graph/store.ts`.
- **UI Components**: Use shadcn/ui from `src/components/ui/`.

### Backend Guidelines

- Keep Tauri commands thin - delegate to modules in `db/` and `commands/`.
- Put database query logic in `src-tauri/src/db/queries.rs`.
- Put connection logic in `src-tauri/src/db/connection.rs`.
- State mutations go through `AppState` in `src-tauri/src/state.rs`.

## Common Changes (Where to Look First)

- **UI layout or styling**: `src/features/*/components/*` and `src/components/ui/*`
- **Schema visualization**: `src/features/schema-graph/components/*`
- **Connection handling**: `src/features/connection/*` and `src-tauri/src/commands/connections.rs`
- **Tauri IPC shape**: `src/services/tauri.ts`, `src/features/*/services/*`, and `src-tauri/src/lib.rs`
- **Schema queries**: `src-tauri/src/db/queries.rs`
- **Settings persistence**: `src/features/settings/*` and `src-tauri/src/commands/settings.rs`
- **App state**: `src-tauri/src/state.rs`
- **Graph layout/nodes**: `src/features/schema-graph/components/table-node.tsx`, `schema-graph.tsx`
- **Export functionality**: `src/features/export/*`

## Adding a New Tauri Command

1. Define the command in `src-tauri/src/commands/*.rs`
2. Register it in `src-tauri/src/lib.rs` (`tauri::generate_handler!`)
3. Add the command to `src/services/tauri.ts` (centralized IPC wrapper)
4. Add the service wrapper in `src/features/*/services/*-service.ts`
5. Call the service from your component or hook

## Type Consistency

TypeScript types in `src/features/schema-graph/types.ts` must stay in sync with Rust types in `src-tauri/src/types/schema.rs`. Both use camelCase field names (Rust uses `#[serde(rename_all = "camelCase")]`).

## Validation

At the end of a task:

1. Run `npm run lint`
2. Run `npm run test` when you touched schema-graph, connection, settings, or services
3. Run `npm run build` (includes typecheck)
4. If you changed Rust code, run `cargo check` in `src-tauri/`

## Prerequisites

- Rust toolchain for Tauri backend
- Node.js for frontend

No external database drivers needed - tiberius connects to SQL Server directly via TDS protocol.

## Code Style

- **No emojis**: Do not use emojis anywhere in code, comments, commits, or documentation
- **Commit messages**: Do not include "Generated with Claude Code" or "Co-Authored-By" lines
- **Components**: Use shadcn/ui for UI components

## Design System ("Instrument")

- All color identity lives in `src/index.css` tokens: shadcn semantics plus `--object-*` (five object types), `--edge-*`, `--accent-blue`, glass panel tokens (`--panel-bg/border/blur/shadow`), and motion tokens (`--ease-out`, `--ease-in-out`, `--duration-fast/base/slow`). Dark is the design source; light derives from the same ramp. Never hardcode palette hexes in components; `EDGE_COLORS`/`OBJECT_COLORS` in `src/constants/edge-colors.ts` are `var(--...)` references.
- Chrome floats over a full-bleed canvas as `.panel-glass` panels (toolbar, sidebar, status strip, filter chips, detail views). The sidebar overlays the canvas; it does not push layout.
- JetBrains Mono is the body face, self-hosted via `@fontsource/jetbrains-mono` (weights 400-700, imported in `main.tsx`). No Google Fonts CDN.
- Motion: CSS-only, transform/opacity, sub-300ms, tokens for easing/duration, `active:scale-[0.97]` press feedback in the button primitive, global `prefers-reduced-motion` override in `index.css`. Nodes keep the transition-shadow-only constraint (see `table-view-node-shared.tsx`).
- Toasts render through Sonner behind the existing `useToastStore`/`showToast` API in `src/features/notifications/store.tsx` (headless `toast.custom` content). One `<Toaster />` mounts in `App.tsx`.
- Monaco editors use the `monocle-dark`/`monocle-light` themes from `src/lib/monaco-themes.ts`; its hexes mirror the CSS tokens and must be kept in sync.
- Object details open per the `detailViewMode` setting ("inspector" | "drawer"), persisted like `showMiniMap`.
- Node color identity is chosen by the `nodeStyle` setting ("tinted" | "surface" | "adaptive" | "solid", default "adaptive"), persisted like `detailViewMode`. `src/features/schema-graph/components/node-style.ts` (`getNodeStyleSpec`) is the single source for node and settings-preview styling; it derives everything from `OBJECT_COLORS` plus `color-mix()` and `--object-on-color`, and never changes node geometry. "adaptive" keys off the per-node `isCompact` flag, which every node kind now receives from the zoom band.
- Canvas Mode persists its own display set (`canvasNodeStyle`, `canvasEdgeLabelMode`, `canvasShowMiniMap`, `canvasDetailViewMode`). Consumers select by `canvasMode` through `useGraphDisplaySettings` / `selectNodeStyle` exported from the schema store; never read the plain or canvas fields directly in graph components.
- The Integration Explorer XML tree has its own `explorerNodeStyle` ("soft" | "capsule" | "outline" | "depth", default "soft") in the explorer store, hydrated in `loadSources`. `src/features/explorer/utils/xml-node-style.ts` (`getXmlNodeStyleSpec`) is the single source for the tree card and its settings preview; it derives from `XML_KIND_COLORS` plus `color-mix()`, never paints on-color, and never changes `XML_NODE_HEIGHT` or the estimated widths. `XmlNodeCard` in `xml-flow-node.tsx` is the shared presentational card.
- The settings dialog nav is grouped by feature (Schema Browser, Canvas Mode, Integration Explorer, General) with uppercase group titles, and opens on the group matching the current app `mode`.

## Notes

- React Flow nodes require unique IDs matching the data model
- Schema filter state persists across sessions via settings
- Connection passwords are not stored - only connection metadata
- The app uses React Flow's dagre layout for automatic positioning
- Monaco Editor provides SQL syntax highlighting and intellisense (replaces prism-react-renderer)
- Edge direction convention: FK child -> parent; reads table -> code object; writes code object -> table; calls caller -> callee. An arrow into a code object means it reads that; an arrow out of it into a table means it writes it.
- Relationship edge IDs are unique per FK column pair (from::fk_name::col->col); never assume one edge per constraint.
- Browse mode: databases over the configurable object threshold start with an empty canvas; the graph builds only focus roots + neighbors + expansions (see utils/browse-visibility.ts and the focus selector in the toolbar).

## Integration Explorer

Full-screen mode (Cmd+E), a search-first single screen (conFind-style) for searching folder sources and validating XML, in `src/features/explorer/`:

- **Shell**: `explorer-shell.tsx` hosts the nav bar (`explorer-nav-bar.tsx`: Settings, Leave), the `search-panel.tsx` on top, then the drag-resizable `results-panel.tsx` on the left beside the content panel with `file-tab-bar.tsx` (dnd-kit reorder, wheel scroll, all-tabs menu), `breadcrumb-bar.tsx` (sibling-jump popovers), and `quick-open.tsx` (Cmd+P over tabs, recents, favorites, loaded files). Streamed events subscribe once at the shell (`use-explorer-events.ts`).
- **Search panel**: one location source at a time plus two always-visible query lines. Filename search is live (250ms debounce, Cmd+F focuses it) and merges instant matches from `loadedFileIndex` with streamed on-disk results from `filename_search_cmd` (500-result cap); content search runs on Enter (Cmd+Shift+F focuses it) and shows highlighted snippets (backend sends 5/file, 200 chars each) that jump to the line in Monaco. Both share the scope chips + "Choose folders" popover (`scope-tree.tsx`, a lazy checkbox folder tree: checking a parent covers its subtree; empty scope = whole location), the file-type picker (`file-type-picker.tsx`, checkbox dropdown composing a comma-separated glob like `*.xml,*.json`; `utils/file-types.ts` maps patterns to types and Rust `FilePatterns` matches any of them), the date range, and the `.*` regex / `Aa` case toggles. Saved searches (star) and history (clock, cap 20) persist via `explorerSavedSearches` / `explorerSearchHistory` in settings.
- **Results panel**: Results | Browse mini-tabs. Results shows whichever search ran last (`lastRun: "filename" | "content"`): grouped content snippets in `search-results.tsx` or the flat virtualized `filename-results.tsx`. The panel flips to Results only on explicit search intent (typing, Enter, saved/history apply) — never on scope changes, so scoping from the Browse tree stays put.
- **Browse indicators**: `folder-tree.tsx` renders connected blue tint runs over in-scope rows (`tintRunFlags` computed in JS, virtualization-safe), dims out-of-scope rows, shows a green tint plus plain "N matches" text on files in the active results (`resultsMatchIndex`), and grey selection always wins. Folder rows get hover `+ scope` / `scope ×` badges (calling `toggleScopePath`), validation error/warning dots stay independent, and a legend strip explains active indicators. Date-named folders show their formatted date as a hover tooltip, never inline.
- **Scope model**: `scopePaths: Set<string>` in the search slice; a parent path covers its subtree (`togglePathInScope` drops redundant descendants). Chips, the popover tree, and the Browse badges all stay in sync from this one set.
- **Store**: Zustand slices in `src/features/explorer/store/` (tree, ui, tabs, scan, search) composed into one `useExplorerStore`; `store/selectors.ts` holds the pure, tested helpers (`flattenTree`, `togglePathInScope`, `isPathInScope`, `tintRunFlags`, `matchesName`, `loadedFilenameMatches`, `resultsMatchIndex`). `loadSources` reconciles instead of resetting, so explorer state survives mode switches within a session.
- **Selection model**: one `selectedPath` drives the tree highlight, breadcrumbs, and the scan target. The tree is a single tab stop (`role=tree`, `aria-activedescendant`, arrow keys, type-ahead); `folder-tree-node.tsx` rows are memoized and subscription-free; one shared context menu resolves rows via `data-row-key` ("Search in This Folder" sets the scope to that folder and focuses the content input).
- **Backend search options**: `content_search_cmd` and `filename_search_cmd` take `regex`, `case_sensitive`, and `date_from`/`date_to` (ISO); `bulk_scan_cmd` takes the date range too. Walks prune `YYYYMMDD` path segments outside the range. Regex uses the `regex` crate (case-insensitive unless flagged); non-regex keeps AhoCorasick.
- **Scan**: right-click a folder for "Scan for Issues"; `bulk_scan_cmd` streams `scan-results-batch` events into `scan-results-tab.tsx` live and returns a slim summary (no `files` vector). Cancel keeps partial results.
- **File opens** are size-gated via `file_stat_cmd`: over 5 MB opens source-only (XML tree and formatting disabled) after a native confirm; over 50 MB is refused.
- `validationCache` is bounded (`store/bounded-cache.ts`, 2000 entries) and updates live from scan batches, so tree and tab badges appear as a scan runs.

## Performance Patterns

### Batched Tauri Events

Search and scan commands emit results in batches, not per-file:

- **Search results**: `search-results-batch` via `searchResultsBatchHub` in `src/services/events.ts`; Rust flushes when 50 results are pending or 150ms elapsed. Same batching for `scan-results-batch` and `filename-results-batch`.
- **Progress events**: throttled to every 200 files or 150ms minimum. `totalFiles` may be `null` in streaming mode (unknown count).
- Never emit one event per file — it saturates the IPC bridge over VPN.

### Streaming Search (Rust)

`content_search_cmd` in `src-tauri/src/commands/explorer.rs` walks and searches incrementally:

- No pre-count phase — `totalFiles` is `null`, progress shows files scanned so far.
- `search_file_content()` uses `BufReader` for line-by-line streaming instead of loading full file content into memory, and captures up to 5 matching lines per file as previews.
- AND-logic: all search terms must appear in a file to match.

### Virtual Scrolling

`folder-tree.tsx`, `search-results.tsx`, and `scan-results-tab.tsx` use `@tanstack/react-virtual`:

- Flatten grouped/hierarchical data into a typed row array, then virtualize it.
- Never render all rows at once — only visible rows are in the DOM.

## Release Workflow

### Creating a Release

1. Update the version in config files (if not already at desired version):
   - `package.json`
   - `src-tauri/Cargo.toml`
   - `src-tauri/tauri.conf.json`

2. Go to **Actions > Release > Run workflow** and click "Run workflow"

3. The workflow automatically:
   - Reads version from `tauri.conf.json` (source of truth)
   - Builds for macOS (ARM64 + x64) and Windows in parallel
   - Generates `latest.json` for the auto-updater
   - Creates a GitHub release with tag `v{version}` and all artifacts
   - Creates a PR to bump version to next patch

### Release Notes Format

GitHub release descriptions should include structured sections instead of generic text. Use this format:

```
## New Features
- Feature description 1
- Feature description 2

## Fixes
- Fix description 1
- Fix description 2
```

Do not use generic text like "See the assets to download this version and install."

### Version Source of Truth

The version in `tauri.conf.json` determines the release version. To release:

- **Patch release** (e.g., 0.2.4): Just run the workflow (version was auto-bumped after last release)
- **Minor/major release** (e.g., 0.3.0 or 1.0.0): Update config files first, then run workflow

### Auto-Updater

The app checks for updates via Tauri's updater plugin:

- Endpoint: `https://github.com/elliotlayen/Monocle/releases/latest/download/latest.json`
- The `latest.json` file contains the version, download URLs, and signatures
- Users are prompted to update when a newer version is available

### Version Bump PR

After a successful release, the workflow automatically creates a PR to bump the version to the next patch (e.g., `0.2.4` -> `0.2.5`). This ensures:

- Config files are ready for the next patch release
- No manual version updates needed for patch releases

### Version Files

These files must stay in sync:

- `package.json` - npm version
- `src-tauri/Cargo.toml` - Rust crate version
- `src-tauri/tauri.conf.json` - Tauri app version (source of truth for releases)
