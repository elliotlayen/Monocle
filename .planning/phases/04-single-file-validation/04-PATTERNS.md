# Phase 4: Single-File Validation - Pattern Map

**Mapped:** 2026-05-26
**Files analyzed:** 15 (7 new, 8 modified)
**Analogs found:** 15 / 15

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src-tauri/src/validation/mod.rs` | config (module) | N/A | `src-tauri/src/db/mod.rs` | exact |
| `src-tauri/src/validation/validator.rs` | service | transform | `src-tauri/src/db/schema_loader.rs` | role-match |
| `src-tauri/src/validation/encoding.rs` | service | transform | `src-tauri/src/db/schema_loader.rs` | role-match |
| `src/features/explorer/components/problems-panel.tsx` | component | request-response | `src/features/explorer/components/file-content-header.tsx` | role-match |
| `src/features/explorer/components/problem-row.tsx` | component | request-response | `src/features/explorer/components/xml-tree-node.tsx` | role-match |
| `src/features/explorer/components/validation-status-bar.tsx` | component | request-response | `src/features/explorer/components/file-content-header.tsx` | exact |
| `src/features/explorer/hooks/use-validation-decorations.ts` | hook | transform | `src/features/explorer/hooks/use-explorer-sidebar.ts` | role-match |
| `src-tauri/src/commands/explorer.rs` (modify) | controller | request-response | self (existing `read_file_cmd`) | exact |
| `src-tauri/src/commands/mod.rs` (modify) | config (module) | N/A | self | exact |
| `src/features/explorer/types.ts` (modify) | model | N/A | self (existing `FileContent`, `FileTab`) | exact |
| `src/features/explorer/store.ts` (modify) | store | CRUD | self (existing `openFile` action) | exact |
| `src/features/explorer/services/explorer-service.ts` (modify) | service | request-response | self (existing `readFile`) | exact |
| `src/services/tauri.ts` (modify) | service | request-response | self (existing `readFile` entry) | exact |
| `src/features/explorer/components/file-content-area.tsx` (modify) | component | request-response | self + `src/features/explorer/components/explorer-sidebar.tsx` | exact |
| `src/features/explorer/components/xml-source-view.tsx` (modify) | component | transform | self (existing `handleEditorMount`) | exact |
| `src/features/explorer/components/folder-tree-node.tsx` (modify) | component | request-response | self (existing `renderBadge`) | exact |

## Pattern Assignments

### `src-tauri/src/validation/mod.rs` (config/module, N/A)

**Analog:** `src-tauri/src/db/mod.rs`

**Module declaration pattern** (lines 1-7):
```rust
pub mod connection;
pub mod queries;
pub mod schema_loader;
pub mod ssrp;

pub use connection::{create_client, create_server_client, ConnectionError};
pub use queries::*;
pub use schema_loader::*;
```

Apply: Declare `pub mod validator;` and `pub mod encoding;`, then re-export key functions (`pub use validator::validate_characters;` and `pub use encoding::detect_and_decode;`).

---

### `src-tauri/src/validation/validator.rs` (service, transform)

**Analog:** `src-tauri/src/db/schema_loader.rs` (lines 1-35)

**Imports and struct pattern** (lines 1-18):
```rust
use std::collections::{HashMap, HashSet};

use futures_util::TryStreamExt;
use once_cell::sync::Lazy;
use regex::Regex;
// ... crate imports ...

