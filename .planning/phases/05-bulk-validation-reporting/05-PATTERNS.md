# Phase 5: Bulk Validation & Reporting - Pattern Map

**Mapped:** 2026-05-27
**Files analyzed:** 17 (10 new, 7 modified)
**Analogs found:** 17 / 17

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src-tauri/src/commands/explorer.rs` (modify) | command | streaming + CRUD | self (`list_directory_cmd`, `read_file_cmd`) | exact |
| `src-tauri/src/commands/mod.rs` (modify) | config | -- | self | exact |
| `src-tauri/src/lib.rs` (modify) | config | -- | self | exact |
| `src/features/explorer/types.ts` (modify) | model | -- | self | exact |
| `src/features/explorer/store.ts` (modify) | store | event-driven | self (`validationCache`, `openFile`) | exact |
| `src/features/explorer/services/explorer-service.ts` (modify) | service | request-response | self | exact |
| `src/services/tauri.ts` (modify) | service | request-response | self (Explorer commands section) | exact |
| `src/services/events.ts` (modify) | utility | event-driven | self (`createEventHub` instances) | exact |
| `src/features/explorer/components/scan-progress-panel.tsx` (new) | component | event-driven | `problems-panel.tsx` | role-match |
| `src/features/explorer/components/scan-results-tab.tsx` (new) | component | CRUD | `file-content-area.tsx` + `problems-panel.tsx` | role-match |
| `src/features/explorer/components/scan-results-header.tsx` (new) | component | request-response | `file-content-header.tsx` + `export-button.tsx` | role-match |
| `src/features/explorer/components/scan-file-row.tsx` (new) | component | CRUD | `problem-row.tsx` + `folder-tree-node.tsx` | role-match |
| `src/features/explorer/hooks/use-scan.ts` (new) | hook | event-driven | `useExport` + `use-file-actions.ts` | role-match |
| `src/features/explorer/utils/scan-csv-export.ts` (new) | utility | transform | `json-export.ts` | role-match |
| `src/features/explorer/utils/scan-pdf-export.ts` (new) | utility | transform | `pdf-export.ts` | exact |
| `src/features/explorer/utils/scan-json-export.ts` (new) | utility | transform | `json-export.ts` | exact |
| `src/features/explorer/utils/scan-clipboard-export.ts` (new) | utility | transform | `json-export.ts` + `use-file-actions.ts` | role-match |
| `src/features/explorer/utils/badge-aggregation.ts` (new) | utility | transform | `store.ts` (`getValidationStatus`) | role-match |

## Pattern Assignments

### `src-tauri/src/commands/explorer.rs` (command, streaming + CRUD) -- MODIFY

**Analog:** Self -- existing `list_directory_cmd` and `read_file_cmd` in this file

**Imports pattern** (lines 1-9):
```rust
use crate::state::{AppSettings, AppState};
use crate::validation::{detect_and_decode, validate_characters};
use crate::validation::validator::ValidationProblem;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;
use tauri::State;
use tokio_util::sync::CancellationToken;
```
New imports to add:
```rust
use tauri::{AppHandle, Emitter, State};
// walkdir and glob after adding to Cargo.toml
use walkdir::WalkDir;
use glob::Pattern;
```

**CancellationToken + ExplorerState pattern** (lines 11-13, 29-38):
```rust
pub struct ExplorerState {
    pub active_listings: Mutex<HashMap<String, CancellationToken>>,
}

// Inside command: store token for cancellation
let cancel_token = CancellationToken::new();
let token_clone = cancel_token.clone();

