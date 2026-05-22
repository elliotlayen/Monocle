# Architecture Patterns

**Domain:** XML file explorer within an existing Tauri 2 + React + Rust desktop app
**Researched:** 2026-05-22

## Recommended Architecture

### System Diagram

```text
                          ┌──────────────────────────────────────────────┐
                          │             React Frontend                   │
                          │                                              │
                          │  ┌────────────────────────────────────────┐  │
                          │  │  App.tsx (mode router)                 │  │
                          │  │    mode === "home"    -> HomeScreen    │  │
                          │  │    mode === "schema"  -> SchemaGraph   │  │
                          │  │    mode === "canvas"  -> SchemaGraph   │  │
                          │  │    mode === "explorer"-> ExplorerView  │  │
                          │  └────────────────────────────────────────┘  │
                          │                                              │
                          │  ┌── features/integration-explorer/ ──────┐  │
                          │  │                                        │  │
                          │  │  components/                           │  │
                          │  │    explorer-view.tsx      (shell)      │  │
                          │  │    folder-tree.tsx         (sidebar)   │  │
                          │  │    file-tabs.tsx           (tab bar)   │  │
                          │  │    xml-viewer.tsx          (tree+raw)  │  │
                          │  │    xml-tree-view.tsx       (tree mode) │  │
                          │  │    xml-source-view.tsx     (raw mode)  │  │
                          │  │    problems-panel.tsx      (issues)    │  │
                          │  │    diff-viewer.tsx         (compare)   │  │
                          │  │    search-panel.tsx        (search UI) │  │
                          │  │    scan-report.tsx         (bulk scan) │  │
                          │  │    client-dashboard.tsx    (analytics) │  │
                          │  │    explorer-toolbar.tsx    (controls)  │  │
                          │  │    source-manager.tsx      (config)    │  │
                          │  │                                        │  │
                          │  │  services/                             │  │
                          │  │    explorer-service.ts     (IPC wrap)  │  │
                          │  │    source-service.ts       (config)    │  │
                          │  │                                        │  │
                          │  │  hooks/                                │  │
                          │  │    use-folder-tree.ts      (tree nav)  │  │
                          │  │    use-file-tabs.ts        (tab mgmt)  │  │
                          │  │    use-search.ts           (search)    │  │
                          │  │    use-watcher.ts          (fs watch)  │  │
                          │  │                                        │  │
                          │  │  store.ts                 (Zustand)    │  │
                          │  │  types.ts                 (TS types)   │  │
                          │  └────────────────────────────────────────┘  │
                          │                                              │
                          │  ┌── services/ ──────────────────────────┐  │
                          │  │  tauri.ts  (extended with explorer     │  │
                          │  │            commands)                   │  │
                          │  │  events.ts (new explorer event hubs)  │  │
                          │  └───────────────────────────────────────┘  │
                          └─────────────────────┬────────────────────────┘
                                                │ Tauri IPC (invoke + channels)
                                                ▼
                          ┌──────────────────────────────────────────────┐
                          │              Rust Backend                     │
                          │                                              │
                          │  commands/                                   │
                          │    explorer.rs        (thin command layer)   │
                          │                                              │
                          │  explorer/            (new module)           │
                          │    mod.rs             (public API)           │
                          │    folder_reader.rs   (lazy dir listing)     │
                          │    xml_parser.rs      (parse + validate)     │
                          │    xml_search.rs      (content search)       │
                          │    file_watcher.rs    (notify integration)   │
                          │    types.rs           (Rust types)           │
                          │                                              │
                          │  state.rs             (extended with         │
                          │                        ExplorerSettings)     │
                          │                                              │
                          │  types/                                      │
                          │    explorer.rs        (shared IPC types)     │
                          └─────────────────────┬────────────────────────┘
                                                │ std::fs / tokio::fs
                                                ▼
                          ┌──────────────────────────────────────────────┐
                          │         Network Share (SMB/CIFS)              │
                          │  Root/                                       │
                          │    ABC/20251223/file1.xml                    │
                          │    DEF/20251224/file2.xml                    │
                          └──────────────────────────────────────────────┘
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `App.tsx` (modified) | Routes to ExplorerView when `mode === "explorer"` | ExplorerView, HomeScreen, SchemaGraphView |
| `HomeScreen` (modified) | Adds "Integration Explorer" button | App.tsx via callback |
| `ExplorerView` | Shell layout: sidebar + tabs + content + panels | FolderTree, FileTabs, XmlViewer, ProblemsPanel, SearchPanel |
| `FolderTree` | Sidebar tree: sources > clients > dates > files. Lazy-loaded. | ExplorerStore (reads tree state, calls expand/collapse actions) |
| `FileTabs` | Tab bar for open files. Close, reorder, active tab. | ExplorerStore (reads openTabs, calls setActiveTab/closeTab) |
| `XmlViewer` | Toggle between tree view and source view for active file | XmlTreeView, XmlSourceView, ProblemsPanel |
| `XmlTreeView` | Collapsible XML element tree with namespaces, attributes, comments | ExplorerStore (reads parsed XML data for active tab) |
| `XmlSourceView` | Monaco editor (readonly) with XML syntax + inline problem markers | Monaco Editor, ExplorerStore (reads raw content + validation issues) |
| `ProblemsPanel` | List of validation issues with line numbers (like VS Code) | ExplorerStore (reads validationResults for active tab) |
| `DiffViewer` | Monaco DiffEditor for file comparison | ExplorerStore (reads two files selected for comparison) |
| `SearchPanel` | Search UI with scope selector and results list | ExplorerStore (reads searchResults, calls search actions) |
| `ScanReport` | Bulk validation summary with export | ExplorerStore (reads scanResults) |
| `ClientDashboard` | Per-client analytics: file counts, error rates, timeline | ExplorerStore (reads analytics data) |
| `ExplorerToolbar` | Mode-specific toolbar: search trigger, view toggles, actions | ExplorerStore + various panels |
| `SourceManager` | Dialog for adding/removing/editing folder source paths | ExplorerStore (reads/writes sources config) |
| `ExplorerStore` | All Integration Explorer state: tree, tabs, files, search, validation | explorer-service.ts |
| `explorer-service.ts` | Wraps all explorer-related Tauri IPC calls | `tauri.ts` (IPC gateway) |
| `source-service.ts` | Wraps source configuration persistence IPC | `tauri.ts` (IPC gateway) |
| `tauri.ts` (extended) | Adds explorer commands to the centralized registry | Tauri runtime |
| `commands/explorer.rs` | Thin Tauri command handlers for all explorer operations | `explorer/` module |
| `explorer/folder_reader.rs` | Reads directory contents lazily via `std::fs`/`tokio::fs` | Network share filesystem |
| `explorer/xml_parser.rs` | Parses XML with `quick-xml`, runs validation checks | Raw file bytes |
| `explorer/xml_search.rs` | Searches XML content for field values, patterns | Parsed XML or raw text |
| `explorer/file_watcher.rs` | Watches directories for changes via `notify` crate | OS filesystem events |
| `explorer/types.rs` | Rust struct definitions shared with frontend via serde | Used by all explorer modules |

### Data Flow

#### Primary Flow: User Navigates Folder Tree

```
1. User clicks expand on client "ABC" in FolderTree
2. FolderTree calls store.expandNode("ABC")
3. Store calls explorerService.listDirectory(sourcePath, "ABC")
4. explorerService calls tauri.listExplorerDirectory({ path })
5. tauri.ts invokes "list_explorer_directory_cmd"
6. Rust: explorer::folder_reader::list_directory(path)
     - Calls tokio::fs::read_dir(path).await
     - Classifies entries: folder vs XML file
     - Returns Vec<DirectoryEntry> with name, type, size, modified
