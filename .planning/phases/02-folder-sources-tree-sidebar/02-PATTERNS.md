# Phase 2: Folder Sources & Tree Sidebar - Pattern Map

**Mapped:** 2026-05-22
**Files analyzed:** 16 new/modified files
**Analogs found:** 15 / 16

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/features/explorer/types.ts` | model | transform | `src/features/schema-graph/types.ts` | role-match |
| `src/features/explorer/store.ts` | store | event-driven | `src/features/schema-graph/store.ts` | exact |
| `src/features/explorer/services/explorer-service.ts` | service | request-response | `src/features/schema-graph/services/schema-service.ts` | exact |
| `src/features/explorer/components/explorer-shell.tsx` | component | event-driven | `src/features/explorer/components/explorer-shell.tsx` (modify) | exact |
| `src/features/explorer/components/explorer-sidebar.tsx` | component | event-driven | `src/features/schema-graph/components/schema-browser-sidebar.tsx` | exact |
| `src/features/explorer/components/explorer-empty-state.tsx` | component | request-response | `src/features/explorer/components/explorer-empty-state.tsx` (modify) | exact |
| `src/features/explorer/components/folder-tree.tsx` | component | event-driven | `src/features/schema-graph/components/schema-browser-sidebar.tsx` | role-match |
| `src/features/explorer/components/folder-tree-node.tsx` | component | event-driven | `src/features/schema-graph/components/schema-browser-sidebar.tsx` | role-match |
| `src/features/explorer/hooks/use-explorer-sidebar.ts` | hook | event-driven | (no direct analog -- see Shared Patterns) | partial |
| `src/features/settings/components/sections/folder-sources-section.tsx` | component | CRUD | `src/features/settings/components/sections/graph-settings-section.tsx` | role-match |
| `src/features/settings/components/sections/folder-source-row.tsx` | component | CRUD | `src/features/settings/components/sections/appearance-settings-section.tsx` | role-match |
| `src/services/tauri.ts` | service | request-response | `src/services/tauri.ts` (modify) | exact |
| `src-tauri/src/commands/explorer.rs` | controller | file-I/O | `src-tauri/src/commands/settings.rs` | role-match |
| `src-tauri/src/commands/mod.rs` | config | -- | `src-tauri/src/commands/mod.rs` (modify) | exact |
| `src-tauri/src/state.rs` | model | CRUD | `src-tauri/src/state.rs` (modify) | exact |
| `src-tauri/src/lib.rs` | config | -- | `src-tauri/src/lib.rs` (modify) | exact |

---

## Pattern Assignments

### `src/features/explorer/types.ts` (model, transform)

**Analog:** `src/features/schema-graph/types.ts`

**Imports pattern** (lines 1-16 of analog -- interface-only file, no imports):
```typescript
// No imports needed -- pure type declarations
```

**Core type pattern** (analog lines 1-80):
```typescript
// Each domain entity is a plain interface with JSDoc comments
export interface TableNode {
  id: string;   // Format: "schema.table"
  name: string; // Table name only
  schema: string;
  columns: Column[];
}
```

New file should define:
```typescript
export interface FolderSource {
  id: string;        // crypto.randomUUID() on creation
  path: string;      // UNC or local path as-is
  label: string;     // Display name
  tag: string;       // Freeform tag e.g. "Inbound"
  favorites: string[]; // Client folder names pinned per-source
}

export type TreeNodeType = 'source' | 'client' | 'date' | 'file';
export type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

export interface TreeNode {
  id: string;
  path: string;
  name: string;
  type: TreeNodeType;
  children: TreeNode[] | null; // null = not yet loaded
  loadState: LoadState;
  childCount?: number;
  isDir: boolean;
  isFavorite?: boolean;
}

