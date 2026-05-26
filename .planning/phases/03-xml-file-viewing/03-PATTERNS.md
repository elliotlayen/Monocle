# Phase 3: XML File Viewing - Pattern Map

**Mapped:** 2026-05-26
**Files analyzed:** 21 new/modified files
**Analogs found:** 21 / 21

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src-tauri/src/commands/explorer.rs` (MODIFY) | command | request-response | itself (`list_directory_cmd`) | exact |
| `src-tauri/src/commands/mod.rs` (MODIFY) | config | -- | itself | exact |
| `src-tauri/src/lib.rs` (MODIFY) | config | -- | itself | exact |
| `src-tauri/capabilities/default.json` (MODIFY) | config | -- | itself | exact |
| `src/services/tauri.ts` (MODIFY) | service | request-response | itself (`listDirectory`) | exact |
| `src/features/explorer/types.ts` (MODIFY) | model | -- | itself | exact |
| `src/features/explorer/services/explorer-service.ts` (MODIFY) | service | request-response | itself (`listDirectory`) | exact |
| `src/features/explorer/store.ts` (MODIFY) | store | CRUD | itself (`expandNode`) | exact |
| `src/features/explorer/components/explorer-shell.tsx` (MODIFY) | component | request-response | itself | exact |
| `src/features/explorer/components/explorer-empty-state.tsx` (MODIFY) | component | request-response | itself | exact |
| `src/features/explorer/components/folder-tree-node.tsx` (MODIFY) | component | event-driven | itself | exact |
| `src/lib/monaco-xml-loader.ts` (NEW) | utility | transform | `src/lib/monaco-sql-loader.ts` | exact |
| `src/features/explorer/components/file-tab-bar.tsx` (NEW) | component | event-driven | `src/features/explorer/components/folder-tree-node.tsx` | role-match |
| `src/features/explorer/components/file-tab.tsx` (NEW) | component | event-driven | `src/features/explorer/components/folder-tree-node.tsx` | role-match |
| `src/features/explorer/components/file-content-area.tsx` (NEW) | component | request-response | `src/features/explorer/components/explorer-shell.tsx` | role-match |
| `src/features/explorer/components/file-content-header.tsx` (NEW) | component | event-driven | `src/features/explorer/components/explorer-sidebar.tsx` | role-match |
| `src/features/explorer/components/xml-source-view.tsx` (NEW) | component | transform | `src/features/schema-graph/components/sql-code-block.tsx` | exact |
| `src/features/explorer/components/xml-tree-view.tsx` (NEW) | component | transform | `src/features/explorer/components/folder-tree.tsx` | role-match |
| `src/features/explorer/components/xml-tree-node.tsx` (NEW) | component | transform | `src/features/explorer/components/folder-tree-node.tsx` | role-match |
| `src/features/explorer/hooks/use-file-actions.ts` (NEW) | hook | request-response | `src/features/export/hooks/useExport.ts` | exact |
| `src/features/explorer/utils/xml-parser.ts` (NEW) | utility | transform | `src/features/explorer/utils/tree-filter.ts` | role-match |
| `src/features/explorer/utils/file-size-format.ts` (NEW) | utility | transform | `src/features/explorer/utils/date-format.ts` | exact |
| `src/features/explorer/utils/tab-disambiguator.ts` (NEW) | utility | transform | `src/features/explorer/utils/tree-filter.ts` | role-match |

## Pattern Assignments

### `src-tauri/src/commands/explorer.rs` (command, request-response) -- MODIFY

**Analog:** itself -- `list_directory_cmd` at lines 21-86

**Struct + serde pattern** (lines 13-19):
```rust
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    pub name: String,
    pub is_dir: bool,
    pub path: String,
}
```

**Tauri command with spawn_blocking + timeout pattern** (lines 21-86):
```rust
#[tauri::command]
pub async fn list_directory_cmd(
    path: String,
    operation_id: String,
    explorer_state: State<'_, ExplorerState>,
) -> Result<Vec<DirEntry>, String> {
    // ... cancellation token setup ...
    let result = tokio::time::timeout(
        Duration::from_secs(15),
        tokio::task::spawn_blocking(move || {
            let read_dir = std::fs::read_dir(&path)
                .map_err(|e| format!("Failed to read directory '{}': {}", path, e))?;
            // ... blocking I/O ...
            Ok(entries)
        }),
    )
    .await;

    match result {
        Ok(Ok(entries)) => entries,
        Ok(Err(e)) => Err(format!("Directory listing task failed: {}", e)),
        Err(_) => Err("Folder listing timed out after 15 seconds".to_string()),
    }
}
```

**New `read_file_cmd` follows same pattern** but simpler (no cancellation token needed, just `spawn_blocking` + `timeout`). Uses `std::fs::read_to_string` + `std::fs::metadata` for size. Returns `FileContent { content, size }` struct with `#[serde(rename_all = "camelCase")]`.