{
    let mut listings = explorer_state
        .active_listings
        .lock()
        .map_err(|e| e.to_string())?;
    listings.insert(operation_id.clone(), cancel_token);
}
```

**spawn_blocking + cancellation check pattern** (lines 43-74):
```rust
let result = tokio::task::spawn_blocking(move || {
    let read_dir = std::fs::read_dir(&path)
        .map_err(|e| format!("Failed to read directory '{}': {}", path, e))?;

    let mut entries = Vec::new();
    for entry_result in read_dir {
        if token_clone.is_cancelled() {
            return Err("Operation cancelled".to_string());
        }
        // ... process entry
    }
    Ok(entries)
})
.await;
```

**Cleanup pattern** (lines 79-81):
```rust
if let Ok(mut listings) = explorer_state.active_listings.lock() {
    listings.remove(&op_id);
}
```

**cancel_directory_cmd pattern** (lines 90-105) -- reuse for `cancel_scan_cmd`:
```rust
#[tauri::command]
pub fn cancel_directory_cmd(
    operation_id: String,
    explorer_state: State<'_, ExplorerState>,
) -> Result<(), String> {
    let listings = explorer_state
        .active_listings
        .lock()
        .map_err(|e| e.to_string())?;

    if let Some(token) = listings.get(&operation_id) {
        token.cancel();
    }

    Ok(())
}
```

**read_file_cmd validation pipeline** (lines 117-148) -- reuse per-file in bulk scan:
```rust
let raw_bytes = std::fs::read(&path)
    .map_err(|e| format!("Failed to read file '{}': {}", path, e))?;

let decode_result = detect_and_decode(&raw_bytes);
let problems = validate_characters(
    &decode_result.content,
    decode_result.had_errors,
    &decode_result.encoding_name,
    decode_result.has_bom,
);
```

**Struct serialization pattern** (lines 17-21, 107-115):
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

### `src-tauri/src/commands/mod.rs` (config) -- MODIFY

**Analog:** Self (lines 1-16)

**Re-export pattern** (lines 9-12):
```rust
pub use explorer::{
    cancel_directory_cmd, check_path_reachable, list_directory_cmd, read_file_cmd,
    toggle_favorite_cmd, ExplorerState,
};
```
Add `bulk_scan_cmd` and `cancel_scan_cmd` to this re-export list.

---

### `src-tauri/src/lib.rs` (config) -- MODIFY

**Analog:** Self (lines 8-12, 47-59)

**Import pattern** (lines 8-12):
```rust
use commands::{
    cancel_directory_cmd, check_path_reachable, get_settings, list_databases_cmd, list_directory_cmd,
    load_schema_cmd, load_schema_mock, read_file_cmd, save_settings, set_menu_ui_state_cmd,
    toggle_favorite_cmd, ExplorerState,
};
```

**Handler registration pattern** (lines 47-59):
```rust
.invoke_handler(tauri::generate_handler![
    load_schema_mock,
    load_schema_cmd,
    // ...
    read_file_cmd,
])
```
Add `bulk_scan_cmd` and `cancel_scan_cmd` to both the import and the handler array.

---

### `src/features/explorer/types.ts` (model) -- MODIFY

**Analog:** Self (full file, lines 1-68)

**Type definition pattern** (lines 31-41):
```typescript
export interface ValidationProblem {
  line: number;
  column: number;
  endColumn: number;
  message: string;
  severity: "error" | "warning";
  code: string;
}

export type ValidationStatus = "error" | "warning" | "clean";
```
New scan types follow the same style: interfaces with camelCase fields, union types for status.

---

### `src/features/explorer/store.ts` (store, event-driven) -- MODIFY

**Analog:** Self

**Store interface pattern** (lines 17-63):
```typescript
interface ExplorerStore {
  // State
  validationCache: Map<
    string,
    { problems: ValidationProblem[]; encoding: string; hasBom: boolean }
  >;
  // ...

  // Actions
  getValidationStatus: (filePath: string) => ValidationStatus | undefined;
  // ...
}
```

**validationCache update pattern** (lines 407-419):
```typescript
// Update validation cache with new Map instance
const nextCache = new Map(get().validationCache);
nextCache.set(filePath, {
  problems: result.problems,
  encoding: result.encoding,
  hasBom: result.hasBom,
});