export interface DirEntry {
  name: string;
  isDir: boolean;
  path: string;
}
```

---

### `src/features/explorer/store.ts` (store, event-driven)

**Analog:** `src/features/schema-graph/store.ts`

**Imports pattern** (analog lines 1-33):
```typescript
import { create } from "zustand";
import { explorerService } from "./services/explorer-service";
import { settingsService } from "@/features/settings/services/settings-service";
import type { FolderSource, TreeNode, LoadState } from "./types";
```

**Core store interface pattern** (analog lines 51-207 -- interface block followed by `create<Store>((set, get) => ...)`):
```typescript
interface ExplorerStore {
  // Persisted config (from AppSettings)
  folderSources: FolderSource[];
  // Session tree state
  treeNodes: Map<string, TreeNode>;
  expandedIds: Set<string>;
  filterText: string;
  dateSortOrder: 'newest' | 'oldest';
  // Sidebar UI
  sidebarOpen: boolean;
  sidebarWidth: number;

  // Actions
  loadSources: () => Promise<void>;
  expandNode: (nodeId: string) => Promise<void>;
  collapseNode: (nodeId: string) => void;
  cancelLoad: (nodeId: string) => Promise<void>;
  setFilterText: (text: string) => void;
  toggleDateSort: () => void;
  toggleFavorite: (sourceId: string, clientName: string) => Promise<void>;
  setSidebarOpen: (open: boolean) => void;
  setSidebarWidth: (width: number) => void;
  addSource: (source: FolderSource) => Promise<void>;
  updateSource: (source: FolderSource) => Promise<void>;
  removeSource: (id: string) => Promise<void>;
  reorderSources: (sources: FolderSource[]) => void;
  saveSources: () => Promise<void>;
}
```

**Async action with loading state pattern** (analog lines 684-710 -- `loadMockSchema` as reference):
```typescript
// Pattern: set loading, await IPC, set result or error
loadSchema: async (params: ConnectionParams) => {
  set({ isLoading: true, error: null });
  try {
    const schema = await schemaService.loadSchema(params);
    set({ schema, isLoading: false, isConnected: true, ... });
    return true;
  } catch (err) {
    set({ error: String(err), isLoading: false });
    return false;
  }
},
```

**Settings persistence pattern** (analog lines 962-983 -- `setSchemaFilter`, `setEdgeLabelMode`):
```typescript
// Pattern: update local state first, then persist (fire-and-forget)
setSchemaFilter: (schema: string) => {
  set({ schemaFilter: schema, preferredSchemaFilter: schema });
  settingsService.saveSettings({ schemaFilter: schema }).catch(() => {
    // Ignore persistence errors
  });
},
```

**Store creation pattern** (analog line 680):
```typescript
export const useExplorerStore = create<ExplorerStore>((set, get) => ({
  // initial state...
  // action implementations...
}));
```

---

### `src/features/explorer/services/explorer-service.ts` (service, request-response)

**Analog:** `src/features/schema-graph/services/schema-service.ts` (lines 1-7) and `src/features/settings/services/settings-service.ts` (lines 1-25)

**Imports pattern** (schema-service.ts lines 1-2):
```typescript
import { tauri } from "@/services/tauri";
import type { DirEntry, FolderSource } from "../types";
```

**Core thin-wrapper service pattern** (schema-service.ts lines 4-7):
```typescript
export const schemaService = {
  loadSchema: (params: ConnectionParams) => tauri.loadSchema(params),
  loadMockSchema: (size: string) => tauri.loadMockSchema(size),
};
```

New file should follow the same one-line-per-command wrapper:
```typescript
export const explorerService = {
  listDirectory: (path: string, operationId: string) =>
    tauri.listDirectory(path, operationId),
  cancelDirectory: (operationId: string) =>
    tauri.cancelDirectory(operationId),
  checkPathReachable: (path: string) =>
    tauri.checkPathReachable(path),
  toggleFavorite: (sourceId: string, clientName: string) =>
    tauri.toggleFavorite(sourceId, clientName),
};
```

**Type exports pattern** (settings-service.ts lines 3-20 -- service file also owns type exports):
```typescript
// Service file exports its own request/response types
export interface AppSettings { ... }
export interface SettingsUpdate { ... }
export const settingsService = { ... };
```

---

### `src/features/explorer/components/explorer-shell.tsx` (component, event-driven) -- MODIFY

**Analog:** existing `src/features/explorer/components/explorer-shell.tsx` (lines 1-18)

**Current structure** (lines 1-18):
```typescript
import { ExplorerNavBar } from "./explorer-nav-bar";
import { ExplorerEmptyState } from "./explorer-empty-state";