---

### `src-tauri/src/commands/mod.rs` (config) -- MODIFY

**Analog:** itself -- lines 1-17

**Export pattern** (lines 8-12):
```rust
pub use explorer::{
    cancel_directory_cmd, check_path_reachable, list_directory_cmd, toggle_favorite_cmd,
    ExplorerState,
};
```

Add `read_file_cmd` to the `pub use explorer::{ ... }` block.

---

### `src-tauri/src/lib.rs` (config) -- MODIFY

**Analog:** itself -- lines 45-56

**Plugin registration pattern** (lines 19-25):
```rust
.plugin(tauri_plugin_opener::init())
.plugin(tauri_plugin_updater::Builder::new().build())
.plugin(tauri_plugin_process::init())
.plugin(tauri_plugin_dialog::init())
.plugin(tauri_plugin_fs::init())
```

Add `tauri_plugin_clipboard_manager::init()` to plugin chain.

**Command registration pattern** (lines 45-56):
```rust
.invoke_handler(tauri::generate_handler![
    load_schema_mock,
    load_schema_cmd,
    list_databases_cmd,
    // ...
    toggle_favorite_cmd,
])
```

Add `read_file_cmd` to the handler list. Also add to the imports from `commands::` at line 7-10.

---

### `src-tauri/capabilities/default.json` (config) -- MODIFY

**Analog:** itself -- lines 1-18

**Permissions array pattern** (lines 6-17):
```json
"permissions": [
    "core:default",
    "opener:default",
    "updater:default",
    "process:default",
    "dialog:default",
    "fs:default",
    "fs:allow-write-text-file",
    "fs:allow-write-file",
    "fs:allow-read-file",
    "fs:allow-read-text-file"
]
```

Add `"opener:allow-open-path"` and `"clipboard-manager:allow-write-text"` to the permissions array.

---

### `src/services/tauri.ts` (service, request-response) -- MODIFY

**Analog:** itself -- lines 51-59

**Import pattern** (lines 1-11):
```typescript
import { invoke } from "@tauri-apps/api/core";
import type {
  ConnectionParams,
  ServerConnectionParams,
  SchemaGraph,
} from "@/features/schema-graph/types";
import type {
  AppSettings,
  SettingsUpdate,
} from "@/features/settings/services/settings-service";
import type { DirEntry } from "@/features/explorer/types";
```

**Command wrapper pattern** (lines 51-59):
```typescript
// Explorer commands
listDirectory: (path: string, operationId: string) =>
  invokeCommand<DirEntry[]>("list_directory_cmd", { path, operationId }),
cancelDirectory: (operationId: string) =>
  invokeCommand<void>("cancel_directory_cmd", { operationId }),
checkPathReachable: (path: string) =>
  invokeCommand<boolean>("check_path_reachable", { path }),
```

Add `readFile` method following same pattern: `readFile: (path: string) => invokeCommand<FileContent>("read_file_cmd", { path })`. Import `FileContent` type from explorer types.

