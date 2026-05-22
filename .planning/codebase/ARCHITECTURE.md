<!-- refreshed: 2026-05-22 -->
# Architecture

**Analysis Date:** 2026-05-22

## System Overview

```text
┌──────────────────────────────────────────────────────────────────────┐
│                      React Frontend (Vite + TS)                       │
│                         src/App.tsx                                   │
├────────────────┬──────────────────┬────────────────┬─────────────────┤
│   connection/  │  schema-graph/   │    canvas/     │    toolbar/     │
│  home-screen   │  schema-graph    │  create-*      │  search-bar     │
│  connection-   │  table-node      │  import-from-  │  database-      │
│  modal         │  view-node       │  database      │  selector       │
└───────┬────────┴────────┬─────────┴───────┬────────┴────────┬────────┘
        │                 │                 │                 │
        ▼                 ▼                 ▼                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     Services + State Layer                            │
│  src/services/tauri.ts  (IPC gateway)                                 │
│  src/features/schema-graph/store.ts  (Zustand global store)           │
│  src/services/events.ts  (Tauri event hub)                            │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │  Tauri IPC (invoke)
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     Rust Backend (Tauri)                              │
│  src-tauri/src/lib.rs  (app bootstrap + command registration)         │
│  src-tauri/src/commands/*.rs  (thin command handlers)                 │
│  src-tauri/src/db/  (connection + queries + schema_loader)            │
│  src-tauri/src/state.rs  (AppState with Mutex<AppSettings>)           │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │  TDS (tiberius)
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  SQL Server (remote database)                         │
│  sys.tables, sys.foreign_keys, sys.views, sys.procedures, etc.        │
└──────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| App | Root orchestrator; owns global UI state (modals, canvas dirty); wires menu events | `src/App.tsx` |
| ThemeProvider | Provides light/dark/system theme context | `src/providers/theme-provider.tsx` |
| HomeScreen | Landing page; shows recent connections | `src/features/connection/components/home-screen.tsx` |
| ConnectionModal | Two-step connect dialog (server then database picker) | `src/features/connection/components/connection-modal.tsx` |
| SchemaGraphView | React Flow canvas; builds nodes/edges from store; handles filtering | `src/features/schema-graph/components/schema-graph.tsx` |
| TableNode / ViewNode / TriggerNode etc. | Custom React Flow node renderers | `src/features/schema-graph/components/*-node.tsx` |
| SchemaBrowserSidebar | Sidebar for browsing all schema objects by type | `src/features/schema-graph/components/schema-browser-sidebar.tsx` |
| Toolbar | Top bar with search, schema picker, database selector, export | `src/features/toolbar/components/toolbar.tsx` |
| useSchemaStore | Zustand store; owns all schema, filter, connection, and canvas state | `src/features/schema-graph/store.ts` |
| tauri (object) | Centralized Tauri IPC wrapper; single `invoke` call site | `src/services/tauri.ts` |
| events.ts | One-listener-many-subscriber event hubs for menu events | `src/services/events.ts` |
| AppState | Rust struct wrapping `Mutex<AppSettings>`; persists to `settings.json` | `src-tauri/src/state.rs` |
| load_schema_cmd | Thin Tauri command — delegates to `db::load_schema` | `src-tauri/src/commands/schema.rs` |
| schema_loader | Executes all SQL metadata queries, builds `SchemaGraph` struct | `src-tauri/src/db/schema_loader.rs` |
| connection.rs | Creates authenticated `tiberius::Client` from `ConnectionParams` | `src-tauri/src/db/connection.rs` |
| queries.rs | Named SQL query constants (no logic, just strings) | `src-tauri/src/db/queries.rs` |
| menu.rs | Builds native macOS/Windows menu bar; emits `menu:*` Tauri events | `src-tauri/src/menu.rs` |

## Pattern Overview

**Overall:** Feature-based frontend with a unidirectional IPC bridge to a thin Rust command layer backed by a SQL query engine.

**Key Characteristics:**
- All Tauri IPC is funneled through a single gateway object (`tauri` in `src/services/tauri.ts`); no direct `invoke` calls in feature code
- All schema and UI state lives in a single Zustand store (`useSchemaStore`); components read via `useShallow` selectors
- Components are purely presentational; they receive props and call store actions — they do not call services directly
- The Rust backend is stateless per-request for schema loading; only `AppSettings` is held in `AppState` across requests
- Two operational modes: `connected` (live SQL Server data) and `canvas` (offline editable schema stored in `.monocle.json`)
- Native menu actions reach React via Tauri event emission → `menu:*` string events → `useMenuEvents` hook in `App.tsx`

## Layers

**Presentation Layer:**
- Purpose: Render UI; handle user input; delegate to store actions
- Location: `src/features/*/components/`, `src/components/`
- Contains: `.tsx` React components, shadcn/ui wrappers
- Depends on: Store, hooks, `src/components/ui/`
- Used by: Nothing — top of the tree

**Hooks Layer:**
- Purpose: Own side effects, event subscriptions, derived reactive state
- Location: `src/features/*/hooks/`, `src/hooks/`
- Contains: Custom React hooks (prefixed `use`)
- Depends on: Store, services, `src/services/events.ts`
- Used by: Components

**Store Layer:**
- Purpose: Single source of truth for all application state; exposes actions
- Location: `src/features/schema-graph/store.ts`, `src/features/notifications/store.ts`
- Contains: Zustand stores with state + action definitions
- Depends on: Services, `src/features/*/services/`
- Used by: Components, hooks

**Services Layer:**
- Purpose: Wrap all Tauri IPC calls; no business logic
- Location: `src/features/*/services/`, `src/services/tauri.ts`
- Contains: Thin wrappers calling `tauri.*` methods
- Depends on: `src/services/tauri.ts`
- Used by: Store, occasionally hooks

**IPC Gateway:**
- Purpose: Single point of entry for all `invoke` calls; provides type-safe command registry
- Location: `src/services/tauri.ts`
- Contains: `invokeCommand` wrapper + `tauri` export object
- Depends on: `@tauri-apps/api/core`
- Used by: All feature services

**Rust Commands Layer:**
- Purpose: Thin `#[tauri::command]` handlers — validate input, delegate to `db/`
- Location: `src-tauri/src/commands/`
- Contains: One function per file matching the command name
- Depends on: `src-tauri/src/db/`, `src-tauri/src/state.rs`
- Used by: Tauri runtime (registered in `lib.rs`)

**Database Layer:**
- Purpose: All SQL Server connectivity and data loading
- Location: `src-tauri/src/db/`
- Contains: `connection.rs` (tiberius client factory), `queries.rs` (SQL constants), `schema_loader.rs` (result parsing)
- Depends on: `tiberius`, `tokio`
- Used by: Rust commands

## Data Flow

### Primary Request Path — Schema Load

1. User selects a database in `DatabaseSelector` → calls `store.selectDatabase(db)` (`src/features/schema-graph/store.ts:772`)
2. Store calls `schemaService.loadSchema(params)` (`src/features/schema-graph/services/schema-service.ts:5`)
3. `schemaService` calls `tauri.loadSchema(params)` (`src/services/tauri.ts:29`)
4. Tauri `invoke("load_schema_cmd", { params })` crosses IPC boundary
5. `load_schema_cmd` delegates to `db::load_schema(&params)` (`src-tauri/src/commands/schema.rs:5`)
6. `schema_loader::load_schema` creates a `tiberius::Client`, runs 7 SQL queries (`src-tauri/src/db/schema_loader.rs:37-71`)
7. Results parsed into `SchemaGraph` struct, serialized to JSON via `#[serde(rename_all = "camelCase")]`
8. Store receives `SchemaGraph`, calls `enrichLoadedSchemaViewDependencies` to resolve view column lineage
9. Store sets `schema`, `availableSchemas`, filter state
10. `SchemaGraphView` re-renders with new schema data → builds React Flow nodes/edges

### Menu Event Path

1. User clicks native menu item → `menu.rs` emits `app_handle.emit("menu:*", ())` (`src-tauri/src/menu.rs`)
2. `useMenuEvents` hook in `App.tsx` listens via `@tauri-apps/api/event` `listen()`
3. Handler function in `App.tsx` called → state update or modal toggle
4. For graph-level menu events (zoom, fit, export), `src/services/events.ts` hubs route to `schema-graph.tsx`

### Canvas Mode Save Path

1. User triggers Cmd+S or menu save
2. `App.tsx::handleCanvasSave` assembles `CanvasFile` from store state (`src/App.tsx:172`)
3. `canvasFileService.saveFile(data, path)` writes via `@tauri-apps/plugin-fs` (`src/features/canvas/services/canvas-file-service.ts:11`)
4. Store updates `canvasFilePath` and `canvasIsDirty: false`

**State Management:**
- Schema, filters, connection, canvas mode: Zustand `useSchemaStore` (`src/features/schema-graph/store.ts`)
- Notifications/toasts: Zustand `useToastStore` (`src/features/notifications/store.ts`)
- App settings: persisted via Rust `AppState` → `{app_data_dir}/settings.json`
- Connection form fields (server, auth type, username): `localStorage` via `src/features/connection/services/connection-settings.ts`

## Key Abstractions

**SchemaGraph:**
- Purpose: The universal data model shared by both frontend and backend
- Examples: `src/features/schema-graph/types.ts`, `src-tauri/src/types/schema.rs`
- Pattern: Identical shape in TypeScript and Rust; Rust uses `#[serde(rename_all = "camelCase")]` to match TS field names. Node IDs use `schema.name` format (e.g., `dbo.Users`). Trigger IDs use `schema.tableId.triggerName`.

**tauri (IPC gateway object):**
- Purpose: Every Tauri command is represented as a typed method; no raw `invoke` calls anywhere else
- Examples: `src/services/tauri.ts`
- Pattern: `tauri.loadSchema(params)` → `invokeCommand<SchemaGraph>("load_schema_cmd", { params })`

**Event Hubs:**
- Purpose: Decouple menu actions from deep component trees without prop drilling
- Examples: `src/services/events.ts`
- Pattern: `createEventHub<T>(eventName)` returns `{ subscribe }`. Components call `useTauriEvent(hub.subscribe, callback)`.

**Feature Services:**
- Purpose: Thin wrappers isolating Tauri IPC from store/components
- Examples: `src/features/schema-graph/services/schema-service.ts`, `src/features/settings/services/settings-service.ts`
- Pattern: Each file exports a plain object with async methods that call `tauri.*`

**SchemaIndex:**
- Purpose: Pre-computed lookup maps built from `SchemaGraph` for fast search and relationship traversal
- Examples: `src/lib/schema-index.ts`
- Pattern: Cached via `WeakMap<SchemaGraph, SchemaIndex>`; rebuilt only when schema reference changes

## Entry Points

**Frontend:**
- Location: `src/main.tsx`
- Triggers: Tauri WebView loads `index.html`, Vite serves JS bundle
- Responsibilities: Mounts `<ThemeProvider><App /></ThemeProvider>` into `#root`

**Rust:**
- Location: `src-tauri/src/main.rs` → `src-tauri/src/lib.rs::run()`
- Triggers: OS launches the Tauri binary
- Responsibilities: Registers Tauri plugins, creates `AppState`, sets up native menu, registers all IPC command handlers

## Architectural Constraints

- **Threading:** Rust commands use `async` via Tokio; the single `AppState` uses `Mutex<AppSettings>` for thread-safe access. The `tiberius` client is not `Send`-safe across `.await` points in older patterns — each request creates a new client.
- **Global state:** `useSchemaStore` is a module-level Zustand singleton. `useToastStore` is a second singleton. Both are in `src/features/*/store.ts`. The `schemaIndexCache` WeakMap in `src/lib/schema-index.ts` is also module-level.
- **Circular imports:** `store.ts` imports from `canvas/utils/sql-definition` and `canvas/types`; `canvas` feature imports from `schema-graph/types`. This one-way dependency (canvas → schema-graph types) is intentional.
- **Node IDs:** React Flow node IDs must exactly match `SchemaGraph` object IDs (`schema.name`). Breaking this causes mismatches between store state and React Flow internal state.
- **Type sync:** TypeScript types in `src/features/schema-graph/types.ts` and Rust types in `src-tauri/src/types/schema.rs` must stay in sync. The bridge is `#[serde(rename_all = "camelCase")]`.