7. Store receives DirectoryEntry[], merges into tree state
8. FolderTree re-renders showing date folders under "ABC"
```

#### File Open Flow

```
1. User clicks "file1.xml" in FolderTree
2. Store calls explorerService.readAndValidateFile(filePath)
3. Rust: reads file bytes, detects encoding, parses XML
     - quick-xml streaming parse for tree structure
     - Validation: illegal chars, encoding issues, well-formedness
     - Returns FileContent { raw, parsedTree, validationIssues }
4. Store adds tab to openTabs, sets as activeTab
5. XmlViewer renders tree view (default) with ProblemsPanel below
```

#### Search Flow (Field-Level Search Across Client)

```
1. User enters search term, selects scope "Current Client"
2. Store calls explorerService.searchContent(query, scope, clientPath)
3. Rust: explorer::xml_search::search_content(query, scope, path)
     - Walks date folders under client path
     - For each XML file: streaming parse with quick-xml
     - Matches field values against query
     - Returns Vec<SearchResult> { filePath, lineNumber, context }
4. Rust streams results via Tauri channel (not single invoke)
     - Allows incremental UI updates as results arrive
5. Store appends results as they stream in
6. SearchPanel renders growing results list
```

#### Bulk Validation Flow

```
1. User triggers "Scan Folder" on a date folder
2. Store calls explorerService.bulkValidate(folderPath)
3. Rust: iterates all XML files in folder
     - For each: parse + validate
     - Emits progress via Tauri channel: { current, total, fileName }