---

### `src/features/explorer/types.ts` (model) -- MODIFY

**Analog:** itself -- lines 1-29

**Interface pattern** (lines 1-7):
```typescript
export interface FolderSource {
  id: string;
  path: string;
  label: string;
  tag: string;
  favorites: string[];
}
```

**Type alias pattern** (lines 9-11):
```typescript
export type TreeNodeType = "source" | "client" | "date" | "file";
export type LoadState = "idle" | "loading" | "loaded" | "error";
```

Add `ViewMode`, `FileTab`, `FileContent` types following same conventions. All types are plain interfaces/type aliases, no classes.

---

### `src/features/explorer/services/explorer-service.ts` (service, request-response) -- MODIFY

**Analog:** itself -- lines 1-19

**Import pattern** (lines 1-3):
```typescript
import { tauri } from "@/services/tauri";
import type { DirEntry } from "../types";
import type { AppSettings } from "@/features/settings/services/settings-service";
```

**Service method pattern** (lines 5-7):
```typescript
export const explorerService = {
  listDirectory: (path: string, operationId: string): Promise<DirEntry[]> =>
    tauri.listDirectory(path, operationId),
```

Add `readFile` method: `readFile: (path: string): Promise<FileContent> => tauri.readFile(path)`. Import `FileContent` from types.

---

### `src/features/explorer/store.ts` (store, CRUD) -- MODIFY

**Analog:** itself -- lines 1-300

**Import pattern** (lines 1-4):
```typescript
import { create } from "zustand";
import type { FolderSource, TreeNode, DirEntry } from "./types";
import { explorerService } from "./services/explorer-service";
import { settingsService } from "@/features/settings/services/settings-service";
```

**Store interface pattern** (lines 6-29):
```typescript
interface ExplorerStore {
  // State
  folderSources: FolderSource[];
  treeNodes: Map<string, TreeNode>;
  expandedIds: Set<string>;
  // ...

  // Actions
  loadSources: () => Promise<void>;
  expandNode: (nodeId: string) => Promise<void>;
  // ...
}
```

**Async action with error handling pattern** (lines 113-179 -- `expandNode`):
```typescript
expandNode: async (nodeId: string) => {
    const { treeNodes, activeOperations, folderSources } = get();
    const node = treeNodes.get(nodeId);
    if (!node) return;
    if (node.loadState === "loading") return;

    // Set loading state
    const updatedNode = { ...node, loadState: "loading" as const };
    const nextNodes = new Map(treeNodes);
    nextNodes.set(nodeId, updatedNode);
    set({ treeNodes: nextNodes, /* ... */ });

    try {
      const entries = await explorerService.listDirectory(node.path, operationId);
      // ... success handling, set state ...
    } catch {
      // ... error handling, set error state ...
    }
},
```

Add tab state (`tabs: FileTab[]`, `activeTabId: string | null`) and tab actions (`openFile`, `closeTab`, `closeOtherTabs`, `closeAllTabs`, `setActiveTab`, `setViewMode`, `setScrollPosition`). The `openFile` action follows `expandNode` pattern: check if tab exists first, set loading state, call service, update state on success/failure.

---

### `src/features/explorer/components/explorer-shell.tsx` (component, request-response) -- MODIFY

**Analog:** itself -- lines 1-36

**Import pattern** (lines 1-6):
```typescript
import { useShallow } from "zustand/shallow";
import { ExplorerNavBar } from "./explorer-nav-bar";
import { ExplorerEmptyState } from "./explorer-empty-state";
import { ExplorerSidebar } from "./explorer-sidebar";
import { SidebarToggle } from "@/features/schema-graph/components/sidebar-toggle";
import { useExplorerStore } from "../store";
```

**Store selector pattern** (lines 14-19):
```typescript
const { sidebarOpen, setSidebarOpen } = useExplorerStore(
    useShallow((state) => ({
      sidebarOpen: state.sidebarOpen,
      setSidebarOpen: state.setSidebarOpen,
    }))
);
```