## Anti-Patterns

### Direct invoke() calls in feature code

**What happens:** Calling `invoke()` from `@tauri-apps/api/core` directly inside a component or feature service instead of going through `src/services/tauri.ts`
**Why it's wrong:** Bypasses the centralized error handler and type registry; makes commands harder to audit and mock
**Do this instead:** Add the command to `src/services/tauri.ts`, then call it via `tauri.yourCommand()` in the feature service

### Direct Tauri IPC from components

**What happens:** A component calls `schemaService.loadSchema()` or `tauri.*` directly without going through the store
**Why it's wrong:** Components should be presentational; state changes must go through the store so dependent selectors re-render correctly
**Do this instead:** Call the corresponding store action (e.g., `store.loadSchema(params)` or `store.selectDatabase(db)`) from the component

### Mutating SchemaGraph in place

**What happens:** Directly mutating `state.schema.tables.push(...)` inside a store action
**Why it's wrong:** Zustand requires new object references to trigger subscriptions; also breaks WeakMap caching in `schema-index.ts`
**Do this instead:** Use `cloneSchema(state.schema)` then modify the clone, as all canvas CRUD actions do in `store.ts`

## Error Handling

**Strategy:** Errors propagate as thrown exceptions from Rust commands (serialized as strings via `serde::Serialize` on error enums) → `invokeCommand` catches and re-throws → store action catches and calls `set({ error: String(err) })`.

**Patterns:**
- Rust: `SchemaError` and `ConnectionError` enums with `thiserror` implement `Serialize` to plain strings
- Frontend: `invokeCommand` in `src/services/tauri.ts` has a `try/catch` that logs and re-throws
- Store: All async actions (`loadSchema`, `connectToServer`, etc.) have `try/catch` that set `{ error, isLoading: false }`
- UI: Error state from store shown in connection modal or toolbar; toast notifications via `useToastStore`

## Cross-Cutting Concerns

**Logging:** `console.error` in `tauri.ts` `invokeCommand` catch block; Rust errors become strings
**Validation:** No dedicated validation layer; input constraints enforced via TypeScript types and Rust `#[serde]` deserialization
**Authentication:** SQL Server auth handled entirely in `src-tauri/src/db/connection.rs`; passwords never leave Rust and are not stored

---

*Architecture analysis: 2026-05-22*