4. Frontend shows progress bar
5. On complete: Store receives ScanReport { files, issues, summary }
6. ScanReport component renders with export options
```

#### File Comparison Flow

```
1. User selects two files for comparison (right-click menu or UI)
2. Store sets comparisonFiles: [fileA, fileB]
3. Both files read if not already in cache
4. DiffViewer renders Monaco DiffEditor with both file contents
5. User toggles side-by-side vs inline via toolbar
```

## Patterns to Follow

### Pattern 1: Dedicated Zustand Store (Separate from SchemaStore)

**What:** The Integration Explorer gets its own Zustand store in `features/integration-explorer/store.ts`, completely independent of `useSchemaStore`.

**Why:** The schema store is already 2,181 lines. The Explorer's state domain (folder trees, open tabs, search results, validation data) has zero overlap with schema state. Zustand officially recommends separate stores for unrelated concerns. This also means the Explorer can be loaded/unloaded without touching schema state.

**Example:**
```typescript
// features/integration-explorer/store.ts
import { create } from "zustand";
import type { ExplorerState, ExplorerActions } from "./types";

export const useExplorerStore = create<ExplorerState & ExplorerActions>(
  (set, get) => ({
    // State
    sources: [],
    treeNodes: {},
    openTabs: [],
    activeTabId: null,
    searchResults: [],
    isSearching: false,
    
    // Actions
    expandNode: async (nodeId) => { /* ... */ },
    openFile: async (filePath) => { /* ... */ },
    closeTab: (tabId) => { /* ... */ },
    search: async (query, scope) => { /* ... */ },
  })
);
```

### Pattern 2: Lazy Directory Loading with Tree State

**What:** The folder tree never loads all data upfront. Each node starts as `{ loaded: false }`. Expanding a node triggers an IPC call that populates children. Already-loaded nodes skip the IPC call.

**Why:** Network shares over VPN make upfront scanning impractical. Hundreds of clients with years of date folders means the total node count is enormous. Loading everything would take minutes and block the VPN connection.

**Example:**
```typescript
// Tree node type
interface TreeNode {
  id: string;           // full path relative to source
  name: string;         // display name
  type: "source" | "client" | "date" | "file";
  loaded: boolean;      // children fetched?
  expanded: boolean;    // currently expanded in UI?
  children: string[];   // child node IDs
  fileCount?: number;   // for folders
  hasIssues?: boolean;  // validation flag
}

// Store holds a flat map for O(1) lookups
treeNodes: Record<string, TreeNode>;
```

### Pattern 3: Tauri Channels for Streaming Operations

**What:** Use Tauri 2 channels (not events) for search results and bulk validation progress. Channels are ordered and designed for streaming data to the frontend.

**Why:** Search across a client's files may return hundreds of results over several seconds. The event system is designed for low-frequency notifications, not high-throughput streaming. Channels are Tauri's recommended mechanism for streaming operations.

**Example (Rust side):**
```rust
#[tauri::command]
async fn search_explorer_content(
    query: String,
    scope: SearchScope,
    path: String,
    on_result: tauri::ipc::Channel<SearchResult>,
) -> Result<SearchSummary, String> {
    // Stream individual results as found
    for result in explorer::xml_search::search(&query, &scope, &path)? {
        on_result.send(result).map_err(|e| e.to_string())?;
    }
    Ok(SearchSummary { total_matches, files_searched })
}
```

### Pattern 4: Extend IPC Gateway (Don't Bypass It)

**What:** All new Tauri commands are added to `src/services/tauri.ts` following the existing pattern. Feature services call `tauri.explorerListDir()`, never raw `invoke()`.

**Why:** This is an established anti-pattern in the codebase. The centralized gateway provides error handling, type safety, and auditability. Breaking this pattern would create inconsistency.

**Example:**
```typescript
// src/services/tauri.ts — additions
export const tauri = {
  // ... existing commands ...

  // Explorer commands
  explorerListDir: (params: ListDirParams) =>
    invokeCommand<DirectoryEntry[]>("list_explorer_directory_cmd", { params }),
  explorerReadFile: (params: ReadFileParams) =>
    invokeCommand<FileContent>("read_explorer_file_cmd", { params }),
  explorerValidateFile: (params: ValidateParams) =>
    invokeCommand<ValidationResult>("validate_explorer_file_cmd", { params }),
  explorerGetSources: () =>
    invokeCommand<FolderSource[]>("get_explorer_sources_cmd"),
  explorerSaveSources: (sources: FolderSource[]) =>
    invokeCommand<void>("save_explorer_sources_cmd", { sources }),
};
```

### Pattern 5: Rust Module Parallel to `db/`

**What:** Create `src-tauri/src/explorer/` as a new top-level module parallel to `db/`, not inside `db/`. The `commands/explorer.rs` file is thin and delegates to `explorer/` functions, exactly like `commands/schema.rs` delegates to `db/`.

**Why:** The explorer has nothing to do with databases. Putting file system logic inside `db/` would violate the module's responsibility. Following the existing `commands -> module` delegation pattern keeps the architecture consistent.

```
src-tauri/src/
  commands/
    explorer.rs       # Thin: #[tauri::command] fns
  db/                 # Existing database logic (untouched)
  explorer/           # New: all file system + XML logic
    mod.rs
    folder_reader.rs
    xml_parser.rs
    xml_search.rs
    file_watcher.rs
    types.rs
