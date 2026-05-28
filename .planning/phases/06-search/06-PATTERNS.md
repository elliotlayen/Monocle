# Phase 6: Search - Pattern Map

**Mapped:** 2026-05-28
**Files analyzed:** 14 new/modified files
**Analogs found:** 14 / 14

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src-tauri/src/commands/explorer.rs` (modify) | command | streaming + CRUD | self (`bulk_scan_cmd`) | exact |
| `src-tauri/src/commands/mod.rs` (modify) | config | -- | self | exact |
| `src-tauri/src/lib.rs` (modify) | config | -- | self | exact |
| `src/services/tauri.ts` (modify) | service | request-response | self (`bulkScan`) | exact |
| `src/services/events.ts` (modify) | utility | event-driven | self (`scanProgressHub`) | exact |
| `src/features/explorer/types.ts` (modify) | model | -- | self (`ScanProgressPayload`) | exact |
| `src/features/explorer/store.ts` (modify) | store | event-driven | self (scan state) | exact |
| `src/features/explorer/services/explorer-service.ts` (modify) | service | request-response | self (`bulkScan`) | exact |
| `src/features/explorer/components/explorer-sidebar.tsx` (modify) | component | request-response | self | exact |
| `src/features/explorer/components/search-bar.tsx` (new) | component | request-response | `explorer-sidebar.tsx` (filter input) | role-match |
| `src/features/explorer/components/search-controls-row.tsx` (new) | component | request-response | `scan-results-header.tsx` | role-match |
| `src/features/explorer/components/search-results.tsx` (new) | component | event-driven | `folder-tree.tsx` | role-match |
| `src/features/explorer/components/search-result-group.tsx` (new) | component | request-response | `scan-file-row.tsx` | role-match |
| `src/features/explorer/components/search-result-row.tsx` (new) | component | request-response | `scan-file-row.tsx` | role-match |
| `src/features/explorer/components/search-progress.tsx` (new) | component | event-driven | `scan-progress-panel.tsx` | exact |
| `src/features/explorer/hooks/use-search.ts` (new) | hook | event-driven | `use-scan.ts` | exact |
| `src/features/explorer/hooks/use-search-highlight.ts` (new) | hook | transform | `use-validation-decorations.ts` | exact |
| `src/features/explorer/components/xml-source-view.tsx` (modify) | component | transform | self | exact |

## Pattern Assignments

### `src-tauri/src/commands/explorer.rs` (command, streaming) -- MODIFY

**Analog:** Self -- `bulk_scan_cmd` at lines 219-398

**Imports pattern** (lines 1-12):
```rust
use crate::state::{AppSettings, AppState};
use crate::validation::{detect_and_decode, validate_characters};
use crate::validation::validator::ValidationProblem;
use glob::Pattern;
use serde::Serialize;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};
use tokio_util::sync::CancellationToken;
use walkdir::WalkDir;
```

**Struct + serde pattern** (lines 22-28, 177-217):
```rust
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanProgressPayload {
    pub file_path: String,
    pub file_name: String,
    pub status: String,
    // ...
}
```

**Core command pattern** (lines 219-398) -- `content_search_cmd` mirrors this exactly:
```rust
#[tauri::command]
pub async fn bulk_scan_cmd(
    app: AppHandle,
    folder_path: String,
    file_pattern: String,
    operation_id: String,
    explorer_state: State<'_, ExplorerState>,
) -> Result<ScanSummary, String> {
    let pattern = Pattern::new(&file_pattern)
        .map_err(|e| format!("Invalid file pattern '{}': {}", file_pattern, e))?;

    let cancel_token = CancellationToken::new();
    let token_clone = cancel_token.clone();

    {
        let mut listings = explorer_state
            .active_listings
            .lock()
            .map_err(|e| e.to_string())?;
        listings.insert(operation_id.clone(), cancel_token);
    }

    let result = tokio::task::spawn_blocking(move || {
        // Phase 1: Collect matching files
        let matching_files: Vec<PathBuf> = WalkDir::new(&folder_path_clone)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| !e.file_type().is_dir())
            .filter(|e| {
                e.file_name()
                    .to_str()
                    .map(|n| pattern.matches(n))
                    .unwrap_or(false)
            })
            .map(|e| e.into_path())
            .collect();

        // Phase 2: Process each file
        for (idx, file_path) in matching_files.iter().enumerate() {
            if token_clone.is_cancelled() {
                cancelled = true;
                break;
            }

            let raw_bytes = match std::fs::read(file_path) { ... };
            let decode_result = detect_and_decode(&raw_bytes);

            // ... process file ...

            // Throttle event emission: emit at most every 50ms, or on last file
            let is_last = idx == matching_files.len() - 1;
            let elapsed = last_emit_time.elapsed();
            if elapsed >= Duration::from_millis(50) || is_last {
                let _ = app.emit("scan-progress", payload);
                last_emit_time = std::time::Instant::now();
            }
        }

        ScanSummary { ... }
    })
    .await
    .map_err(|e| format!("Scan task failed: {}", e))?;

    // Clean up active listing
    if let Ok(mut listings) = explorer_state.active_listings.lock() {
        listings.remove(&op_id);
    }

    Ok(result)
}
```

**Cancellation command pattern** (lines 400-415):
```rust
#[tauri::command]
pub fn cancel_scan_cmd(
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

**Test pattern** (lines 417-524):
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_glob_pattern_matching() {
        let xml_pattern = Pattern::new("*.xml").unwrap();
        assert!(xml_pattern.matches("file.xml"));
        // ...
    }

    #[test]
    fn test_scan_summary_serialization() {
        let summary = ScanSummary { ... };
        let json = serde_json::to_value(&summary).unwrap();
        assert_eq!(json["folderPath"], "/test/path");
        // ...
    }
}
```

---

### `src-tauri/src/commands/mod.rs` (config) -- MODIFY

**Analog:** Self (lines 1-16)

**Re-export pattern:**
```rust
pub use explorer::{
    bulk_scan_cmd, cancel_directory_cmd, cancel_scan_cmd, check_path_reachable,
    list_directory_cmd, read_file_cmd, toggle_favorite_cmd, ExplorerState,
};
```
Add `content_search_cmd` to this re-export block. No new module file needed since search goes in `explorer.rs`.

---

### `src-tauri/src/lib.rs` (config) -- MODIFY

**Analog:** Self (lines 8-12, 47-62)

**Import pattern** (lines 8-12):
```rust
use commands::{
    bulk_scan_cmd, cancel_directory_cmd, cancel_scan_cmd, check_path_reachable, get_settings,
    list_databases_cmd, list_directory_cmd, load_schema_cmd, load_schema_mock, read_file_cmd,
    save_settings, set_menu_ui_state_cmd, toggle_favorite_cmd, ExplorerState,
};
```

**Registration pattern** (lines 47-62):
```rust
.invoke_handler(tauri::generate_handler![
    load_schema_mock,
    load_schema_cmd,
    // ...
    bulk_scan_cmd,
    cancel_scan_cmd,
])
```
Add `content_search_cmd` to both the import and the `generate_handler!` macro.

---

### `src/services/tauri.ts` (service, request-response) -- MODIFY

**Analog:** Self -- `bulkScan` / `cancelScan` (lines 68-75)

**Command registration pattern:**
```typescript
// Bulk scan commands
bulkScan: (folderPath: string, filePattern: string, operationId: string) =>
  invokeCommand<ScanSummary>("bulk_scan_cmd", {
    folderPath,
    filePattern,
    operationId,
  }),