interface ExplorerShellProps {
  onHome: () => void;
  onOpenSettings: () => void;
}

export function ExplorerShell({ onHome, onOpenSettings }: ExplorerShellProps) {
  return (
    <div className="flex flex-col h-screen">
      <ExplorerNavBar onHome={onHome} onOpenSettings={onOpenSettings} />
      <main className="flex-1 overflow-hidden">
        <ExplorerEmptyState onOpenSettings={onOpenSettings} />
      </main>
    </div>
  );
}
```

**Modification target:** The `<main>` content area must become a flex row: sidebar + content. Pattern to copy from `schema-browser-sidebar.tsx` sidebar layout -- `absolute left-0 top-0 bottom-0` sidebar with slide transition, content area fills remaining space. The shell gains a `sidebarOpen` state wired to `useExplorerStore`.

---

### `src/features/explorer/components/explorer-sidebar.tsx` (component, event-driven) -- NEW

**Analog:** `src/features/schema-graph/components/schema-browser-sidebar.tsx` (lines 1-442)

**Imports pattern** (analog lines 1-19):
```typescript
import { useState, useMemo, useCallback } from "react";
import {
  ChevronRight, ChevronDown, Search, PanelLeftClose,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
```

**Sidebar container pattern** (analog lines 308-316 -- the `<aside>` element):
```typescript
<aside
  className={cn(
    "absolute left-0 top-0 bottom-0 w-[280px] bg-background border-r z-20",
    "flex flex-col overflow-hidden",
    "transition-transform duration-300 ease-in-out",
    open ? "translate-x-0" : "-translate-x-full"
  )}
>
```

**Header with search input pattern** (analog lines 318-353):
```typescript
<div className="flex-shrink-0 border-b p-3">
  <div className="flex items-center justify-between mb-3">
    <h2 className="text-sm font-semibold">Schema Browser</h2>
    <Button variant="ghost" size="icon" className="h-7 w-7"
      onClick={() => onOpenChange(false)} title="Close sidebar">
      <PanelLeftClose className="h-4 w-4" />
    </Button>
  </div>
  <div className="relative">
    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
    <Input
      placeholder="Search objects..."
      value={searchFilter}
      onChange={(e) => setSearchFilter(e.target.value)}
      className="pl-8 h-8 text-sm"
    />
  </div>
</div>
```

**Scroll area tree body pattern** (analog lines 356-439):
```typescript
<ScrollArea className="flex-1">
  <div className="p-2">
    {filteredTree.length === 0 ? (
      <p className="text-sm text-muted-foreground text-center py-8">
        {emptyMessage}
      </p>
    ) : (
      filteredTree.map((node) => (...))
    )}
  </div>
</ScrollArea>
```

**Resize handle:** No direct analog. New pattern: a 4px-wide `div` on the right edge with `cursor-col-resize`, mouse event handlers for drag tracking. Width stored in store, persisted to AppSettings on `mouseup` only (debounced/deferred -- see pitfall 4 in RESEARCH.md).

---

### `src/features/explorer/components/explorer-empty-state.tsx` (component, request-response) -- MODIFY

**Analog:** existing `src/features/explorer/components/explorer-empty-state.tsx` (lines 1-25)

**Current pattern** (lines 1-25):
```typescript
import { Button } from "@/components/ui/button";
import { FolderSync, Settings } from "lucide-react";

export function ExplorerEmptyState({ onOpenSettings }: ExplorerEmptyStateProps) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-3 text-center">
        <FolderSync className="w-10 h-10 text-muted-foreground mb-1" />
        <h2 className="text-xl font-semibold">Integration Explorer</h2>
        <p className="text-sm text-muted-foreground max-w-sm">...</p>
        <Button className="mt-6" onClick={onOpenSettings}>
          <Settings className="w-4 h-4" />
          Open Settings
        </Button>
      </div>
    </div>
  );
}
```

**Modification:** When `folderSources.length === 0`, show updated message: "Add a folder source in Settings to get started" (D-08). The `Button` element and layout remain identical. The component should accept an optional `hasSources` prop to conditionally render different copy without restructuring the layout.

---

### `src/features/explorer/components/folder-tree.tsx` (component, event-driven) -- NEW

**Analog:** `src/features/schema-graph/components/schema-browser-sidebar.tsx` (lines 200-225 -- `filterTree` function, and lines 365-439 -- tree rendering loop)

**Filter function pattern** (analog lines 200-225):
```typescript
function filterTree(tree: TreeCategory[], filter: string): TreeCategory[] {
  if (!filter.trim()) return tree;
  const lowerFilter = filter.toLowerCase();
  return tree
    .map((category) => {
      const filteredSchemas = category.schemas
        .map((schema) => ({
          ...schema,
          items: schema.items.filter(
            (item) =>
              item.name.toLowerCase().includes(lowerFilter) ||
              item.schema.toLowerCase().includes(lowerFilter)
          ),
        }))
        .filter((schema) => schema.items.length > 0);
      return { ...category, schemas: filteredSchemas, count: filteredSchemas.reduce(...) };
    })
    .filter((category) => category.schemas.length > 0);
}
```

**Tree node rendering pattern** (analog lines 365-439 -- category row, schema row, item row nesting):
```typescript
// Three-level nesting: category > schema > item
// Each level: chevron + icon + name + count badge
// Toggle via Set<string> of expanded IDs
{filteredTree.map((category) => (
  <div key={category.type} className="mb-1">
    <button
      className="flex items-center gap-2 w-full px-2 py-1.5 rounded hover:bg-muted text-left"
      onClick={() => toggleCategory(category.type)}
    >
      {expanded.has(category.type) ? (
        <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      ) : (
        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      )}
      <span className="text-sm font-medium flex-1 truncate">{category.label}</span>
      <span className="text-xs text-muted-foreground">{category.count}</span>
    </button>
    {expanded.has(category.type) && (
      <div className="ml-4">{/* children */}</div>
    )}
  </div>
))}
```

**Key difference from analog:** Expand triggers async IPC load (lazy). Chevron replaced by `Loader2 className="animate-spin"` while `loadState === 'loading'`. Children are `null` until loaded (not pre-built from synchronous data). Favorites section pinned above alphabetical client list when `favorites.length > 0`.

---

### `src/features/explorer/components/folder-tree-node.tsx` (component, event-driven) -- NEW

**Analog:** The item button inside `schema-browser-sidebar.tsx` (lines 416-428):
```typescript
<button
  key={item.id}
  className="flex items-center gap-2 w-full px-2 py-1 rounded hover:bg-muted text-left"
  onClick={(e) => handleItemClick(e, item.data)}