set({
  tabs: recomputeTabNames(updated),
  validationCache: nextCache,
  ...(hasProblems ? { problemsPanelOpen: true } : {}),
});
```

**getValidationStatus pattern** (lines 538-546):
```typescript
getValidationStatus: (
  filePath: string
): ValidationStatus | undefined => {
  const cached = get().validationCache.get(filePath);
  if (!cached) return undefined;
  if (cached.problems.some((p) => p.severity === "error")) return "error";
  if (cached.problems.some((p) => p.severity === "warning")) return "warning";
  return "clean";
},
```
Badge aggregation for folders extends this same severity-check approach.

**Zustand create pattern** (line 114):
```typescript
export const useExplorerStore = create<ExplorerStore>((set, get) => ({
  // Initial state values
  // ...
  // Action implementations
}));
```

---

### `src/features/explorer/services/explorer-service.ts` (service, request-response) -- MODIFY

**Analog:** Self (full file, lines 1-21)

**Service object pattern** (lines 5-21):
```typescript
export const explorerService = {
  listDirectory: (path: string, operationId: string): Promise<DirEntry[]> =>
    tauri.listDirectory(path, operationId),

  cancelDirectory: (operationId: string): Promise<void> =>
    tauri.cancelDirectory(operationId),

  readFile: (path: string): Promise<FileContent> => tauri.readFile(path),
};
```
Add `bulkScan` and `cancelScan` following identical delegation pattern.

---

### `src/services/tauri.ts` (service, request-response) -- MODIFY

**Analog:** Self (full file, lines 1-62)

**invokeCommand wrapper** (lines 14-25):
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

**Explorer command registration pattern** (lines 52-62):
```typescript
// Explorer commands
listDirectory: (path: string, operationId: string) =>
  invokeCommand<DirEntry[]>("list_directory_cmd", { path, operationId }),
cancelDirectory: (operationId: string) =>
  invokeCommand<void>("cancel_directory_cmd", { operationId }),
```
Add `bulkScan` and `cancelScan` following this pattern, importing new scan types.

---

### `src/services/events.ts` (utility, event-driven) -- MODIFY

**Analog:** Self (full file, lines 1-58)

**createEventHub pattern** (lines 7-31):
```typescript
export function createEventHub<T>(eventName: string) {
  const subscribers = new Set<Callback<T>>();
  let unlisten: UnlistenFn | null = null;

  const ensureListening = async () => {
    if (unlisten) return;
    unlisten = await listen<T>(eventName, (event) => {
      subscribers.forEach((cb) => cb(event.payload));
    });
  };

  return {
    subscribe: (callback: Callback<T>): (() => void) => {
      subscribers.add(callback);
      ensureListening();
      return () => {
        subscribers.delete(callback);
        if (subscribers.size === 0 && unlisten) {
          unlisten();
          unlisten = null;
        }
      };
    },
  };
}
```

**useTauriEvent hook** (lines 34-41):
```typescript
export function useTauriEvent<T>(
  subscribe: (cb: Callback<T>) => () => void,
  callback: Callback<T>
) {
  useEffect(() => {
    return subscribe(callback);
  }, [subscribe, callback]);
}
```

**Event hub instance pattern** (lines 48-58):
```typescript
export const menuToggleSidebarHub = createEventHub<void>("menu:toggle-sidebar");
```
Add `scanProgressHub` following this pattern with `ScanProgressPayload` type parameter.

---

### `src/features/explorer/components/scan-progress-panel.tsx` (component, event-driven) -- NEW

**Analog:** `src/features/explorer/components/problems-panel.tsx`

**Imports pattern** (lines 1-4):
```typescript
import { ChevronDown, ChevronRight, CircleDot, AlertTriangle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProblemRow } from "./problem-row";
import type { ValidationProblem } from "../types";
```

**Component structure pattern** (lines 6-11, 13-18):
```typescript
export interface ProblemsPanelProps {
  problems: ValidationProblem[];
  isOpen: boolean;
  onToggle: () => void;
  onProblemClick: (line: number, column: number) => void;
}