cancelScan: (operationId: string) =>
  invokeCommand<void>("cancel_scan_cmd", { operationId }),
```
Add `contentSearch` following identical pattern. Note: `cancelScan` can be reused for search cancellation (same `ExplorerState.active_listings` map).

---

### `src/services/events.ts` (utility, event-driven) -- MODIFY

**Analog:** Self -- `scanProgressHub` (lines 44-46)

**Event hub creation pattern:**
```typescript
import type { ScanProgressPayload } from "@/features/explorer/types";
export const scanProgressHub =
  createEventHub<ScanProgressPayload>("scan-progress");
```
Add `searchResultHub` and `searchProgressHub` with the same pattern. Import new types from `@/features/explorer/types`.

---

### `src/features/explorer/types.ts` (model) -- MODIFY

**Analog:** Self -- `ScanProgressPayload`, `ScanSummary`, `ScanStatus` (lines 73-109)

**Type definition pattern:**
```typescript
export interface ScanProgressPayload {
  filePath: string;
  fileName: string;
  status: "clean" | "error" | "warning";
  errorCount: number;
  warningCount: number;
  filesProcessed: number;
  totalFiles: number;
  totalErrors: number;
  totalWarnings: number;
  totalClean: number;
}

export type ScanStatus = "idle" | "scanning" | "completed" | "cancelled";
```
Add `SearchResultPayload`, `SearchProgressPayload`, `SearchSummary`, `SearchMode`, `SearchStatus`, `SearchScope` following same conventions.

---

### `src/features/explorer/store.ts` (store, event-driven) -- MODIFY

**Analog:** Self -- scan state block (lines 42-54 for state, 609-814 for actions)

**State declaration pattern** (lines 42-54):
```typescript
// Scan state
scanStatus: ScanStatus;
scanOperationId: string | null;
scanFolderPath: string | null;
scanFolderName: string | null;
scanFilePattern: string;
scanProgress: ScanProgressPayload | null;
scanResult: ScanSummary | null;
folderBadgeCache: Map<string, ValidationStatus>;
lastInteractedFolderPath: string | null;
pendingScanRequest: {
  folderPath: string;
  filePattern: string;
} | null;
```

**Action declaration pattern** (lines 84-93):
```typescript
// Scan actions
requestScan: (folderPath: string, filePattern: string) => void;
startScan: (folderPath: string, filePattern: string) => Promise<void>;
updateScanProgress: (payload: ScanProgressPayload) => void;
cancelScan: () => Promise<void>;
clearScanResult: () => void;
setScanFilePattern: (pattern: string) => void;
```

**Initial state pattern** (lines 163-170):
```typescript
// Scan initial state
scanStatus: "idle",
scanOperationId: null,
scanFolderPath: null,
scanFolderName: null,
scanFilePattern: "*.xml",
scanProgress: null,
scanResult: null,
```

**Async action pattern** (lines 621-711 -- `startScan`):
```typescript
startScan: async (folderPath: string, filePattern: string) => {
  const operationId = crypto.randomUUID();
  const folderName = folderPath.split(/[/\\]/).pop() ?? folderPath;

  set({
    scanStatus: "scanning",
    scanOperationId: operationId,
    scanFolderPath: folderPath,
    scanFolderName: folderName,
    scanProgress: null,
    scanResult: null,
  });

  try {
    const result = await explorerService.bulkScan(
      folderPath,
      filePattern,
      operationId
    );

    set({
      scanStatus: result.cancelled ? "cancelled" : "completed",
      scanResult: result,
      scanOperationId: null,
    });
  } catch {
    set({
      scanStatus: "idle",
      scanOperationId: null,
    });
    showToast({
      type: "error",
      title: "Scan failed",
      message: "An error occurred while scanning the folder",
      duration: 5000,
    });
  }
},
```

**Cancel action pattern** (lines 758-769):
```typescript
cancelScan: async () => {
  const { scanOperationId } = get();
  if (scanOperationId) {
    try {
      await explorerService.cancelScan(scanOperationId);
    } catch {
      // Best-effort cancel
    }
  }
},
```

---

### `src/features/explorer/services/explorer-service.ts` (service, request-response) -- MODIFY

**Analog:** Self -- `bulkScan` / `cancelScan` (lines 22-29)

**Service wrapper pattern:**
```typescript
bulkScan: (
  folderPath: string,
  filePattern: string,
  operationId: string
): Promise<ScanSummary> => tauri.bulkScan(folderPath, filePattern, operationId),