>
  <span className="w-3.5" />
  <span className="text-sm truncate">{item.name}</span>
</button>
```

**Extended for this phase:** Single row component accepting `node: TreeNode` prop. Renders: expand chevron (or spinner if loading, or indented spacer if file), node icon (Folder/FolderOpen/File/FileCode for XML), name text, child count badge, star icon on hover (clients only), context menu wrapper (clients only). File nodes are non-interactive (`cursor-default`).

**Context menu pattern:** New -- uses `@radix-ui/react-context-menu` (shadcn `context-menu` component). No existing analog in codebase.

---

### `src/features/explorer/hooks/use-explorer-sidebar.ts` (hook, event-driven) -- NEW

**Analog:** No direct hook analog exists. Closest behavioral reference is state management within `schema-browser-sidebar.tsx` (lines 240-306 -- `useState`, `useCallback` for expand/collapse/filter state).

**State management pattern from analog** (lines 240-274):
```typescript
const [searchFilter, setSearchFilter] = useState("");
const [expandedCategories, setExpandedCategories] = useState<Set<ObjectType>>(
  new Set(["tables"])
);

const toggleCategory = useCallback((type: ObjectType) => {
  setExpandedCategories((prev) => {
    const next = new Set(prev);
    if (next.has(type)) { next.delete(type); } else { next.add(type); }
    return next;
  });
}, []);
```

**Hook responsibility:** Encapsulate sidebar open/close toggle and width drag state (local to component during drag, persisted to store on mouseup). The store holds the persisted width; the hook holds the ephemeral drag delta. Pattern: `const [isDragging, setIsDragging] = useState(false)` with `useEffect` to attach/detach global `mousemove`/`mouseup` listeners during drag.

---

### `src/features/settings/components/sections/folder-sources-section.tsx` (component, CRUD) -- NEW

**Analog:** `src/features/settings/components/sections/graph-settings-section.tsx` (lines 1-144)

**Imports pattern** (analog lines 1-16):
```typescript
import { useSchemaStore } from "@/features/schema-graph/store";
import { useShallow } from "zustand/shallow";
import { Select, SelectContent, ... } from "@/components/ui/select";
```

New file imports:
```typescript
import { useExplorerStore } from "@/features/explorer/store";
import { useShallow } from "zustand/shallow";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import type { FolderSource } from "@/features/explorer/types";
```

**Section layout pattern** (analog lines 50-57):
```typescript
<div className="space-y-6 px-1">
  <div className="space-y-1">
    <h3 className="text-base font-semibold">Folder Sources</h3>
    <p className="text-xs text-muted-foreground">
      Configure root folder paths to browse in the explorer.
    </p>
  </div>
  {/* source list + add button */}