**Layout pattern** (lines 22-35):
```typescript
return (
    <div className="flex flex-col h-screen">
      <ExplorerNavBar onHome={onHome} onOpenSettings={onOpenSettings} />
      <div className="flex flex-row flex-1 overflow-hidden">
        <ExplorerSidebar />
        <div className="flex-1 overflow-hidden relative">
          <SidebarToggle onClick={() => setSidebarOpen(true)} visible={!sidebarOpen} />
          <ExplorerEmptyState onOpenSettings={onOpenSettings} />
        </div>
      </div>
    </div>
);
```

Modify to: add `tabs` and `activeTabId` to the selector; conditionally render `FileTabBar` + `FileContentArea` when tabs are open, else `ExplorerEmptyState`. The content `div` gets `flex flex-col` added.

---

### `src/features/explorer/components/explorer-empty-state.tsx` (component) -- MODIFY

**Analog:** itself -- lines 1-44

**Context-aware messaging pattern** (lines 23-39):
```typescript
const hasSources = folderSources.length > 0;

return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-center">
        <FolderSync className="mb-1 h-10 w-10 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Integration Explorer</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          {hasSources
            ? "Expand a source in the sidebar to browse folders."
            : "Add a folder source in Settings to get started."}
        </p>
```

Add third state: when sources exist AND sidebar has content, show "Click a file in the sidebar to open it" (D-15).

---

### `src/features/explorer/components/folder-tree-node.tsx` (component, event-driven) -- MODIFY

**Analog:** itself -- lines 239-285

**File row + click handler pattern** (lines 239-258):
```typescript
const rowContent = (
    <div
      className={cn(
        "group flex items-center gap-1 w-full rounded",
        rowPadding,
        !isFile && "hover:bg-muted cursor-pointer",
        isFile && "cursor-default",
      )}
      style={{ paddingLeft: `${depth * 16}px` }}
      onClick={!isFile ? handleToggle : undefined}
    >
```

Change: files become clickable (`cursor-pointer`, `hover:bg-muted`). Add `onFileClick` callback prop. File rows get onClick that calls `onFileClick(node.path)`.

**Context menu pattern** (lines 261-283):
```typescript
const wrappedRow = isClient ? (
    <ContextMenu>
      <ContextMenuTrigger asChild>{rowContent}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => onToggleFavorite(sourceId, node.name)}>
          {node.isFavorite ? "Remove from Favorites" : "Add to Favorites"}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
) : /* ... */
```

Add file-specific context menu with: Copy Path, Open in External Editor, Copy Content, Save a Copy.

---

### `src/lib/monaco-xml-loader.ts` (utility, transform) -- NEW

**Analog:** `src/lib/monaco-sql-loader.ts` -- lines 1-24

**Complete pattern to replicate** (lines 1-24):
```typescript
import { loader } from "@monaco-editor/react";
import { registerSqlCompletionProvider } from "@/lib/sql-intellisense";

let monacoSqlLoadPromise: Promise<void> | null = null;

export const ensureMonacoSqlLoaded = () => {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (monacoSqlLoadPromise) {
    return monacoSqlLoadPromise;
  }

  monacoSqlLoadPromise = Promise.all([
    import("monaco-editor/esm/vs/editor/editor.api"),
    import("monaco-editor/esm/vs/basic-languages/sql/sql.contribution.js"),
  ]).then(([localMonaco]) => {
    loader.config({ monaco: localMonaco });
    registerSqlCompletionProvider(localMonaco);
  });

  return monacoSqlLoadPromise;
};
```

Replace: `sql` -> `xml`, remove `registerSqlCompletionProvider` (no autocomplete for XML), import `xml.contribution.js` instead of `sql.contribution.js`. Naming: `monacoXmlLoadPromise`, `ensureMonacoXmlLoaded`.

---

### `src/features/explorer/components/xml-source-view.tsx` (component, transform) -- NEW