export function ProblemsPanel({
  problems,
  isOpen,
  onToggle,
  onProblemClick,
}: ProblemsPanelProps) {
```

**Panel layout pattern** (lines 31-88):
```typescript
return (
  <div
    className="flex flex-col border-t"
    role="region"
    aria-label="Problems panel"
  >
    {/* Header bar -- always visible */}
    <div
      className="flex items-center gap-2 px-4 h-8 bg-muted/50 cursor-pointer border-b"
      onClick={onToggle}
    >
      {/* ... chevron, title, counts */}
    </div>
    {/* Body -- only when open */}
    {isOpen && (
      <ScrollArea className="flex-1 overflow-hidden">
        {/* ... content */}
      </ScrollArea>
    )}
  </div>
);
```
The scan progress panel follows this structure: header with stats, body with progress bar + file name + cancel button. Uses shadcn `Progress` component instead of `ScrollArea`.

---

### `src/features/explorer/components/scan-results-tab.tsx` (component, CRUD) -- NEW

**Analog:** `src/features/explorer/components/problems-panel.tsx` (expandable list) + `src/features/explorer/components/file-content-header.tsx` (header bar)

**Header bar layout** from `file-content-header.tsx` (lines 37-38):
```typescript
<div className="flex items-center gap-2 px-4 h-10 border-b bg-muted/50">
  {/* Left section */}
  <div className="flex items-center gap-2 min-w-0 flex-1">
    {/* icon + title + stats */}
  </div>
  {/* Right section: action buttons */}
  <Separator orientation="vertical" className="h-5" />
  <div className="flex items-center gap-1">
    {/* buttons */}
  </div>
</div>
```

**Scrollable list layout** from `problems-panel.tsx` (lines 70-86):
```typescript
<ScrollArea className="flex-1 overflow-hidden">
  <div role="list">
    {sortedProblems.map((problem, index) => (
      <ProblemRow
        key={`${problem.line}:${problem.column}:${index}`}
        problem={problem}
        onClick={onProblemClick}
      />
    ))}
  </div>
</ScrollArea>
```

---

### `src/features/explorer/components/scan-results-header.tsx` (component, request-response) -- NEW

**Analog:** `src/features/explorer/components/file-content-header.tsx` + `src/features/export/components/export-button.tsx`

**Header with left/right sections** from `file-content-header.tsx` (lines 37-152):
```typescript
<div className="flex items-center gap-2 px-4 h-10 border-b bg-muted/50">
  <div className="flex items-center gap-2 min-w-0 flex-1">
    {fileIcon}
    <span className="text-sm font-semibold truncate">{tab.fileName}</span>
    <span className="text-xs text-muted-foreground flex-shrink-0 ml-1">
      {fileSizeDisplay}
    </span>
  </div>
  <Separator orientation="vertical" className="h-5" />
  <div className="flex items-center gap-1">
    {/* action buttons */}
  </div>
</div>
```

**Export dropdown pattern** from `export-button.tsx` (lines 21-54):
```typescript
<DropdownMenu>
  <Tooltip>
    <TooltipTrigger asChild>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isExporting}>
          <Download className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
    </TooltipTrigger>
    <TooltipContent>Export</TooltipContent>
  </Tooltip>
  <DropdownMenuContent align="end" className="w-48">
    <DropdownMenuLabel>Export As</DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={() => exportPng()}>
      <Image className="w-4 h-4 mr-2" />
      PNG Image
    </DropdownMenuItem>
    {/* ... more items */}
  </DropdownMenuContent>
</DropdownMenu>
```

---

### `src/features/explorer/components/scan-file-row.tsx` (component, CRUD) -- NEW

**Analog:** `src/features/explorer/components/problem-row.tsx`

**Row component pattern** (full file, lines 1-53):
```typescript
export interface ProblemRowProps {
  problem: ValidationProblem;
  onClick: (line: number, column: number) => void;
}