</div>
```

**Store interaction pattern** (analog lines 32-45 -- `useSchemaStore` with `useShallow`):
```typescript
const { folderSources, addSource, updateSource, removeSource, reorderSources, saveSources } =
  useExplorerStore(
    useShallow((state) => ({
      folderSources: state.folderSources,
      addSource: state.addSource,
      // ...
    }))
  );
```

**DnD pattern** (from RESEARCH.md Pattern 3):
```typescript
const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event;
  if (over && active.id !== over.id) {
    // arrayMove and call reorderSources
  }
};

<DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
  <SortableContext items={sources.map(s => s.id)} strategy={verticalListSortingStrategy}>
    {sources.map(source => <FolderSourceRow key={source.id} source={source} />)}
  </SortableContext>
</DndContext>
```

---

### `src/features/settings/components/sections/folder-source-row.tsx` (component, CRUD) -- NEW

**Analog:** `src/features/settings/components/sections/appearance-settings-section.tsx` (lines 1-40) -- form field layout pattern.

**Form field layout pattern** (analog lines 23-37):
```typescript
<div className="space-y-2">
  <label className="text-sm font-medium">Theme</label>
  <Select value={theme} onValueChange={setTheme}>
    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
    <SelectContent>...</SelectContent>
  </Select>
  <p className="text-xs text-muted-foreground">Description text.</p>
</div>
```

**dnd-kit sortable row pattern** (from RESEARCH.md Pattern 3):
```typescript
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

function FolderSourceRow({ source, id }: { source: FolderSource; id: string }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 border rounded-md p-3">
      <GripVertical className="h-4 w-4 cursor-grab text-muted-foreground" {...attributes} {...listeners} />
      {/* path Input, label Input, tag Input, browse Button, remove Button */}
    </div>
  );
}
```

**Browse button pattern** (from RESEARCH.md Code Examples):
```typescript
import { open } from "@tauri-apps/plugin-dialog";