```

### Pattern 6: Reuse Monaco for XML (Already in Bundle)

**What:** Monocle already uses `@monaco-editor/react` and lazy-loads Monaco for SQL. Extend the lazy loader to support XML language mode. Use Monaco's built-in `DiffEditor` component for file comparison.

**Why:** Monaco is already in the bundle (it is substantial at ~2-3MB). Adding XML language support is just registering the language contribution, not adding a new dependency. The DiffEditor is built into Monaco and provides side-by-side and inline diff modes out of the box.

**Example:**
```typescript
// lib/monaco-xml-loader.ts
import { loader } from "@monaco-editor/react";

let monacoXmlLoadPromise: Promise<void> | null = null;

export const ensureMonacoXmlLoaded = () => {
  if (monacoXmlLoadPromise) return monacoXmlLoadPromise;
  
  monacoXmlLoadPromise = Promise.all([
    import("monaco-editor/esm/vs/editor/editor.api"),
    import("monaco-editor/esm/vs/basic-languages/xml/xml.contribution.js"),
  ]).then(([localMonaco]) => {
    loader.config({ monaco: localMonaco });
  });

  return monacoXmlLoadPromise;
};
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Stuffing Explorer State into SchemaStore

**What:** Adding `explorerTree`, `openFiles`, `searchResults` etc. into the existing `useSchemaStore`.
**Why bad:** The store is already 2,181 lines with 50+ state fields. Adding an entirely different domain would make it unmaintainable. Schema and Explorer state have zero shared concerns. Mode switching would trigger unnecessary re-renders across unrelated subscribers.
**Instead:** Create `useExplorerStore` as a separate Zustand store. The only shared concern is the `mode` field in App.tsx, which is already managed via local state / schemaStore mode.

### Anti-Pattern 2: Eager Full-Tree Loading

**What:** Scanning all source folders, all clients, all dates, all files on explorer initialization.
**Why bad:** Network shares over VPN. Hundreds of clients, years of date folders. This could take minutes and send thousands of filesystem calls over a slow link. The app would appear frozen.
**Instead:** Load only root-level entries (sources) on init. Load client list when a source is expanded. Load date folders when a client is expanded. Load files when a date folder is expanded. Each level is a separate IPC call.

### Anti-Pattern 3: Frontend File Reading via tauri-plugin-fs

**What:** Using `@tauri-apps/plugin-fs` `readTextFile()` directly from the frontend to read XML files.
**Why bad:** Plugin-fs reads entire files into memory as strings, crossing the IPC serialization boundary. Large XML files (multi-MB) would be serialized to JSON strings, which doubles memory. Also, the frontend cannot perform encoding detection or binary validation. Security scope configuration for arbitrary network paths is complex.
**Instead:** Custom Rust commands that read files in Rust, detect encoding, validate, parse, and return structured results. Only the data the frontend needs crosses the IPC bridge.

### Anti-Pattern 4: Blocking the Main Thread with Sync File I/O