export function ProblemRow({ problem, onClick }: ProblemRowProps) {
  const handleClick = () => {
    onClick(problem.line, problem.column);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick(problem.line, problem.column);
    }
  };

  return (
    <div
      className="flex items-center gap-2 px-4 py-1.5 hover:bg-accent cursor-pointer text-sm"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="listitem"
    >
      {/* icon */}
      <span className="text-xs text-muted-foreground font-mono flex-shrink-0 w-14 text-right">
        {problem.line}:{problem.column}
      </span>
      <span className="text-sm truncate">{problem.message}</span>
    </div>
  );
}
```
The scan file row extends this with expandable detail (chevron + child problem rows) and additional columns (file name, path, error/warning counts, encoding).

**Validation status badge pattern** from `folder-tree-node.tsx` (lines 154-176):
```typescript
if (!node.isDir && validationStatus === "error") {
  return (
    <span className="h-2 w-2 rounded-full flex-shrink-0 bg-red-500 dark:bg-red-400 ml-1" />
  );
}

if (!node.isDir && validationStatus === "warning") {
  return (
    <span className="h-2 w-2 rounded-full flex-shrink-0 bg-amber-500 dark:bg-amber-400 ml-1" />
  );
}
```

---

### `src/features/explorer/hooks/use-scan.ts` (hook, event-driven) -- NEW

**Analog:** `src/features/export/hooks/useExport.ts` + `src/services/events.ts` (`useTauriEvent`)

**Hook structure with loading state** from `useExport.ts` (lines 1-8, 10-12, 22-46):
```typescript
import { useState, useCallback } from "react";

export function useExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exportPng = useCallback(async () => {
    setIsExporting(true);
    setError(null);

    try {
      // ... do work
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setIsExporting(false);
    }
  }, [/* deps */]);

  return { isExporting, error, exportPng };
}
```

**Event subscription pattern** from `events.ts` (lines 34-41):
```typescript
export function useTauriEvent<T>(
  subscribe: (cb: Callback<T>) => () => void,
  callback: Callback<T>
) {
  useEffect(() => {
    return subscribe(callback);
  }, [subscribe, callback]);
}
```

**Clipboard action pattern** from `use-file-actions.ts` (lines 9-12):
```typescript
const copyPath = useCallback(async (filePath: string) => {
  try {
    await writeText(filePath);
    showToast({ type: "success", title: "Path copied to clipboard", duration: 2000 });
  } catch {
    showToast({ type: "error", title: "Failed to copy path", duration: 3000 });
  }
}, []);
```

---

### `src/features/explorer/utils/scan-csv-export.ts` (utility, transform) -- NEW

**Analog:** `src/features/export/utils/json-export.ts`

**Export function pattern** (lines 1-30):
```typescript
import type { SchemaGraph } from "@/features/schema-graph/types";

export interface JsonExportOptions {
  pretty?: boolean;
  includeMetadata?: boolean;
  connectionInfo?: { server: string; database?: string };
}

export function exportToJson(
  schema: SchemaGraph,
  options: JsonExportOptions = {}
): string {
  const { pretty = true, includeMetadata = true, connectionInfo } = options;

  const exportData = includeMetadata
    ? {
        metadata: {
          exportedAt: new Date().toISOString(),
          version: "1.0",
          // ...
        },
        schema,
      }
    : schema;

  return pretty
    ? JSON.stringify(exportData, null, 2)
    : JSON.stringify(exportData);
}
```
CSV export follows same shape: typed options interface, pure function taking scan results, returns string. No side effects -- the service layer handles file dialogs.

---

### `src/features/explorer/utils/scan-pdf-export.ts` (utility, transform) -- NEW

**Analog:** `src/features/export/utils/pdf-export.ts`

**jsPDF document setup** (lines 1-31):
```typescript
import jsPDF from "jspdf";

export async function exportToPdf(
  schema: SchemaGraph,
  options: PdfExportOptions = {}
): Promise<Uint8Array> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let yPos = 20;
```

**checkPageBreak helper** (lines 33-37):
```typescript
const checkPageBreak = (height: number) => {
  if (yPos + height > pageHeight - 20) {
    doc.addPage();
    yPos = 20;
  }
};
```

**Section rendering pattern** (lines 39-57):
```typescript
// Title
doc.setFontSize(24);
doc.setFont("helvetica", "bold");
doc.text(title, margin, yPos);
yPos += 10;

