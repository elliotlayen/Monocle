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
```

Note: Always lint, test, and typecheck updated files. Use project-wide build sparingly.

## Architecture

### Frontend (React + TypeScript)

The frontend uses a feature-based architecture with a services layer for Tauri IPC.

```
src/
  features/
    connection/
      components/connection-form.tsx  - Database connection UI with recent connections
      services/connection-service.ts  - Tauri IPC for connection history
    schema-graph/
      components/                     - React Flow visualization components
        schema-graph.tsx              - Main graph view with filtering/focus
        table-node.tsx                - Custom node for tables
        view-node.tsx                 - Custom node for views
        trigger-node.tsx              - Custom node for triggers
        stored-procedure-node.tsx     - Custom node for procedures
        scalar-function-node.tsx      - Custom node for functions
        detail-modal.tsx              - SQL definition modal
      hooks/useFilteredCounts.ts      - Filter statistics hook
      services/schema-service.ts      - Tauri IPC for schema loading
      store.ts                        - Zustand store for schema state
      types.ts                        - TypeScript types (SchemaGraph, TableNode, etc.)
    settings/
      components/settings-sheet.tsx   - Settings panel
      services/settings-service.ts    - Tauri IPC for settings persistence
    toolbar/
      components/toolbar.tsx          - Search, schema filter, focus controls
      components/search-bar.tsx       - Fuzzy search component
      types.ts                        - Search result types
  components/
    ui/                               - shadcn/ui components
    status-bar.tsx                    - Bottom status bar
    update-checker.tsx                - Auto-update notification
  App.tsx                             - Root component
```

### Backend (Rust + Tauri)

```
src-tauri/src/
  lib.rs              - Tauri app setup, registers commands and state
  state.rs            - AppState with Mutex<AppSettings> for thread-safe persistence
  commands/
    schema.rs         - load_schema_cmd (real database)
    mock.rs           - load_schema_mock (test data)
    connections.rs    - Connection history CRUD commands
    settings.rs       - Settings persistence commands
  db/
    connection.rs     - Tiberius connection management
    queries.rs        - SQL queries for metadata
    schema_loader.rs  - Parses results into SchemaGraph
  types/              - Rust type definitions mirroring frontend types
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
- Schema filter preference restored on app launch

## Type Consistency

TypeScript types in `src/features/schema-graph/types.ts` must stay in sync with Rust types in `src-tauri/src/types/schema.rs`. Both use camelCase field names (Rust uses `#[serde(rename_all = "camelCase")]`).

## Prerequisites

- Rust toolchain for Tauri backend
- Node.js for frontend

No external database drivers needed - tiberius connects to SQL Server directly via TDS protocol.

## Code Style

- **No emojis**: Do not use emojis anywhere in code, comments, commits, or documentation
- **Commit messages**: Do not include "Generated with Claude Code" or "Co-Authored-By" lines
- **Components**: Use shadcn/ui for UI components

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