async function browseForFolder(): Promise<string | null> {
  const selected = await open({ directory: true, multiple: false, title: "Select folder source" });
  return selected as string | null;
}
```

**Path reachability warning pattern:** Inline yellow warning below path input when `isUnreachable === true`. Use `cn("text-xs", isUnreachable ? "text-yellow-600" : "text-muted-foreground")` -- similar to the description text pattern in analog.

---

### `src/services/tauri.ts` (service, request-response) -- MODIFY

**Analog:** `src/services/tauri.ts` (lines 1-49)

**Existing invokeCommand wrapper** (lines 12-24):
```typescript
async function invokeCommand<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T> {
  try {
    return args ? await invoke<T>(command, args) : await invoke<T>(command);
  } catch (error) {
    console.error(`Tauri command failed: ${command}`, error);
    throw error;
  }
}
```

**Command registry pattern** (lines 27-49):
```typescript
export const tauri = {
  getSettings: () => invokeCommand<AppSettings>("get_settings"),
  saveSettings: (settings: SettingsUpdate) =>
    invokeCommand<AppSettings>("save_settings", { settings }),
};
```

**New entries to add** (following exact same pattern):
```typescript
// Explorer commands
listDirectory: (path: string, operationId: string) =>
  invokeCommand<DirEntry[]>("list_directory_cmd", { path, operationId }),
cancelDirectory: (operationId: string) =>
  invokeCommand<void>("cancel_directory_cmd", { operationId }),
checkPathReachable: (path: string) =>
  invokeCommand<boolean>("check_path_reachable", { path }),
toggleFavorite: (sourceId: string, clientName: string) =>
  invokeCommand<AppSettings>("toggle_favorite_cmd", { sourceId, clientName }),
```

**Import addition:** Add `DirEntry` from explorer types at the top.

---

### `src-tauri/src/commands/explorer.rs` (controller, file-I/O) -- NEW

**Analog:** `src-tauri/src/commands/settings.rs` (lines 1-15) -- thin command that delegates to state.

**Command function pattern** (analog lines 4-15):
```rust
use crate::state::{AppSettings, AppSettingsUpdate, AppState};
use tauri::State;

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Result<AppSettings, String> {
    state.get_settings()
}

#[tauri::command]
pub fn save_settings(
    state: State<'_, AppState>,
    settings: AppSettingsUpdate,
) -> Result<AppSettings, String> {
    state.update_settings(settings)
}
```

**New commands needed in `explorer.rs`** (from RESEARCH.md Pattern 2 and Code Examples):
```rust
use crate::state::{AppSettings, AppState};
use tauri::State;
use tokio::time::{timeout, Duration};
use tokio_util::sync::CancellationToken;
use std::collections::HashMap;
use std::sync::Mutex;
use serde::Serialize;

// Separate managed state for active directory listings
pub struct ExplorerState {
    pub active_listings: Mutex<HashMap<String, CancellationToken>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    pub name: String,
    pub is_dir: bool,
    pub path: String,
}

#[tauri::command]
pub async fn list_directory_cmd(
    path: String,
    operation_id: String,
    explorer_state: State<'_, ExplorerState>,
) -> Result<Vec<DirEntry>, String> {
    // register CancellationToken, spawn_blocking with timeout(15s)
    // check token.is_cancelled() per entry
    // clean up token on completion
}

#[tauri::command]
pub fn cancel_directory_cmd(
    operation_id: String,
    explorer_state: State<'_, ExplorerState>,
) -> Result<(), String> {
    // find token by operation_id, call token.cancel()
}

#[tauri::command]
pub async fn check_path_reachable(path: String) -> Result<bool, String> {
    // spawn_blocking { std::fs::metadata(&path).is_ok() }
}