cancelScan: (operationId: string): Promise<void> =>
  tauri.cancelScan(operationId),
```
Add `contentSearch` following the same thin-wrapper pattern. Import new types.

---

### `src/features/explorer/components/explorer-sidebar.tsx` (component) -- MODIFY

**Analog:** Self (lines 1-128)

**Store consumption pattern** (lines 28-40):
```typescript
const {
  sidebarOpen,
  sidebarWidth,
  setSidebarOpen,
  setSidebarWidth,
  filterText,
  setFilterText,
  dateSortOrder,
  toggleDateSort,
  loadSources,
} = useExplorerStore(
  useShallow((state) => ({ ... }))
);
```

**Filter input section** (lines 103-111) -- this is the section to replace with `<SearchBar />`:
```tsx
<div className="relative">
  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
  <Input
    placeholder="Filter clients..."
    value={filterText}
    onChange={(e) => setFilterText(e.target.value)}
    className="pl-8 h-8 text-sm"
  />
</div>
```

**Tree body section** (line 115) -- conditionally show `<FolderTree />` or `<SearchResults />`:
```tsx
{/* Tree body */}
<FolderTree />
```

---

### `src/features/explorer/components/search-bar.tsx` (component, request-response) -- NEW

**Analog:** `explorer-sidebar.tsx` (filter input, lines 103-111) + `scan-results-header.tsx` (controls layout)

**Import pattern** (from `explorer-sidebar.tsx` lines 1-15):
```typescript
import { useShallow } from "zustand/shallow";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useExplorerStore } from "../store";
```

**Component structure pattern** (from `explorer-sidebar.tsx` lines 103-111):
```tsx
<div className="relative">
  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
  <Input
    placeholder="Filter clients..."
    value={filterText}
    onChange={(e) => setFilterText(e.target.value)}
    className="pl-8 h-8 text-sm"
  />
