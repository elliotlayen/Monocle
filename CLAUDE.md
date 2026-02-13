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
        schema-browser-sidebar.tsx  - Sidebar for browsing schema objects
        sidebar-toggle.tsx          - Toggle button for sidebar
        table-node.tsx              - Custom node for tables
        view-node.tsx               - Custom node for views
        trigger-node.tsx            - Custom node for triggers
        stored-procedure-node.tsx   - Custom node for procedures
        scalar-function-node.tsx    - Custom node for functions
        node-render-update.ts       - Efficient node render diffing
        zoom-band.ts                - Discrete zoom band thresholds
        detail-popover.tsx          - Popover for object details
        detail-content.tsx          - Content for detail popover
        sql-code-block.tsx          - Monaco SQL syntax highlighting (readonly)
      hooks/
        useFilteredCounts.ts        - Filter statistics hook
        use-detail-popover.ts       - Detail popover state hook
      services/
        schema-service.ts           - Tauri IPC for schema loading
      utils/
        object-filtering.ts         - Shared object filtering logic
      store.ts                      - Zustand store for schema state
      types.ts                      - TypeScript types (SchemaGraph, TableNode, etc.)
    settings/
      components/
        settings-sheet.tsx          - Settings panel
      services/
        settings-service.ts         - Tauri IPC for settings persistence
    toolbar/
      components/
        toolbar.tsx                 - Main toolbar with controls
        search-bar.tsx              - Fuzzy search component
        filter-info-bar.tsx         - Active filter display
        database-selector.tsx       - Database dropdown
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
    sql-intellisense.ts             - SQL autocomplete provider for schema objects
  utils/
    index.ts                        - Utility exports
    formatting.ts                   - String/number formatting helpers
  hooks/
    use-resolved-theme.ts           - Theme resolution hook (system/dark/light)
  types/                            - TypeScript type declarations
  components/
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
  db/
    connection.rs     - Tiberius connection management
    queries.rs        - SQL queries for metadata
    schema_loader.rs  - Parses results into SchemaGraph
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

## Notes

- React Flow nodes require unique IDs matching the data model
- Schema filter state persists across sessions via settings
- Connection passwords are not stored - only connection metadata
- The app uses React Flow's dagre layout for automatic positioning
- Monaco Editor provides SQL syntax highlighting and intellisense (replaces prism-react-renderer)

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