use crate::types::{
    Column, ColumnSource, ConnectionParams, ProcedureParameter, RelationshipEdge, ScalarFunction,
    SchemaGraph, StoredProcedure, TableNode, Trigger, ViewNode,
};
```

Apply: Import from sibling module (`use super::encoding::DecodeResult;`), use `crate::commands::explorer::ValidationProblem` or define problem structs here.

**Error type pattern** (lines 20-35):
```rust
#[derive(Debug, thiserror::Error)]
pub enum SchemaError {
    #[error("Connection error: {0}")]
    Connection(#[from] ConnectionError),
    #[error("Database error: {0}")]
    Tiberius(#[from] tiberius::error::Error),
}

impl serde::Serialize for SchemaError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}
```

Apply: The validator returns data (Vec<ValidationProblem>), not errors. Validation issues are not command failures -- they are part of the response (per D-05). No custom error type needed for the validator itself.

**Function signature pattern** (line 37):
```rust
pub async fn load_schema(params: &ConnectionParams) -> Result<SchemaGraph, SchemaError> {
```

Apply: `pub fn validate_characters(content: &str, had_decode_errors: bool) -> Vec<ValidationProblem>` -- synchronous, pure function operating on the transcoded UTF-8 string.

---

### `src-tauri/src/validation/encoding.rs` (service, transform)

**Analog:** `src-tauri/src/db/schema_loader.rs` (same function pattern)

**Struct with serde** -- follows pattern from `src-tauri/src/commands/explorer.rs` (lines 105-110):
```rust
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileContent {
    pub content: String,
    pub size: u64,
}
```

Apply: Define `DecodeResult` struct (not serde-serialized, just internal). The encoding module produces a `DecodeResult { content: String, encoding_name: String, has_bom: bool, had_errors: bool }` consumed by the command, not sent over IPC directly.

---

### `src-tauri/src/commands/explorer.rs` (controller, request-response) -- MODIFY

**Existing `read_file_cmd`** (lines 112-128):
```rust
#[tauri::command]
pub async fn read_file_cmd(path: String) -> Result<FileContent, String> {
    tokio::time::timeout(
        Duration::from_secs(30),
        tokio::task::spawn_blocking(move || {
            let metadata = std::fs::metadata(&path)
                .map_err(|e| format!("Failed to read file '{}': {}", path, e))?;
            let size = metadata.len();
            let content = std::fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read file '{}': {}", path, e))?;
            Ok(FileContent { content, size })
        }),
    )
    .await
    .map_err(|_| "File read timed out after 30 seconds".to_string())?
    .map_err(|e| format!("File read task failed: {}", e))?
}
```

**Existing `FileContent` struct** (lines 105-110):
```rust
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileContent {
    pub content: String,
    pub size: u64,
}
```

Apply: 
1. Extend `FileContent` with `problems: Vec<ValidationProblem>`, `encoding: String`, `has_bom: bool`
2. Add `ValidationProblem` struct with `#[serde(rename_all = "camelCase")]`
3. Replace `std::fs::read_to_string(&path)` with `std::fs::read(&path)` (raw bytes)
4. Pipe through `detect_and_decode()` then `validate_characters()`
5. Same `tokio::time::timeout` + `spawn_blocking` wrapper

**Existing `DirEntry` struct pattern** (lines 13-19) -- shows the serde annotation style:
```rust
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    pub name: String,
    pub is_dir: bool,
    pub path: String,
}
```

---

### `src-tauri/src/commands/mod.rs` (config/module) -- MODIFY

**Existing** (lines 1-16):
```rust
pub mod databases;
pub mod explorer;
pub mod menu;
pub mod mock;
pub mod schema;
pub mod settings;

pub use databases::list_databases_cmd;
pub use explorer::{
    cancel_directory_cmd, check_path_reachable, list_directory_cmd, read_file_cmd,
    toggle_favorite_cmd, ExplorerState,
};
pub use menu::set_menu_ui_state_cmd;
pub use mock::load_schema_mock;
pub use schema::load_schema_cmd;
pub use settings::{get_settings, save_settings};
```

Apply: No changes needed here. The `read_file_cmd` is already exported. The `validation` module is declared in `lib.rs`, not in `commands/mod.rs`.

**`src-tauri/src/lib.rs`** (lines 1-5) -- where `validation` module must be added:
```rust
mod commands;
mod db;
mod menu;
mod state;
mod types;
```

Apply: Add `mod validation;` to lib.rs module declarations.

---

### `src/features/explorer/types.ts` (model) -- MODIFY

**Existing types** (lines 1-51):
```typescript
export interface FileContent {
  content: string;
  size: number;
}

export interface FileTab {
  id: string;
  filePath: string;
  fileName: string;
  content: string;
  fileSize: number;
  viewMode: ViewMode;
  scrollPosition: { source: number; tree: number };
  treeExpandedIds: string[];
  monacoViewState: unknown | null;
  isXml: boolean;
  parseError: boolean;
  isLoading: boolean;
}
```

Apply:
1. Add `ValidationProblem` interface matching Rust struct (line, column, endColumn, message, severity, code)
2. Add `ValidationSeverity` type: `"error" | "warning"`
3. Extend `FileContent` with `problems: ValidationProblem[]`, `encoding: string`, `hasBom: boolean`
4. Extend `FileTab` with `problems: ValidationProblem[]`, `encoding: string`, `hasBom: boolean`

---

### `src/features/explorer/store.ts` (store, CRUD) -- MODIFY

**Existing `openFile` action** (lines 325-397):
```typescript
openFile: async (filePath: string) => {
    const { tabs } = get();

    // Check if tab already exists -- switch to it (D-14)
    const existing = tabs.find((t) => t.filePath === filePath);
    if (existing) {
      set({ activeTabId: existing.id });
      return;
    }

    // Extract filename from path
    const fileName = filePath.split(/[/\\]/).pop() ?? filePath;
    const isXml = /\.xml$/i.test(fileName);

    // Create new tab with loading state
    const newTab: FileTab = {
      id: filePath,
      filePath,
      fileName,
      content: "",
      fileSize: 0,
      viewMode: "source",
      scrollPosition: { source: 0, tree: 0 },
      treeExpandedIds: [],
      monacoViewState: null,
      isXml,
      parseError: false,
      isLoading: true,
    };

    const updatedTabs = recomputeTabNames([...tabs, newTab]);
    set({ tabs: updatedTabs, activeTabId: filePath });

    try {
      const result = await explorerService.readFile(filePath);
      const currentTabs = get().tabs;
      const tabIndex = currentTabs.findIndex((t) => t.id === filePath);
      if (tabIndex === -1) return;

      let parseError = false;
      if (isXml) {
        const parseResult = parseXml(result.content);
        parseError = parseResult.error !== null;
      }

      const updated = [...currentTabs];
      updated[tabIndex] = {
        ...updated[tabIndex],
        content: result.content,
        fileSize: result.size,
        isLoading: false,
        parseError,
        ...(parseError ? { viewMode: "source" as const } : {}),
      };

      set({ tabs: recomputeTabNames(updated) });
    } catch {
      // Remove the failed tab and show error toast
      const currentTabs = get().tabs;
      const filtered = currentTabs.filter((t) => t.id !== filePath);
      const activeTabId =
        filtered.length > 0 ? filtered[filtered.length - 1].id : null;

      set({ tabs: recomputeTabNames(filtered), activeTabId });

      showToast({
        type: "error",
        title: "Failed to read file",
        message: "Check that the file still exists and is accessible",
        duration: 5000,
      });
    }
  },
```

**Store interface pattern** (lines 9-43):
```typescript
interface ExplorerStore {
  // State
  folderSources: FolderSource[];
  treeNodes: Map<string, TreeNode>;
  expandedIds: Set<string>;
  activeOperations: Map<string, string>;
  filterText: string;
  dateSortOrder: "newest" | "oldest";
  sidebarOpen: boolean;
  sidebarWidth: number;
  tabs: FileTab[];
  activeTabId: string | null;

  // Actions
  loadSources: () => Promise<void>;
  expandNode: (nodeId: string) => Promise<void>;
  // ...
}
```

**Store `useShallow` consumer pattern** from `file-content-area.tsx` (lines 13-21):
```typescript
const { tabs, activeTabId, setScrollPosition, setTreeExpandedIds, setMonacoViewState } = useExplorerStore(
    useShallow((state) => ({
      tabs: state.tabs,
      activeTabId: state.activeTabId,
      setScrollPosition: state.setScrollPosition,
      setTreeExpandedIds: state.setTreeExpandedIds,
      setMonacoViewState: state.setMonacoViewState,
    }))
  );
```

Apply:
1. Add to interface: `validationCache: Map<string, { problems: ValidationProblem[]; encoding: string; hasBom: boolean }>`, `problemsPanelOpen: boolean`, `problemsPanelHeight: number`, `pendingJump: { tabId: string; line: number; column: number } | null`
2. Add actions: `toggleProblemsPanel`, `setProblemsPanelHeight`, `jumpToProblem`, `clearPendingJump`
3. In `openFile` success handler: extract `result.problems`, `result.encoding`, `result.hasBom` onto the tab; update `validationCache`; auto-open problems panel if issues found
4. Add helper: `getValidationStatus(filePath)` returning `"error" | "warning" | undefined`

---

### `src/features/explorer/services/explorer-service.ts` (service, request-response) -- MODIFY

**Existing** (lines 1-21):
```typescript
import { tauri } from "@/services/tauri";
import type { DirEntry, FileContent } from "../types";
import type { AppSettings } from "@/features/settings/services/settings-service";

export const explorerService = {
  listDirectory: (path: string, operationId: string): Promise<DirEntry[]> =>
    tauri.listDirectory(path, operationId),

  cancelDirectory: (operationId: string): Promise<void> =>
    tauri.cancelDirectory(operationId),

  checkPathReachable: (path: string): Promise<boolean> =>
    tauri.checkPathReachable(path),

  toggleFavorite: (
    sourceId: string,
    clientName: string
  ): Promise<AppSettings> => tauri.toggleFavorite(sourceId, clientName),

  readFile: (path: string): Promise<FileContent> => tauri.readFile(path),
};
```

Apply: No code changes needed in the service file. The `FileContent` type import already points to `../types` where it will be extended. The `readFile` method signature stays the same -- the return type just gains additional fields from the extended `FileContent` interface.

---

### `src/services/tauri.ts` (service, request-response) -- MODIFY

**Existing `readFile` entry** (lines 60-61):
```typescript
  readFile: (path: string) =>
    invokeCommand<FileContent>("read_file_cmd", { path }),
```

Apply: No code changes needed. The `FileContent` import from `@/features/explorer/types` will automatically pick up the extended interface.

---

### `src/features/explorer/components/problems-panel.tsx` (component, request-response) -- NEW

**Analog:** `src/features/explorer/components/file-content-header.tsx`

**Imports pattern** (lines 1-14):
```typescript
import { FileCode, FileText, TreePine, Code, Copy, ClipboardCopy, ChevronsDownUp, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useExplorerStore } from "../store";
import { useFileActions } from "../hooks/use-file-actions";
import { formatFileSize } from "../utils/file-size-format";
import type { FileTab } from "../types";
```

**Component structure pattern** (lines 22-153):
```typescript
interface FileContentHeaderProps {
  tab: FileTab;
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
}

export function FileContentHeader({ tab, onExpandAll, onCollapseAll }: FileContentHeaderProps) {
  // ... component body ...
  return (
    <div className="flex items-center gap-2 px-4 h-10 border-b bg-muted/50">
      {/* structured sections */}
    </div>
  );
}
```

Apply: Create `ProblemsPanel` as a presentational component with props `problems: ValidationProblem[]`, `onProblemClick: (line, column) => void`, `isOpen: boolean`, `onToggle: () => void`, `height: number`. Use shadcn/ui `ScrollArea` for the list. lucide-react icons for severity indicators (`CircleAlert` for errors, `TriangleAlert` for warnings). The panel header shows "Problems (N)" with expand/collapse.

---

### `src/features/explorer/components/problem-row.tsx` (component, request-response) -- NEW

**Analog:** `src/features/explorer/components/xml-tree-node.tsx`

**Row component pattern** -- follows the tree node style of a single clickable row. Reference the `folder-tree-node.tsx` row content pattern (lines 245-263):
```typescript
  const rowContent = (
    <div
      className={cn(
        "group flex items-center gap-1 w-full rounded",
        rowPadding,
        !isFile && "hover:bg-muted cursor-pointer",
        isFile && "hover:bg-muted cursor-pointer",
        isError && "text-muted-foreground opacity-60"
      )}
      style={{ paddingLeft: `${depth * 16}px` }}
      onClick={isFile ? () => onFileClick(node.path) : handleToggle}
    >
      {renderChevron()}
      {renderIcon()}
      {renderName()}
      {renderBadge()}
      {renderLoadingInfo()}
      {renderStar()}
    </div>
  );
```

Apply: Create `ProblemRow` as a simple clickable row: severity icon (colored), "Ln {line}, Col {col}" location text (monospace, clickable), description message, problem code badge. Use `cn()` for conditional classes, `cursor-pointer`, `hover:bg-muted`.

---

### `src/features/explorer/components/validation-status-bar.tsx` (component, request-response) -- NEW

**Analog:** `src/features/explorer/components/file-content-header.tsx` (the thin horizontal bar pattern)

**Bar layout pattern** (lines 37-45):
```typescript
  return (
    <div className="flex items-center gap-2 px-4 h-10 border-b bg-muted/50">
      {/* Left section */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {fileIcon}
        <span className="text-sm font-semibold truncate">{tab.fileName}</span>
        <span className="text-xs text-muted-foreground flex-shrink-0 ml-1">
          {fileSizeDisplay}
        </span>
      </div>
```

Apply: Create `ValidationStatusBar` as a thin bar (h-6 or h-7) at the bottom of the content area. Left side: "N errors, N warnings" with colored icons. Right side: encoding name. Entire bar clickable (onClick toggles problems panel). Use `border-t` instead of `border-b` since it sits at the bottom. Props: `errorCount`, `warningCount`, `encoding`, `onClick`.

---

### `src/features/explorer/hooks/use-validation-decorations.ts` (hook, transform) -- NEW

**Analog:** `src/features/explorer/hooks/use-explorer-sidebar.ts`

**Hook structure pattern** (lines 1-63):
```typescript
import { useState, useEffect, useCallback, useRef } from "react";

interface UseExplorerSidebarResult {
  width: number;
  isDragging: boolean;
  startDrag: (e: React.MouseEvent) => void;
}

export function useExplorerSidebar(
  initialWidth: number,
  onWidthCommit: (width: number) => void
): UseExplorerSidebarResult {
  const [width, setWidth] = useState(initialWidth);
  // ... refs, effects, callbacks ...
  return { width, isDragging, startDrag };
}
```

Apply: Create `useValidationDecorations(editorRef, problems)` hook that:
1. Takes `editor.IStandaloneCodeEditor | null` ref and `ValidationProblem[]`
2. Returns nothing (side-effect only hook)
3. Uses `useEffect` to call `editorInstance.createDecorationsCollection(decorations)` when problems change
4. Stores the `IEditorDecorationsCollection` ref to `.set([])` on cleanup or problem changes
5. Maps each problem to `IModelDeltaDecoration` with `glyphMarginClassName`, `className`, `overviewRuler`, `hoverMessage`

**Monaco editor ref pattern** from `xml-source-view.tsx` (lines 31, 108-119):
```typescript
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);

  const handleEditorMount: OnMount = (editorInstance) => {
    editorRef.current = editorInstance;

    if (savedViewStateRef.current) {
      editorInstance.restoreViewState(savedViewStateRef.current as editor.ICodeEditorViewState);
    } else {
      editorInstance.setScrollTop(scrollPositionRef.current);
    }

    editorInstance.onDidScrollChange((e) => {
      onScrollChange(e.scrollTop);
    });
  };
```

---

### `src/features/explorer/components/file-content-area.tsx` (component) -- MODIFY

**Existing layout** (lines 59-104):
```typescript
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <FileContentHeader
        tab={activeTab}
        onExpandAll={...}
        onCollapseAll={...}
      />
      {showParseErrorBanner && (
        <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 ...">
          ...
        </div>
      )}
      {activeTab.isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          ...loading skeleton...
        </div>
      ) : showTreeView ? (
        <XmlTreeView ... />
      ) : (
        <XmlSourceView ... />
      )}
    </div>
  );
```

**Drag resize analog** from `use-explorer-sidebar.ts` (lines 28-60):
```typescript
  const startDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    startXRef.current = e.clientX;
    startWidthRef.current = widthRef.current;
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startXRef.current;
      const newWidth = Math.max(200, Math.min(480, startWidthRef.current + delta));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setWidth((currentWidth) => {
        onWidthCommit(currentWidth);
        return currentWidth;
      });
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, onWidthCommit]);
```

Apply: Add `ProblemsPanel` between the source/tree view and the new `ValidationStatusBar`. Use vertical drag resize (Y-axis instead of X-axis) adapting the sidebar drag pattern: `e.clientY` instead of `e.clientX`, track height instead of width, min 80px / max 400px. Layout becomes:
```
<div flex-col flex-1>
  <FileContentHeader />
  {parseErrorBanner}
  <div flex-col flex-1>        <!-- inner container for source+panel -->
    <div flex-1>               <!-- source or tree view -->
      <XmlSourceView /> or <XmlTreeView />
    </div>
    {problemsPanelOpen && <ProblemsPanel />}
  </div>
  <ValidationStatusBar />
</div>
```

---

### `src/features/explorer/components/xml-source-view.tsx` (component) -- MODIFY

**Existing editor options** (lines 80-106):
```typescript
  const options = useMemo<editor.IStandaloneEditorConstructionOptions>(
    () => ({
      readOnly: true,
      domReadOnly: true,
      minimap: { enabled: false },
      lineNumbers: "on",
      lineNumbersMinChars: 3,
      folding: true,
      glyphMargin: false,
      scrollBeyondLastLine: false,
      wordWrap: "on",
      automaticLayout: true,
      fontSize: 13,
      lineHeight: 20,
      // ...
      overviewRulerLanes: 0,
      // ...
    }),
    []
  );
```

Apply:
1. Change `glyphMargin: false` to `glyphMargin: true` (enables gutter icons for validation markers)
2. Change `overviewRulerLanes: 0` to `overviewRulerLanes: 2` (enables scrollbar overview markers)
3. Add `problems` prop to component interface
4. Add `pendingJump` prop for click-to-jump support
5. Use `useValidationDecorations(editorRef.current, problems)` hook
6. Add effect to handle `pendingJump`: call `editorInstance.setPosition()` and `editorInstance.revealLineInCenterIfOutsideViewport()`

**Existing forwardRef pattern** (lines 22-30):
```typescript
export const XmlSourceView = forwardRef<XmlSourceViewHandle, XmlSourceViewProps>(function XmlSourceView({
  content,
  isXml,
  tabId,
  scrollPosition,
  onScrollChange,
  savedViewState,
  onViewStateChange,
}, ref) {
```

---

### `src/features/explorer/components/folder-tree-node.tsx` (component) -- MODIFY

**Existing `renderBadge` function** (lines 173-194):
```typescript
  const renderBadge = () => {
    if (isSource && node.type === "source") {
      return null;
    }

    if ((isClient || isDate) && node.childCount !== undefined) {
      return (
        <span className="text-xs text-muted-foreground flex-shrink-0">
          {node.childCount}
        </span>
      );
    }

    return null;
  };
```

**Existing Badge import** (line 16):
```typescript
import { Badge } from "@/components/ui/badge";
```

**Existing file icon rendering** (lines 132-141):
```typescript
    if (isFile) {
      const isXml = node.name.toLowerCase().endsWith(".xml");
      if (isXml) {
        return <FileCode className="h-3.5 w-3.5 flex-shrink-0" />;
      }
      return (
        <FileText className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
      );
    }
```

Apply: Extend `renderBadge()` to add a validation dot badge for file nodes. Read validation status from the store's `validationCache` using `useExplorerStore.getState().validationCache.get(node.path)`. Render a small colored dot (red for errors, yellow for warnings-only) as a `<span>` with `rounded-full w-2 h-2 flex-shrink-0` and appropriate background color class.

Note: The component already calls `useExplorerStore.getState()` directly (line 268-271), so accessing the validation cache follows the established pattern:
```typescript
  const isFileOpenInTab = isFile
    ? useExplorerStore.getState().tabs.some((t) => t.id === node.path)
    : false;
```

---

## Shared Patterns

### Serde Serialization (Rust)
**Source:** `src-tauri/src/commands/explorer.rs` lines 105-110, 13-19
**Apply to:** `FileContent` (extended), `ValidationProblem` (new)
```rust
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileContent {
    pub content: String,
    pub size: u64,
}
```
All Rust types serialized to frontend use `#[serde(rename_all = "camelCase")]` to match TypeScript naming conventions.

### Tauri Command Pattern (Rust)
**Source:** `src-tauri/src/commands/explorer.rs` lines 112-128
**Apply to:** Extended `read_file_cmd`
```rust
#[tauri::command]
pub async fn read_file_cmd(path: String) -> Result<FileContent, String> {
    tokio::time::timeout(
        Duration::from_secs(30),
        tokio::task::spawn_blocking(move || {
            // ... sync file I/O ...
            Ok(FileContent { ... })
        }),
    )
    .await
    .map_err(|_| "File read timed out after 30 seconds".to_string())?
    .map_err(|e| format!("File read task failed: {}", e))?
}
```
Pattern: `#[tauri::command]` + `async` + `tokio::time::timeout` + `spawn_blocking` for file I/O. Return `Result<T, String>` where `String` is the error type for Tauri commands.

### Zustand Store Extension
**Source:** `src/features/explorer/store.ts` lines 9-43, 101-113
**Apply to:** Store interface and initial state for validation cache, panel state
```typescript
interface ExplorerStore {
  // State
  folderSources: FolderSource[];
  // ...
  tabs: FileTab[];
  activeTabId: string | null;

  // Actions
  loadSources: () => Promise<void>;
  // ...
}

export const useExplorerStore = create<ExplorerStore>((set, get) => ({
  // Initial state
  folderSources: [],
  treeNodes: new Map(),
  // ...
}));
```
Pattern: Interface defines state + actions, `create<T>((set, get) => ({...}))` provides initial values and action implementations.

### useShallow Store Selector
**Source:** `src/features/explorer/components/file-content-area.tsx` lines 13-21
**Apply to:** All new components reading from the store
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

### Component File Structure
**Source:** `src/features/explorer/components/file-content-header.tsx` lines 1-14, 22-26
**Apply to:** All new components
```typescript
import { Icon1, Icon2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useExplorerStore } from "../store";
import type { SomeType } from "../types";

interface ComponentProps {
  // typed props
}

export function Component({ prop1, prop2 }: ComponentProps) {
  // ...
}
```
Pattern: lucide-react icons, shadcn/ui components, `@/` path aliases, named exports (not default), explicit interface for props.

### Hook File Structure
**Source:** `src/features/explorer/hooks/use-explorer-sidebar.ts` lines 1-5, 9-12
**Apply to:** `use-validation-decorations.ts`
```typescript
import { useState, useEffect, useCallback, useRef } from "react";

interface UseHookResult {
  // return type
}

export function useHookName(
  param1: Type1,
  param2: Type2
): UseHookResult {
  // ...
  return { ... };
}
```

### Drag Resize Pattern
**Source:** `src/features/explorer/hooks/use-explorer-sidebar.ts` lines 28-60
**Apply to:** Problems panel vertical resize in `file-content-area.tsx`
Key elements: `e.preventDefault()` on mousedown, refs for start position + start dimension, `Math.max/Math.min` for bounds, attach `mousemove`/`mouseup` to `document`, cleanup on unmount.

### Test File Structure
**Source:** `src/features/explorer/utils/xml-parser.test.ts` lines 1-5
**Apply to:** Any new test files
```typescript
// @vitest-environment jsdom   (only if DOM APIs needed)
import { describe, it, expect } from "vitest";
import { functionUnderTest } from "./module";

describe("functionUnderTest", () => {
  it("describes expected behavior", () => {
    const result = functionUnderTest(input);
    expect(result).toEqual(expected);
  });
});
```

### Rust Module Declaration Pattern
**Source:** `src-tauri/src/db/mod.rs` lines 1-7, `src-tauri/src/lib.rs` lines 1-5
**Apply to:** `src-tauri/src/validation/mod.rs`, `src-tauri/src/lib.rs`
```rust
// mod.rs
pub mod submodule1;
pub mod submodule2;

pub use submodule1::public_function;
pub use submodule2::AnotherPublicItem;
```
```rust
// lib.rs
mod commands;
mod db;
mod validation;  // add new module here
```

### Cargo.toml Dependency Style
**Source:** `src-tauri/Cargo.toml` lines 17-34
**Apply to:** Adding `encoding_rs` and `chardetng`
```toml
[dependencies]
serde = { version = "1", features = ["derive"] }
serde_json = "1"
thiserror = "1"
regex = "1"
once_cell = "1"
```
Pattern: Short version strings (e.g., `"1"`, `"0.8"`), features specified inline. Add:
```toml
encoding_rs = "0.8"
chardetng = "1.0"
```

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | -- | -- | All files have analogs in the existing codebase |

Every new file maps to at least a role-match analog. The closest "gap" is the validation engine itself (`validator.rs`, `encoding.rs`) which has no direct precedent in the codebase, but the Rust module and function patterns from `db/schema_loader.rs` provide sufficient structural guidance. The validation logic itself is well-specified in RESEARCH.md Pattern 2 (encoding pipeline) and the XML 1.0 character range reference.

## Metadata

**Analog search scope:** `src-tauri/src/`, `src/features/explorer/`, `src/services/`, `src/hooks/`
**Files scanned:** 22 (read directly)
**Pattern extraction date:** 2026-05-26