</div>
```
Extend this to include the segmented control toggle (Filename/Content) and handle mode switching.

---

### `src/features/explorer/components/search-controls-row.tsx` (component, request-response) -- NEW

**Analog:** `scan-results-header.tsx` (lines 1-95)

**Import pattern:**
```typescript
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
```

**Compact controls layout pattern** (from `scan-results-header.tsx` lines 37-93):
```tsx
<div className="flex items-center gap-2 px-4 h-10 border-b bg-muted/50">
  <div className="flex items-center gap-2 min-w-0 flex-1">
    {/* icon + label */}
  </div>
  {/* buttons/dropdowns */}
</div>
```
Adapt for scope dropdown, file pattern input, and Search button. Use `Input` for file pattern field.

---

### `src/features/explorer/components/search-results.tsx` (component, event-driven) -- NEW

**Analog:** `folder-tree.tsx` (lines 1-166)

**Import and store consumption pattern** (lines 1-30):
```typescript
import { useCallback, useMemo } from "react";
import { useShallow } from "zustand/shallow";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useExplorerStore } from "../store";
```

**Conditional rendering pattern** (lines 120-138):
```tsx
if (folderSources.length === 0) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-sm text-muted-foreground text-center px-4">
        No folder sources configured
      </p>
    </div>
  );
}
```

**ScrollArea wrapper pattern** (lines 140-165):
```tsx
<ScrollArea className="flex-1">
  <div className="p-2">
    {visibleRoots.map((root) => (
      <div key={root.id} className="mb-1">
        {/* render items */}
      </div>
    ))}
  </div>
</ScrollArea>
```

---

### `src/features/explorer/components/search-result-group.tsx` (component) -- NEW

**Analog:** `folder-tree-node.tsx` (collapsible folder header pattern)

**Collapsible header pattern** (from `scan-file-row.tsx` lines 55-94):
```tsx
<div
  className="flex items-center gap-2 px-4 py-1.5 hover:bg-accent cursor-pointer text-sm"
  onClick={handleToggle}
  onKeyDown={handleKeyDown}
  tabIndex={0}
  role="row"
  aria-expanded={expanded}
>
  {expanded ? (
    <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
  ) : (
    <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
  )}
  <span className="text-sm font-semibold truncate">{file.fileName}</span>
  <span className="flex-1" />
  <span className="text-xs text-muted-foreground flex-shrink-0">
    {count}
  </span>
</div>
```

---

### `src/features/explorer/components/search-result-row.tsx` (component) -- NEW

**Analog:** `scan-file-row.tsx` (lines 1-125)

**Row component pattern** (lines 55-94):
```tsx
export interface ScanFileRowProps {
  file: ScanFileResult;
  scanRoot: string;
  onFileClick: (filePath: string) => void;
}

export function ScanFileRow({ file, onFileClick }: ScanFileRowProps) {
  return (
    <div
      className="flex items-center gap-2 px-4 py-1.5 hover:bg-accent cursor-pointer text-sm"
      onClick={() => onFileClick(file.filePath)}
      tabIndex={0}
      role="row"
    >
      <span className="text-sm font-semibold truncate">{file.fileName}</span>
      <span className="flex-1" />
      <span className="text-xs text-muted-foreground flex-shrink-0">
        {matchCount} matches
      </span>
    </div>
  );
}
```

---

### `src/features/explorer/components/search-progress.tsx` (component, event-driven) -- NEW

**Analog:** `scan-progress-panel.tsx` (lines 1-86) -- exact match

**Full component pattern:**
```tsx
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useScan } from "../hooks/use-scan";