// Metadata
doc.setFontSize(10);
doc.setFont("helvetica", "normal");
doc.setTextColor(100);
doc.text(`Server: ${connectionInfo.server}`, margin, yPos);
yPos += 5;
doc.text(`Generated: ${new Date().toLocaleString()}`, margin, yPos);
yPos += 10;
```

**Summary items rendering** (lines 62-82):
```typescript
doc.setFontSize(14);
doc.setFont("helvetica", "bold");
doc.text("Summary", margin, yPos);
yPos += 7;

doc.setFontSize(10);
doc.setFont("helvetica", "normal");
const summaryItems = [
  `Tables: ${schema.tables.length}`,
  // ...
];
summaryItems.forEach((item) => {
  doc.text(item, margin + 5, yPos);
  yPos += 5;
});
```

**Detail list rendering** (lines 106-134):
```typescript
schema.tables.forEach((table) => {
  checkPageBreak(15 + table.columns.length * 4);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(`${table.schema}.${table.name}`, margin + 5, yPos);
  yPos += 5;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  table.columns.forEach((col) => {
    doc.text(`  ${col.name}: ${col.dataType}`, margin + 10, yPos);
    yPos += 4;
  });
  yPos += 3;
});
```

**Output pattern** (lines 198-200):
```typescript
const pdfOutput = doc.output("arraybuffer");
return new Uint8Array(pdfOutput);
```

---

### `src/features/explorer/utils/scan-json-export.ts` (utility, transform) -- NEW

**Analog:** `src/features/export/utils/json-export.ts` -- exact match

Follows the same pattern as `json-export.ts` (full file, lines 1-30). Pure function, typed options interface, returns `JSON.stringify` output with metadata wrapper.

---

### `src/features/explorer/utils/scan-clipboard-export.ts` (utility, transform) -- NEW

**Analog:** `src/features/export/utils/json-export.ts` (function structure) + `src/features/explorer/hooks/use-file-actions.ts` (clipboard write)

**Pure formatter function** from `json-export.ts` (lines 9-30):
```typescript
export function exportToJson(
  schema: SchemaGraph,
  options: JsonExportOptions = {}
): string {
  // ... format and return string
}
```

**Clipboard write pattern** from `use-file-actions.ts` (lines 9-12):
```typescript
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
await writeText(filePath);
```
Clipboard export produces two functions: one returning plain text string, one returning markdown string. The actual `writeText` call happens in the hook, not in the utility.

---

### `src/features/explorer/utils/badge-aggregation.ts` (utility, transform) -- NEW

**Analog:** `src/features/explorer/store.ts` (`getValidationStatus` at lines 538-546)

**Severity determination pattern** (lines 538-546):
```typescript
getValidationStatus: (
  filePath: string
): ValidationStatus | undefined => {
  const cached = get().validationCache.get(filePath);
  if (!cached) return undefined;
  if (cached.problems.some((p) => p.severity === "error")) return "error";
  if (cached.problems.some((p) => p.severity === "warning")) return "warning";
  return "clean";
},
```
Badge aggregation uses the same severity priority (error > warning > clean) but applied across all files under a folder path prefix, with upward propagation through the folder hierarchy.

---

## Shared Patterns

### Tauri IPC Command Pipeline
**Source:** `src/services/tauri.ts` (lines 14-25), `src/features/explorer/services/explorer-service.ts` (lines 5-21), `src-tauri/src/commands/explorer.rs`, `src-tauri/src/commands/mod.rs`, `src-tauri/src/lib.rs`
**Apply to:** New `bulk_scan_cmd` and `cancel_scan_cmd`

Full pipeline for adding a new Tauri command:
1. Define in `src-tauri/src/commands/explorer.rs` with `#[tauri::command]`
2. Re-export in `src-tauri/src/commands/mod.rs`
3. Import and register in `src-tauri/src/lib.rs` `generate_handler!`
4. Add typed method in `src/services/tauri.ts` using `invokeCommand<T>`
5. Add service wrapper in `src/features/explorer/services/explorer-service.ts`