**What:** Using `std::fs::read_dir` and `std::fs::read_to_string` in Rust command handlers synchronously.
**Why bad:** Tauri async commands run on a thread pool, but synchronous I/O on network shares can block for seconds per call. Under load, this could exhaust the thread pool.
**Instead:** Use `tokio::fs` for async file I/O in all explorer commands. This is already the pattern used by the database module with `tokio` for async tiberius connections. The `tokio` dependency with `rt-multi-thread` is already in Cargo.toml.

### Anti-Pattern 5: One IPC Call Per File During Search

**What:** Frontend iterates files and calls `readFile` for each one during search.
**Why bad:** IPC overhead per call is significant. Searching 200 files would mean 200 round-trips through the serialization boundary, each with its own overhead. On network shares, this amplifies latency.
**Instead:** Single Rust command handles the search loop server-side, streaming results back via Tauri channel. The frontend sends one request and receives results incrementally.

## Key Build Order and Dependencies

The architecture has clear dependency layers that determine build order:

### Layer 0: Rust Types (No Dependencies)

```
src-tauri/src/types/explorer.rs
src-tauri/src/explorer/types.rs
src/features/integration-explorer/types.ts
```

These define the shared data contract. Must be built first because everything else depends on the shape of `DirectoryEntry`, `FileContent`, `ValidationIssue`, `SearchResult`, etc. Rust types use `#[serde(rename_all = "camelCase")]` to match TypeScript, following the existing pattern.

### Layer 1: Rust File System Module (Depends on Types)

```
src-tauri/src/explorer/folder_reader.rs  (depends on: types)
src-tauri/src/explorer/xml_parser.rs     (depends on: types, quick-xml)
```

Core file operations. These can be tested independently with unit tests using temp directories and test XML files. No Tauri dependency at this layer.

### Layer 2: Rust Commands + IPC Gateway (Depends on Layer 1)

```
src-tauri/src/commands/explorer.rs       (depends on: explorer/, state)
src-tauri/src/lib.rs                     (register new commands)
src/services/tauri.ts                    (add explorer commands)
src/features/integration-explorer/services/explorer-service.ts
```

Wire the Rust functions to the frontend. Thin command wrappers + IPC gateway extension + feature service wrappers. At this point, you can call explorer operations from the frontend.

### Layer 3: Store + Core UI (Depends on Layer 2)

```
src/features/integration-explorer/store.ts
src/features/integration-explorer/components/explorer-view.tsx
src/features/integration-explorer/components/folder-tree.tsx
src/features/integration-explorer/components/file-tabs.tsx
src/features/integration-explorer/components/xml-viewer.tsx
```

The shell layout, folder tree, and file viewing. This is the minimal viable Integration Explorer: navigate folders, open files, view XML content.

### Layer 4: Validation + Problems (Depends on Layer 3)

```
src-tauri/src/explorer/xml_parser.rs     (validation logic extension)
src/features/integration-explorer/components/problems-panel.tsx
src/features/integration-explorer/components/xml-source-view.tsx (markers)
```

Adds inline problem highlighting, problems panel, visual flags on files with issues. Extends the XML parser with validation checks.

### Layer 5: Search (Depends on Layer 3)

```
src-tauri/src/explorer/xml_search.rs
src/features/integration-explorer/components/search-panel.tsx
src/features/integration-explorer/hooks/use-search.ts
```

Content search with scope selection. Uses Tauri channels for streaming results. Can be built in parallel with Layer 4.

### Layer 6: Comparison (Depends on Layer 3)

```
src/features/integration-explorer/components/diff-viewer.tsx
src/lib/monaco-xml-loader.ts
```

Monaco DiffEditor for side-by-side/inline file comparison. Can be built in parallel with Layers 4-5.

### Layer 7: Analytics + Watching (Depends on Layers 3-5)

```
src-tauri/src/explorer/file_watcher.rs
src/features/integration-explorer/components/client-dashboard.tsx
src/features/integration-explorer/hooks/use-watcher.ts
```

Analytics dashboards and file system watching. These are enhancement features that depend on the core being stable.

### Dependency Graph

```
Layer 0 (Types)
    │
    ▼
Layer 1 (Rust FS + XML)
    │
    ▼
Layer 2 (Commands + IPC)
    │
    ▼
Layer 3 (Store + Core UI)
    │
    ├──────────────┬──────────────┐
    ▼              ▼              ▼
Layer 4         Layer 5        Layer 6
(Validation)   (Search)      (Comparison)
    │              │
    └──────┬───────┘
           ▼
        Layer 7
    (Analytics + Watching)
```

## Integration Points with Existing Architecture

### Mode Switching in App.tsx

