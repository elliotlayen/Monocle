# Structure

> Last mapped: 2026-05-22

## Top-Level Layout

```
Monocle/
  src/                    # React + TypeScript frontend
  src-tauri/              # Rust + Tauri backend
  public/                 # Static assets
  .github/                # CI/CD workflows
  package.json            # Node dependencies + scripts
  vite.config.ts          # Vite bundler config
  vitest.config.ts        # Test runner config
  tailwind.config.js      # Tailwind CSS config
  tsconfig.json           # TypeScript config
  components.json         # shadcn/ui config
  CLAUDE.md               # Claude Code instructions
```

## Frontend (`src/`)

```
src/
  main.tsx                          # Entry point
  App.tsx                           # Root component (434 lines)
  index.css                         # Global styles

  features/                         # Feature-based modules
    connection/
      components/
        home-screen.tsx             # Landing page
        connection-modal.tsx        # Connection dialog
        server-connection-form.tsx  # Shared server form
        monocle-logo.tsx            # Logo
      services/
        connection-service.ts       # IPC: connection history
        connection-settings.ts      # localStorage persistence
        database-service.ts         # IPC: database operations

    schema-graph/
      components/
        schema-graph.tsx            # Main graph view (2418 lines)
        schema-browser-sidebar.tsx  # Schema browser sidebar
        table-node.tsx              # Table node renderer
        view-node.tsx               # View node renderer
        trigger-node.tsx            # Trigger node renderer
        stored-procedure-node.tsx   # Procedure node renderer
        scalar-function-node.tsx    # Function node renderer
        detail-popover.tsx          # Object detail popover
        sql-code-block.tsx          # Monaco SQL viewer
        zoom-band.ts                # Zoom level thresholds
        node-render-update.ts       # Render diff optimization
      hooks/
        useFilteredCounts.ts        # Filter statistics
        use-detail-popover.ts       # Popover state
      services/
        schema-service.ts           # IPC: schema loading
      utils/
        object-filtering.ts         # Filter logic
      store.ts                      # Zustand state (2181 lines)
      types.ts                      # Schema type definitions

    canvas/
      components/
        sql-editor.tsx              # Monaco SQL editor (editable)
        create-table-dialog.tsx     # Create table dialog
        create-view-dialog.tsx      # Create view dialog
        create-function-dialog.tsx  # Create function dialog
        create-procedure-dialog.tsx # Create procedure dialog
        create-trigger-dialog.tsx   # Create trigger dialog
        import-from-database-dialog.tsx  # Import dialog
        column-editor.tsx           # Column editor
        parameter-editor.tsx        # Parameter editor
      utils/
        sql-definition.ts           # SQL DDL generation

    toolbar/
      components/
        toolbar.tsx                 # Main toolbar
        search-bar.tsx              # Fuzzy search
        filter-info-bar.tsx         # Active filters display
        database-selector.tsx       # Database dropdown

    export/
      components/
        export-button.tsx           # Export dropdown
      hooks/
        useExport.ts                # Export logic
      utils/
        png-export.ts               # PNG export
        pdf-export.ts               # PDF export
        json-export.ts              # JSON export

    settings/
      components/
        settings-sheet.tsx          # Settings panel
      services/
        settings-service.ts         # IPC: settings persistence

    notifications/
      store.ts                      # Toast notification state

  services/
    tauri.ts                        # Centralized IPC wrapper
    events.ts                       # Event hub for Tauri events

  lib/
    schema-index.ts                 # Search index + relationship lookups
    monaco-sql-loader.ts            # Lazy Monaco loader
    sql-intellisense.ts             # SQL autocomplete provider

  components/
    ui/                             # shadcn/ui components

  constants/
    edge-colors.ts                  # Edge color palette

  providers/
    theme-provider.tsx              # Theme context

  hooks/
    use-resolved-theme.ts           # Theme resolution

  utils/
    index.ts                        # Utility exports
    formatting.ts                   # String/number formatting
```

## Backend (`src-tauri/src/`)

```
src-tauri/src/
  main.rs                # Entry point
  lib.rs                 # Tauri setup, command registration, state init
  state.rs               # AppState with Mutex<AppSettings>

  commands/
    schema.rs            # load_schema_cmd (real database)
    mock.rs              # load_schema_mock (test data)
    connections.rs       # Connection history CRUD
    databases.rs         # Database listing
    settings.rs          # Settings persistence

  db/
    connection.rs        # Tiberius connection management
    queries.rs           # SQL metadata queries
    schema_loader.rs     # Parse results into SchemaGraph

  types/
    schema.rs            # Rust types (mirrors frontend types)
```

## Key Locations

| Need to... | Look at |
|------------|---------|
| Add a Tauri command | `src-tauri/src/commands/` + register in `lib.rs` |
| Add IPC binding | `src/services/tauri.ts` + feature service |
| Add a node type | `src/features/schema-graph/components/` + `types.ts` |
| Add a SQL query | `src-tauri/src/db/queries.rs` |
| Add a UI component | `src/components/ui/` (shadcn) |
| Change graph layout | `src/features/schema-graph/components/schema-graph.tsx` |
| Change state shape | `src/features/schema-graph/store.ts` + `types.ts` |
| Change canvas dialogs | `src/features/canvas/components/` |
| Change toolbar | `src/features/toolbar/components/` |
| Change settings | `src/features/settings/` + `src-tauri/src/commands/settings.rs` |
| Add export format | `src/features/export/utils/` |

## Naming Conventions

### TypeScript
- **Files:** kebab-case (`schema-graph.tsx`, `connection-service.ts`)
- **Components:** PascalCase (`TableNode`, `SchemaGraph`)
- **Hooks:** camelCase with `use` prefix (`useFilteredCounts`)
- **Services:** camelCase objects (`schemaService.loadSchema()`)
- **Types:** PascalCase (`SchemaGraph`, `TableNode`)
- **Constants:** camelCase or UPPER_SNAKE for true constants

### Rust
- **Files:** snake_case (`schema_loader.rs`)
- **Functions:** snake_case (`load_schema_cmd`)
- **Types:** PascalCase (`SchemaGraph`, `AppState`)
- **Serde:** `#[serde(rename_all = "camelCase")]` for frontend compatibility

## Feature Module Pattern

Each feature follows a consistent structure:

```
features/{name}/
  components/     # UI components (presentational)
  services/       # Tauri IPC wrappers
  hooks/          # React hooks (optional)
  utils/          # Pure utility functions (optional)
  store.ts        # Zustand state (if needed)
  types.ts        # Feature-specific types (if needed)
```