### CancellationToken Pattern
**Source:** `src-tauri/src/commands/explorer.rs` (lines 11-13, 29-38, 49, 79-81, 90-105)
**Apply to:** `bulk_scan_cmd`, `cancel_scan_cmd`

```rust
// Store token in ExplorerState.active_listings
// Check token.is_cancelled() in iteration loop
// Clean up listing on completion
// cancel command: look up token, call token.cancel()
```

### Event Streaming Pattern
**Source:** `src/services/events.ts` (lines 7-31, 34-41, 48)
**Apply to:** Scan progress events from Rust to React

```typescript
// 1. Define event hub with typed payload
export const scanProgressHub = createEventHub<ScanProgressPayload>("scan-progress");

// 2. Subscribe in hook using useTauriEvent
useTauriEvent(scanProgressHub.subscribe, useCallback((payload) => {
  updateScanProgress(payload);
}, [updateScanProgress]));

// 3. Emit from Rust using Emitter trait
use tauri::Emitter;
let _ = app.emit("scan-progress", payload);
```

### Export Service Pattern
**Source:** `src/features/export/services/export-service.ts` (full file), `src/features/export/hooks/useExport.ts` (lines 22-46)
**Apply to:** All scan export operations (CSV, PDF, JSON)

```typescript
// Text exports (CSV, JSON):
await exportService.saveTextFile(content, {
  filename: `scan-report.csv`,
  filters: [{ name: "CSV", extensions: ["csv"] }],
});

// Binary exports (PDF):
await exportService.saveBinaryFile(pdfData, {
  filename: `scan-report.pdf`,
  filters: [{ name: "PDF", extensions: ["pdf"] }],
});
```

### Validation Status Badge Pattern
**Source:** `src/features/explorer/components/folder-tree-node.tsx` (lines 150-176)
**Apply to:** Folder aggregate badges, scan file row status icons

```typescript
// Red dot for errors
<span className="h-2 w-2 rounded-full flex-shrink-0 bg-red-500 dark:bg-red-400 ml-1" />
// Yellow dot for warnings
<span className="h-2 w-2 rounded-full flex-shrink-0 bg-amber-500 dark:bg-amber-400 ml-1" />
```

### Zustand Store Extension Pattern
**Source:** `src/features/explorer/store.ts` (lines 17-63, 114, 407-419)
**Apply to:** Adding scan state, badge cache, scan actions

```typescript
interface ExplorerStore {
  // Existing state...
  validationCache: Map<string, { /* ... */ }>;

  // New scan state to add:
  // scanStatus, scanProgress, scanResult, folderBadgeCache, etc.

  // New actions to add:
  // startScan, updateScanProgress, completeScan, cancelScan, etc.
}
```

### Serde Struct Conventions (Rust)
**Source:** `src-tauri/src/commands/explorer.rs` (lines 17-21, 107-115), `src-tauri/src/validation/validator.rs` (lines 8-17)
**Apply to:** All new Rust structs (`ScanProgressPayload`, `ScanFileResult`, `ScanSummary`)

```rust
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct StructName {
    pub field_name: Type,
}
```
Note: event payloads need `Clone` in addition to `Serialize` for `app.emit()`.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| -- | -- | -- | All files have close analogs in the existing codebase |

Every new file has at least a role-match analog. The project has established patterns for each category of work in this phase: Tauri commands with cancellation, event streaming, Zustand stores, export utilities, and panel/row UI components.

## Metadata

**Analog search scope:** `src-tauri/src/commands/`, `src-tauri/src/validation/`, `src-tauri/src/lib.rs`, `src/features/explorer/`, `src/features/export/`, `src/services/`
**Files scanned:** 22 source files read
**Pattern extraction date:** 2026-05-27