**Analog:** `src/features/schema-graph/components/sql-code-block.tsx` -- lines 1-96

**Import pattern** (lines 1-5):
```typescript
import { useEffect, useMemo, useState } from "react";
import Editor from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import { useResolvedTheme } from "@/hooks/use-resolved-theme";
import { ensureMonacoSqlLoaded } from "@/lib/monaco-sql-loader";
```

**Monaco lazy-load + ready state pattern** (lines 17-34):
```typescript
const [isMonacoReady, setIsMonacoReady] = useState(false);
const resolvedTheme = useResolvedTheme();
const monacoTheme = resolvedTheme === "dark" ? "vs-dark" : "vs";

useEffect(() => {
    let isCancelled = false;
    ensureMonacoSqlLoaded()
      .then(() => { if (!isCancelled) setIsMonacoReady(true); })
      .catch(() => { if (!isCancelled) setIsMonacoReady(true); });
    return () => { isCancelled = true; };
}, []);
```

**Editor options pattern** (lines 36-62):
```typescript
const options = useMemo<editor.IStandaloneEditorConstructionOptions>(
    () => ({
      readOnly: true,
      domReadOnly: true,
      minimap: { enabled: false },
      lineNumbers: "on",
      lineNumbersMinChars: 3,
      folding: false,
      glyphMargin: false,
      scrollBeyondLastLine: false,
      wordWrap: "on",
      automaticLayout: true,
      fontSize: 12,
      lineHeight: LINE_HEIGHT,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
      overviewRulerLanes: 0,
      renderLineHighlight: "none",
      contextmenu: false,
      padding: { top: 12, bottom: 12 },
      scrollbar: { alwaysConsumeMouseWheel: false },
    }),
    []
);
```

**Editor render pattern** (lines 78-95):
```typescript
<div className="rounded-lg overflow-hidden" style={{ height: editorHeight, maxHeight }}>
    {isMonacoReady ? (
      <Editor
        language="sql"
        value={code}
        theme={monacoTheme}
        options={options}
        width="100%"
        height="100%"
      />
    ) : (
      <pre className="h-full m-0 p-3 overflow-auto bg-muted text-foreground text-xs font-mono leading-5">
        {code}
      </pre>
    )}
</div>
```

Changes for XML source view: use `ensureMonacoXmlLoaded`, `language="xml"`, enable `folding: true` (D-06), fill full height instead of auto-sizing, key by active tab ID to avoid memory leaks (Pitfall 2). Accept `scrollPosition` and `onScrollChange` props for scroll persistence (Pitfall 3).

---

### `src/features/explorer/components/file-tab-bar.tsx` (component, event-driven) -- NEW

**Analog:** `src/features/explorer/components/folder-tree-node.tsx` -- lines 239-285 (row layout + context menu pattern)

Also reference `src/features/explorer/components/explorer-sidebar.tsx` -- lines 52-127 (header bar layout with buttons)

**Layout with store selector pattern** (from `explorer-sidebar.tsx` lines 17-40):
```typescript
export function ExplorerSidebar() {
  const { sidebarOpen, sidebarWidth, setSidebarOpen, /* ... */ } = useExplorerStore(
    useShallow((state) => ({
      sidebarOpen: state.sidebarOpen,
      // ...
    }))
  );
```

**Icon button pattern** (from `explorer-sidebar.tsx` lines 92-99):
```typescript
<Button variant="ghost" size="icon" className="h-7 w-7"
    onClick={() => setSidebarOpen(false)} title="Close sidebar">
  <PanelLeftClose className="h-4 w-4" />
</Button>
```

Custom tab bar (not shadcn Tabs). Horizontally scrollable container of `FileTab` components. Store selects `tabs`, `activeTabId`, `setActiveTab`, `closeTab`.

---

### `src/features/explorer/components/file-tab.tsx` (component, event-driven) -- NEW