export function ScanProgressPanel() {
  const { scanStatus, scanProgress, cancelScan, scanFolderName } = useScan();

  if (scanStatus !== "scanning") return null;

  const filesProcessed = scanProgress?.filesProcessed ?? 0;
  const totalFiles = scanProgress?.totalFiles ?? 0;
  const percentage =
    totalFiles > 0 ? Math.round((filesProcessed / totalFiles) * 100) : 0;

  return (
    <div className="border-t bg-muted/50 px-4 py-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          Scanning {scanFolderName}...
        </span>
        <Button variant="outline" size="sm" className="h-7 px-2" onClick={() => cancelScan()}>
          <X className="h-3.5 w-3.5 mr-1" />
          Cancel
        </Button>
      </div>
      <Progress value={percentage} className="h-2" />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{filesProcessed} of {totalFiles} files ({percentage}%)</span>
      </div>
    </div>
  );
}
```
Adapt for search-specific progress: "Searching... N of M files" with match counts.

---

### `src/features/explorer/hooks/use-search.ts` (hook, event-driven) -- NEW

**Analog:** `use-scan.ts` (lines 1-52) -- exact match

**Full hook pattern:**
```typescript
import { useCallback } from "react";
import { useShallow } from "zustand/shallow";
import { useTauriEvent, scanProgressHub } from "@/services/events";
import { useExplorerStore } from "../store";
import type { ScanProgressPayload } from "../types";

export function useScan() {
  const {
    requestScan,
    cancelScan,
    scanStatus,
    scanProgress,
    scanResult,
    scanFilePattern,
    setScanFilePattern,
    scanFolderName,
    updateScanProgress,
  } = useExplorerStore(
    useShallow((state) => ({ ... }))
  );

  const handleProgress = useCallback(
    (payload: ScanProgressPayload) => {
      updateScanProgress(payload);
    },
    [updateScanProgress]
  );

  // Subscribe to scan progress events from Rust
  useTauriEvent(scanProgressHub.subscribe, handleProgress);

  return { ... };
}
```
Create `useSearch` following identical pattern but subscribing to `searchProgressHub` and `searchResultHub`. Two separate `useTauriEvent` calls.

---

### `src/features/explorer/hooks/use-search-highlight.ts` (hook, transform) -- NEW

**Analog:** `use-validation-decorations.ts` (lines 1-166) -- exact match

**Decoration hook pattern** (lines 75-166):
```typescript
export function useValidationDecorations(
  editorInstance: editor.IStandaloneCodeEditor | null,
  problems: ValidationProblem[]
): void {
  const collectionRef = useRef<editor.IEditorDecorationsCollection | null>(null);

  useEffect(() => {
    if (!editorInstance) return;

    // Clear previous decorations
    if (collectionRef.current) {
      collectionRef.current.clear();
      collectionRef.current = null;
    }

    if (problems.length === 0) return;

    const decorations: editor.IModelDeltaDecoration[] = problems.map((p) => {
      return {
        range,
        options: {
          className: "...",
          overviewRuler: {
            color: "oklch(...)",
            position: 4,
          },
        },
      };
    });

    collectionRef.current =
      editorInstance.createDecorationsCollection(decorations);

    return () => {
      if (collectionRef.current) {
        collectionRef.current.clear();
        collectionRef.current = null;
      }
    };
  }, [editorInstance, problems]);
}
```
Adapt: instead of mapping `problems` to decorations, use `model.findMatches(term, false, false, false, null, false)` to get ranges, then create decorations with a search-highlight CSS class. Also call `editorInstance.revealRangeInCenterIfOutsideViewport(firstMatch.range)`.

---

### `src/features/explorer/components/xml-source-view.tsx` (component, transform) -- MODIFY

**Analog:** Self (lines 1-175)

**Decoration hook usage pattern** (line 90):
```typescript
// Apply Monaco decorations for validation problems
useValidationDecorations(editorMounted, problems ?? []);
```
Add `useSearchHighlight(editorMounted, searchTerms)` below this line. Pass `searchTerms` as a new prop from parent.

**Props pattern** (lines 9-20):
```typescript
interface XmlSourceViewProps {
  content: string;
  isXml: boolean;
  tabId: string;
  scrollPosition: number;
  onScrollChange: (position: number) => void;
  savedViewState: unknown | null;
  onViewStateChange: (state: unknown | null) => void;
  problems?: ValidationProblem[];
  pendingJump?: { tabId: string; line: number; column: number } | null;
  onJumpHandled?: () => void;
}
```
Add `searchTerms?: string[] | null` prop.

---

## Shared Patterns

### Zustand Store with useShallow
**Source:** `src/features/explorer/store.ts` + all consumers
**Apply to:** All new components and hooks that consume store state
```typescript
import { useShallow } from "zustand/shallow";
import { useExplorerStore } from "../store";