#[tauri::command]
pub fn toggle_favorite_cmd(
    source_id: String,
    client_name: String,
    state: State<'_, AppState>,
) -> Result<AppSettings, String> {
    // state.toggle_favorite(source_id, client_name) -- atomic toggle on AppSettings.folder_sources
}
```

**Serde attribute pattern** (from `src-tauri/src/state.rs` lines 5-7):
```rust
#[derive(Default, Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings { ... }
```

---

### `src-tauri/src/commands/mod.rs` (config) -- MODIFY

**Analog:** `src-tauri/src/commands/mod.rs` (lines 1-11)

**Current pattern** (lines 1-11):
```rust
pub mod databases;
pub mod menu;
pub mod mock;
pub mod schema;
pub mod settings;

pub use databases::list_databases_cmd;
pub use menu::set_menu_ui_state_cmd;
pub use mock::load_schema_mock;
pub use schema::load_schema_cmd;
pub use settings::{get_settings, save_settings};
```

**Addition required:**
```rust
pub mod explorer;
pub use explorer::{list_directory_cmd, cancel_directory_cmd, check_path_reachable, toggle_favorite_cmd};
```

---

### `src-tauri/src/state.rs` (model, CRUD) -- MODIFY

**Analog:** `src-tauri/src/state.rs` (lines 1-103)

**Struct definition pattern** (lines 1-18):
```rust
#[derive(Default, Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub theme: Option<String>,
    // ... other Option<T> fields
}
```

**New struct to add** (from RESEARCH.md Pattern 4):
```rust
#[derive(Default, Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FolderSource {
    pub id: String,
    pub path: String,
    pub label: String,
    #[serde(default)]
    pub tag: String,
    #[serde(default)]
    pub favorites: Vec<String>,
}
```

**AppSettings new fields:**
```rust
#[serde(default, skip_serializing_if = "Vec::is_empty")]
pub folder_sources: Vec<FolderSource>,
#[serde(default, skip_serializing_if = "Option::is_none")]
pub explorer_sidebar_width: Option<f64>,
```

**AppSettingsUpdate new fields** (lines 25-33 -- same pattern, all Option):
```rust
pub folder_sources: Option<Vec<FolderSource>>,
pub explorer_sidebar_width: Option<f64>,
```

**update_settings method extension** (lines 78-101 -- add new branches):
```rust
if let Some(folder_sources) = update.folder_sources {
    settings.folder_sources = folder_sources;
}
if let Some(explorer_sidebar_width) = update.explorer_sidebar_width {
    settings.explorer_sidebar_width = Some(explorer_sidebar_width);
}
```

**New toggle_favorite method** (follows `update_settings` pattern -- lock, mutate, drop, save):
```rust
pub fn toggle_favorite(&self, source_id: &str, client_name: &str) -> Result<AppSettings, String> {
    let mut settings = self.settings.lock().map_err(|e| e.to_string())?;
    if let Some(source) = settings.folder_sources.iter_mut().find(|s| s.id == source_id) {
        if let Some(pos) = source.favorites.iter().position(|f| f == client_name) {
            source.favorites.remove(pos);
        } else {
            source.favorites.push(client_name.to_string());
        }
    }
    let updated = settings.clone();
    drop(settings);
    self.save_settings()?;
    Ok(updated)
}
```

**Test pattern** (lines 105-133 -- `cfg(test)` block with `tempfile::tempdir()`):
```rust
#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn settings_persist_to_disk() {
        let dir = tempdir().expect("tempdir");
        let state = AppState::new(dir.path().to_path_buf());
        // update_settings, reload, assert fields
    }
}
```

---

### `src-tauri/src/lib.rs` (config) -- MODIFY

**Analog:** `src-tauri/src/lib.rs` (lines 1-47)

**Command registration pattern** (lines 37-44):
```rust
.invoke_handler(tauri::generate_handler![
    load_schema_mock,
    load_schema_cmd,
    list_databases_cmd,
    get_settings,
    save_settings,
    set_menu_ui_state_cmd,
])
```

**Managed state pattern** (lines 26-28):
```rust
let state = AppState::new(app_data_dir);
app.manage(state);
```

**Additions required:**
```rust
// After existing app.manage(state):
let explorer_state = commands::explorer::ExplorerState {
    active_listings: std::sync::Mutex::new(std::collections::HashMap::new()),
};
app.manage(explorer_state);
```

And add new commands to `generate_handler!`:
```rust
list_directory_cmd,
cancel_directory_cmd,
check_path_reachable,
toggle_favorite_cmd,
```

---

## Shared Patterns

### Zustand Store with `useShallow`
**Source:** `src/features/settings/components/sections/graph-settings-section.tsx` lines 32-45
**Apply to:** `folder-sources-section.tsx`, any component consuming `useExplorerStore`
```typescript
const { folderSources, addSource } = useExplorerStore(
  useShallow((state) => ({
    folderSources: state.folderSources,
    addSource: state.addSource,
  }))
);
```

### Settings Persistence (fire-and-forget)
**Source:** `src/features/schema-graph/store.ts` lines 916-919
**Apply to:** All store actions that must persist to disk
```typescript
settingsService.saveSettings({ schemaFilter: schema }).catch(() => {
  // Ignore persistence errors
});
```

### Rust Serde Struct Conventions
**Source:** `src-tauri/src/state.rs` lines 5-7
**Apply to:** `DirEntry`, `FolderSource`, all new Rust public types
```rust
#[derive(Default, Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MyStruct { ... }
```

### Rust State Lock Pattern
**Source:** `src-tauri/src/state.rs` lines 54-57 and 78-80
**Apply to:** All `AppState` methods, `ExplorerState` access in `explorer.rs`
```rust
let mut settings = self.settings.lock().map_err(|e| e.to_string())?;
// mutate...
let updated = settings.clone();
drop(settings);
self.save_settings()?;
Ok(updated)
```

### Tauri IPC Command Registration
**Source:** `src-tauri/src/lib.rs` lines 37-44 and `src-tauri/src/commands/mod.rs` lines 1-11
**Apply to:** Every new Rust command
Three-step: (1) define in `commands/explorer.rs`, (2) re-export in `commands/mod.rs`, (3) add to `generate_handler!` in `lib.rs`.

### React `cn()` Conditional Classes
**Source:** `src/features/schema-graph/components/schema-browser-sidebar.tsx` line 311
**Apply to:** All new component files with conditional Tailwind classes
```typescript
import { cn } from "@/lib/utils";
className={cn("base-class", condition && "conditional-class")}
```

### shadcn/ui Imports
**Source:** `src/features/schema-graph/components/schema-browser-sidebar.tsx` lines 14-16
**Apply to:** All new component files
```typescript
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
```

### Test File Structure
**Source:** `src/features/explorer/store-integration.test.ts` lines 1-101
**Apply to:** `store.test.ts`, `date-format.test.ts`, `tree-filter.test.ts`
```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useExplorerStore } from "@/features/explorer/store";

vi.mock("@/features/explorer/services/explorer-service", () => ({
  explorerService: { listDirectory: vi.fn(), ... },
}));

describe("feature name", () => {
  beforeEach(() => {
    useExplorerStore.setState(createInitialExplorerState());
    vi.clearAllMocks();
  });

  it("description of behavior", () => {
    // arrange, act, assert
  });
});
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/features/explorer/hooks/use-explorer-sidebar.ts` | hook | event-driven | No resize-drag hook exists; closest analog is inline state in schema-browser-sidebar but not extracted to a hook. Use the `useState` + `useCallback` + `useEffect` pattern from that component directly. |

---

## Metadata

**Analog search scope:** `src/features/`, `src/services/`, `src-tauri/src/commands/`, `src-tauri/src/state.rs`, `src-tauri/src/lib.rs`
**Files scanned:** 17
**Pattern extraction date:** 2026-05-22