**Analog:** `src/features/explorer/components/folder-tree-node.tsx` -- lines 239-285

**Row content + context menu pattern** (lines 260-283):
```typescript
<ContextMenu>
  <ContextMenuTrigger asChild>{rowContent}</ContextMenuTrigger>
  <ContextMenuContent>
    <ContextMenuItem onClick={() => /* action */}>
      Menu Item Label
    </ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
```

**Tooltip pattern** (lines 272-280):
```typescript
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>{rowContent}</TooltipTrigger>
    <TooltipContent>
      <p>Full path tooltip text</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

Each tab shows filename (with disambiguator if needed), tooltip with full path, close button (X icon), and right-click context menu with file actions.

---

### `src/features/explorer/components/file-content-area.tsx` (component, request-response) -- NEW

**Analog:** `src/features/explorer/components/explorer-shell.tsx` -- lines 13-36

**Conditional rendering with store state pattern** (lines 14-36):
```typescript
const { sidebarOpen, setSidebarOpen } = useExplorerStore(
    useShallow((state) => ({ /* selectors */ }))
);

return (
    <div className="flex flex-col h-screen">
      {/* conditional rendering based on state */}
    </div>
);
```

Container component: renders `FileContentHeader` + either `XmlSourceView` or `XmlTreeView` based on active tab's `viewMode`. Selects active tab from store.

---

### `src/features/explorer/components/file-content-header.tsx` (component, event-driven) -- NEW

**Analog:** `src/features/explorer/components/explorer-sidebar.tsx` -- lines 66-112 (header section)

**Header bar layout pattern** (lines 66-112):
```typescript
<div className="flex-shrink-0 border-b p-3">
  <div className="flex items-center justify-between mb-2">
    <h2 className="text-sm font-semibold">Explorer</h2>
    <div className="flex items-center gap-1">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleDateSort}>
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent><p>Sort: {/* ... */}</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  </div>
</div>
```

Adapt: left side shows filename + file size (muted), center-right has source/tree toggle (segmented control or toggle group), right has action icon buttons (copy path, copy content). The toggle is hidden for non-XML files (D-03).

---

### `src/features/explorer/components/xml-tree-view.tsx` (component, transform) -- NEW

**Analog:** `src/features/explorer/components/folder-tree-node.tsx` -- lines 44-258 (tree node rendering + expand/collapse)

**Collapsible tree pattern** (lines 70-77):
```typescript
const handleToggle = () => {
    if (node.type === "file") return;
    if (isExpanded) {
      onCollapse(node.id);
    } else {
      onExpand(node.id);
    }
};
```

**Depth-based indentation pattern** (lines 247-249):
```typescript
style={{ paddingLeft: `${depth * 16}px` }}
```

**Icon rendering by node type pattern** (lines 108-137):
```typescript
const renderIcon = () => {
    if (isSource) { /* ... */ return <FolderSync />; }
    if (isClient || isDate) { /* folder icons */ }
    if (isFile) {
      const isXml = node.name.toLowerCase().endsWith(".xml");
      if (isXml) return <FileCode />;
      return <FileText />;
    }
};
```

Tree view manages its own expand/collapse state locally (not in Zustand -- D-08 says tree starts collapsed). Parses XML via `xml-parser.ts` utility on first render. Recursively renders `XmlTreeNode` components with depth indentation.

---

### `src/features/explorer/components/xml-tree-node.tsx` (component, transform) -- NEW

**Analog:** `src/features/explorer/components/folder-tree-node.tsx` -- lines 44-258

**Row with chevron + icon + label pattern** (lines 239-257):
```typescript
<div className={cn("group flex items-center gap-1 w-full rounded", rowPadding)}
    style={{ paddingLeft: `${depth * 16}px` }}
    onClick={handleToggle}>
  {renderChevron()}
  {renderIcon()}
  {renderName()}