const { prop1, prop2, action1 } = useExplorerStore(
  useShallow((state) => ({
    prop1: state.prop1,
    prop2: state.prop2,
    action1: state.action1,
  }))
);
```

### Event Hub Subscription
**Source:** `src/services/events.ts` (lines 7-31, 33-41)
**Apply to:** `use-search.ts` hook
```typescript
import { useTauriEvent, searchProgressHub, searchResultHub } from "@/services/events";

const handleProgress = useCallback((payload: SearchProgressPayload) => {
  updateSearchProgress(payload);
}, [updateSearchProgress]);

useTauriEvent(searchProgressHub.subscribe, handleProgress);
```

### Tauri IPC Flow
**Source:** `src/services/tauri.ts` -> `src/features/explorer/services/explorer-service.ts`
**Apply to:** All new search commands
```typescript
// tauri.ts
contentSearch: (query: string, folderPath: string, filePattern: string, operationId: string) =>
  invokeCommand<SearchSummary>("content_search_cmd", {
    query, folderPath, filePattern, operationId,
  }),

// explorer-service.ts
contentSearch: (query: string, folderPath: string, filePattern: string, operationId: string): Promise<SearchSummary> =>
  tauri.contentSearch(query, folderPath, filePattern, operationId),
```

### Error Handling with showToast
**Source:** `src/features/explorer/store.ts` (lines 472-479)
**Apply to:** Search store actions
```typescript
import { showToast } from "@/features/notifications/store";

showToast({
  type: "error",
  title: "Search failed",
  message: "An error occurred during content search",
  duration: 5000,
});
```

### Rust Command Pattern (spawn_blocking + CancellationToken + emit)
**Source:** `src-tauri/src/commands/explorer.rs` (lines 219-398)
**Apply to:** `content_search_cmd`
```rust
#[tauri::command]
pub async fn content_search_cmd(
    app: AppHandle,
    query: String,
    folder_path: String,
    file_pattern: String,
    operation_id: String,
    explorer_state: State<'_, ExplorerState>,
) -> Result<SearchSummary, String> {
    // 1. Validate inputs
    // 2. Create and store CancellationToken
    // 3. spawn_blocking
    //    a. Walk directory with WalkDir + glob::Pattern
    //    b. For each file: check cancel, read, detect_and_decode, search
    //    c. Emit throttled progress events (50ms)
    //    d. Emit per-file result events
    // 4. Clean up active_listings
    // 5. Return summary
}
```

### Component Styling Conventions
**Source:** Multiple components in `src/features/explorer/components/`
**Apply to:** All new search components
```tsx
// Muted text for secondary info
<span className="text-xs text-muted-foreground">...</span>

// Interactive row
<div className="flex items-center gap-2 px-4 py-1.5 hover:bg-accent cursor-pointer text-sm">

// Empty state message
<div className="flex-1 flex items-center justify-center">
  <p className="text-sm text-muted-foreground text-center px-4">
    Message here
  </p>
</div>

// Compact button
<Button variant="outline" size="sm" className="h-7 px-2">

// Icon sizing
<IconComponent className="h-4 w-4" />       // standard
<IconComponent className="h-3.5 w-3.5" />   // small (in buttons)
```

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none) | -- | -- | All files have strong analogs in the existing codebase |

Every new file has an exact or role-match analog from the Phase 5 bulk scan implementation. The search feature is architecturally identical to bulk scan: Rust command with `spawn_blocking` + directory walking + event streaming + frontend store + progress UI.

## Metadata

**Analog search scope:** `src/features/explorer/`, `src/services/`, `src-tauri/src/commands/`, `src-tauri/src/validation/`
**Files scanned:** 25
**Pattern extraction date:** 2026-05-28