The existing `App.tsx` uses a `showHome` boolean and the `mode` from `useSchemaStore` to decide what to render. Integration Explorer adds a third top-level mode:

```typescript
// Conceptual change to App.tsx routing logic
const showHome = !schema && mode !== "canvas" && mode !== "explorer" && ...;

// In the render:
{mode === "explorer" ? (
  <ExplorerView />
) : showHome ? (
  <HomeScreen ... />
) : (
  <ReactFlowProvider>...</ReactFlowProvider>
)}
```

The `mode` type in the schema store would expand from `"connected" | "canvas"` to include `"explorer"`. Alternatively (and preferably), the mode routing could be lifted out of `useSchemaStore` into App-level state, since "explorer" mode has nothing to do with schema state. This is a decision for implementation.

### Settings Persistence

Explorer-specific settings (configured folder sources, favorites, bookmarks) should extend the existing `AppSettings` struct in Rust and the corresponding TypeScript type:

```rust
// state.rs addition
pub struct AppSettings {
    // ... existing fields ...
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub explorer_sources: Option<Vec<FolderSource>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub explorer_favorites: Option<Vec<String>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub explorer_bookmarks: Option<Vec<Bookmark>>,
}
```

This reuses the existing settings persistence infrastructure (Rust `AppState` -> `settings.json`) without adding a separate config file.

### Native Menu

The existing `menu.rs` builds platform menus and emits events. Explorer mode needs its own menu items (or needs to hide/show items based on mode). The existing `set_menu_ui_state_cmd` pattern can be extended to include explorer state:

```rust
pub struct MenuUiState {
    pub is_canvas_mode: bool,
    pub is_explorer_mode: bool,  // new
    pub has_focus: bool,
    pub has_active_filters: bool,
}
```

### Notification Toasts

Use the existing `useToastStore` for all explorer notifications (file load errors, search complete, watcher alerts). No new notification infrastructure needed.

### Theme Support

Explorer components inherit the existing `ThemeProvider` context. Use the same shadcn/ui components for consistent styling. Monaco Editor already respects the theme via `vs-dark`/`vs-light` settings.

## Scalability Considerations

| Concern | At 10 clients | At 100 clients | At 500+ clients |
|---------|--------------|----------------|-----------------|
| Tree rendering | Direct DOM, no virtualization needed | Virtual list recommended for client list | Virtual list required (TanStack Virtual) |
| Search scope | Instant for single folder | Seconds for single client | Streaming required for cross-client |
| File cache | Keep all in memory | LRU cache (50 files) | LRU cache + tab limit |
| Directory cache | Keep all loaded nodes | Keep all loaded nodes | Evict collapsed subtrees after timeout |
| Validation scan | Seconds | Minutes with progress | Must be cancellable with progress |

For the tree sidebar specifically: at 500+ client folders, the client list alone could have 500+ items. Using TanStack Virtual (already a lightweight dependency at ~15kb) for the tree list ensures smooth scrolling regardless of client count.

## New Rust Dependencies

| Crate | Purpose | Version | Notes |
|-------|---------|---------|-------|
| `quick-xml` | XML parsing (streaming, fast) | latest stable | Streaming parser, does not load entire tree into memory. 2-3x faster than alternatives for large files. |
| `notify` | File system watching | latest stable | Cross-platform (FSEvents/inotify/ReadDirectoryChanges). Note: network share watching has known limitations; polling fallback needed. |
| `encoding_rs` | Character encoding detection/conversion | latest stable | Handles non-UTF-8 files, BOM detection. Already used by many Rust web frameworks. |

Existing crates that are reused: `tokio` (async I/O), `serde`/`serde_json` (serialization), `chrono` (date formatting for date folders), `regex` (filename pattern matching).

## Sources

- Tauri 2 File System Plugin: https://v2.tauri.app/plugin/file-system/
- Tauri 2 Calling Frontend (events + channels): https://v2.tauri.app/develop/calling-frontend/
- Tauri 2 Calling Rust (commands): https://v2.tauri.app/develop/calling-rust/
- quick-xml (high performance XML): https://github.com/tafia/quick-xml
- roxmltree (read-only XML tree): https://github.com/RazrFalcon/roxmltree
- notify-rs (file watching): https://github.com/notify-rs/notify
- TanStack Virtual (list virtualization): https://tanstack.com/virtual/latest
- Monaco Editor DiffEditor: https://monaco-react.surenatoyan.com/
- Zustand multiple stores discussion: https://github.com/pmndrs/zustand/discussions/2496