</div>
```

Each XML node type (element, text, comment, PI, CDATA) gets distinct styling. Elements show `tagName` + inline attributes. Text nodes are leaf nodes. Comments show in italic/muted. Uses same `cn()` utility for conditional classes.

---

### `src/features/explorer/hooks/use-file-actions.ts` (hook, request-response) -- NEW

**Analog:** `src/features/export/hooks/useExport.ts` -- lines 1-124

**Import pattern** (lines 1-8):
```typescript
import { useState, useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import { useSchemaStore } from "@/features/schema-graph/store";
import { useShallow } from "zustand/shallow";
import { exportService } from "../services/export-service";
```

**Action with loading/error state pattern** (lines 22-46):
```typescript
const exportPng = useCallback(async () => {
    if (!schema) return null;
    setIsExporting(true);
    setError(null);
    try {
      // ... perform action ...
      return savedPath;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
      return null;
    } finally {
      setIsExporting(false);
    }
}, [schema, connectionInfo, getNodes]);
```

**Return object pattern** (lines 117-124):
```typescript
return {
    isExporting,
    error,
    exportPng,
    exportPdf,
    exportJson,
};
```

Also reference `src/features/canvas/services/canvas-file-service.ts` for save dialog pattern (lines 1-62):

**Save dialog + writeFile pattern** (lines 11-45):
```typescript
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

const path = await save({
    defaultPath: "schema.monocle.json",
    filters: [FILE_FILTER],
});
if (!path) return null;

const encoder = new TextEncoder();
await writeFile(path, encoder.encode(JSON.stringify(data, null, 2)));
return path;
```

Hook exposes: `copyPath(filePath)`, `copyContent(content)`, `openExternal(filePath)`, `saveCopy(fileName, content)`. Uses `@tauri-apps/plugin-clipboard-manager` writeText, `@tauri-apps/plugin-opener` openPath, and dialog+fs save pattern from canvas-file-service.

---

### `src/features/explorer/utils/xml-parser.ts` (utility, transform) -- NEW

**Analog:** `src/features/explorer/utils/tree-filter.ts` -- lines 1-28

**Utility function pattern** (lines 1-28):
```typescript
import type { TreeNode } from "../types";

export function filterTreeNodes(nodes: TreeNode[], filter: string): TreeNode[] {
  if (!filter || !filter.trim()) {
    return nodes;
  }
  // ... pure function, no side effects ...
}
```

Pure function: takes string content, returns parsed result with document and error. No imports from services or store. Uses browser DOMParser API. Checks for `<parsererror>` element to detect failures.

---

### `src/features/explorer/utils/file-size-format.ts` (utility, transform) -- NEW

**Analog:** `src/features/explorer/utils/date-format.ts` -- lines 1-40

**Simple utility function pattern** (lines 1-40):
```typescript
export function formatDateFolder(rawName: string): {
  raw: string;
  formatted: string | null;
} {
  if (!/^\d{8}$/.test(rawName)) {
    return { raw: rawName, formatted: null };
  }
  // ... pure formatting logic ...
}
```

Same pattern: export a single pure function, no imports needed, clear return type.

---

### `src/features/explorer/utils/tab-disambiguator.ts` (utility, transform) -- NEW

**Analog:** `src/features/explorer/utils/tree-filter.ts` -- lines 1-28

Same pure function pattern. Takes array of tabs, returns Map of filePath to display name. No store or service dependencies.

---

## Shared Patterns

### Store Selector with useShallow
**Source:** used throughout all explorer components
**Apply to:** All new components that read from store (`file-tab-bar.tsx`, `file-content-area.tsx`, `file-content-header.tsx`, `xml-source-view.tsx`, `xml-tree-view.tsx`)
```typescript
import { useShallow } from "zustand/shallow";
import { useExplorerStore } from "../store";

const { tabs, activeTabId } = useExplorerStore(
    useShallow((state) => ({
      tabs: state.tabs,
      activeTabId: state.activeTabId,
    }))
);
```

### Tauri IPC Pipeline (end-to-end)
**Source:** `src-tauri/src/commands/explorer.rs` -> `src-tauri/src/commands/mod.rs` -> `src-tauri/src/lib.rs` -> `src/services/tauri.ts` -> `src/features/explorer/services/explorer-service.ts` -> `src/features/explorer/store.ts`
**Apply to:** `read_file_cmd` follows the exact same pipeline as `list_directory_cmd`

Steps:
1. Rust command in `commands/explorer.rs` with `#[tauri::command]` and `Result<T, String>` return
2. Export in `commands/mod.rs` via `pub use explorer::{ ..., read_file_cmd }`
3. Register in `lib.rs` `generate_handler!` and import
4. Add typed wrapper in `tauri.ts` using `invokeCommand<FileContent>("read_file_cmd", { path })`
5. Add service method in `explorer-service.ts` that delegates to `tauri.readFile(path)`
6. Store action calls service, updates state

### Context Menu on Components
**Source:** `src/features/explorer/components/folder-tree-node.tsx` lines 261-283
**Apply to:** `file-tab.tsx`, `folder-tree-node.tsx` (file rows)
```typescript
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

<ContextMenu>
  <ContextMenuTrigger asChild>{rowContent}</ContextMenuTrigger>
  <ContextMenuContent>
    <ContextMenuItem onClick={() => onCopyPath()}>Copy Path</ContextMenuItem>
    <ContextMenuItem onClick={() => onOpenExternal()}>Open in External Editor</ContextMenuItem>
    <ContextMenuItem onClick={() => onCopyContent()}>Copy Content</ContextMenuItem>
    <ContextMenuItem onClick={() => onSaveCopy()}>Save a Copy</ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
```

### Tooltip on Hover
**Source:** `src/features/explorer/components/folder-tree-node.tsx` lines 272-280
**Apply to:** `file-tab.tsx` (full path tooltip on tab), `file-content-header.tsx` (action button labels)
```typescript
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>{element}</TooltipTrigger>
    <TooltipContent><p>{tooltipText}</p></TooltipContent>
  </Tooltip>
</TooltipProvider>
```

### Test File Structure
**Source:** `src/features/explorer/utils/date-format.test.ts` lines 1-46
**Apply to:** `xml-parser.test.ts`, `file-size-format.test.ts`, `tab-disambiguator.test.ts`
```typescript
import { describe, it, expect } from "vitest";
import { functionUnderTest } from "./module-name";

describe("functionUnderTest", () => {
  it("describes expected behavior", () => {
    const result = functionUnderTest(input);
    expect(result.property).toBe(expectedValue);
  });

  it("handles edge case", () => {
    const result = functionUnderTest(edgeInput);
    expect(result.property).toBeNull();
  });
});
```

### Store Test Pattern
**Source:** `src/features/explorer/store-integration.test.ts` lines 1-101
**Apply to:** tab management tests (open, close, switch, no duplicates, view mode)
```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/explorer/services/explorer-service", () => ({
  explorerService: {
    readFile: vi.fn(),
    listDirectory: vi.fn(),
  },
}));

describe("tab management", () => {
  beforeEach(() => {
    // Reset store state
    vi.clearAllMocks();
  });

  it("opens a file and creates a tab", () => {
    // ... test ...
  });
});
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| -- | -- | -- | All files have analogs in the existing codebase |

Every new file has either an exact or role-match analog. The codebase already contains patterns for every component type needed in Phase 3: Monaco editor usage, tree rendering, context menus, store actions with async service calls, Rust commands with timeout, utility functions, and tests.

## Metadata

**Analog search scope:** `src/features/explorer/`, `src/features/schema-graph/components/`, `src/features/canvas/services/`, `src/features/export/hooks/`, `src/lib/`, `src/services/`, `src-tauri/src/commands/`, `src-tauri/src/lib.rs`, `src-tauri/capabilities/`
**Files scanned:** ~30 files read across analog search
**Pattern extraction date:** 2026-05-26
