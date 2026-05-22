# Phase 1: Explorer Shell & Navigation - Pattern Map

**Mapped:** 2026-05-22
**Files analyzed:** 6 (3 new, 3 modified)
**Analogs found:** 6 / 6

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/features/explorer/components/explorer-shell.tsx` (NEW) | component | request-response | `src/App.tsx` lines 391-428 (connected view layout) | exact |
| `src/features/explorer/components/explorer-nav-bar.tsx` (NEW) | component | request-response | `src/features/toolbar/components/toolbar.tsx` lines 484-1006 | exact |
| `src/features/explorer/components/explorer-empty-state.tsx` (NEW) | component | request-response | `src/App.tsx` lines 421-423 (empty state) + `src/features/connection/components/home-screen.tsx` (centered layout) | role-match |
| `src/features/schema-graph/store.ts` (MODIFY) | store | event-driven | Self -- `enterCanvasMode`/`exitCanvasMode` at lines 1077-1106 | exact |
| `src/App.tsx` (MODIFY) | component | request-response | Self -- canvas mode conditional at lines 96, 163-170, 266-282, 357-429 | exact |
| `src/features/connection/components/home-screen.tsx` (MODIFY) | component | request-response | Self -- Canvas Mode button at lines 54-66 | exact |

## Pattern Assignments

### `src/features/explorer/components/explorer-shell.tsx` (component, request-response)

**Analog:** `src/App.tsx` lines 391-428

This is a simple layout container. It follows the same flex-column full-height pattern used by the connected view in App.tsx.

**Layout pattern** (App.tsx lines 392-428):
```typescript
<ReactFlowProvider>
  <div className="flex flex-col h-screen">
    <Toolbar ... />
    <main className="relative flex-1 overflow-hidden">
      {/* content */}
    </main>
    <StatusBar />
  </div>
</ReactFlowProvider>
```

Explorer simplifies this: no ReactFlowProvider, no StatusBar. The shell is:
```typescript
<div className="flex flex-col h-screen">
  <ExplorerNavBar onHome={onHome} onOpenSettings={onOpenSettings} />
  <main className="flex-1 overflow-hidden">
    <ExplorerEmptyState onOpenSettings={onOpenSettings} />
  </main>
</div>
```

**Props pattern** (follows HomeScreen callback style, home-screen.tsx lines 6-11):
```typescript
interface ExplorerShellProps {
  onHome: () => void;
  onOpenSettings: () => void;
}
```

---

### `src/features/explorer/components/explorer-nav-bar.tsx` (component, request-response)

**Analog:** `src/features/toolbar/components/toolbar.tsx`

**Imports pattern** (toolbar.tsx lines 1-10, 26-29, 31-41):
```typescript
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Home, Settings } from "lucide-react";
```

**Container CSS pattern** (toolbar.tsx line 484):
```typescript
<div className="relative z-20 flex items-center gap-3 px-3 py-2 bg-background border-b border-border">
```

**Branding pattern** (toolbar.tsx lines 487-491):
```typescript
<span
  className="font-semibold text-base"
  style={{ fontFamily: "'JetBrains Mono', monospace" }}
>
  Monocle
</span>
```

**Spacer pattern** (toolbar.tsx line 518):
```typescript
<div className="flex-1" />
```

**Tooltip button pattern** (toolbar.tsx lines 951-965):
```typescript
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        variant="outline"
        size="sm"
        className="h-9 px-2"
        onClick={onOpenSettings}
      >
        <Settings className="w-4 h-4" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>Settings</TooltipContent>
  </Tooltip>
</TooltipProvider>
```

**Props pattern** (presentational, callbacks only):
```typescript
interface ExplorerNavBarProps {
  onHome: () => void;
  onOpenSettings: () => void;
}
```

---

### `src/features/explorer/components/explorer-empty-state.tsx` (component, request-response)

**Analog:** `src/App.tsx` lines 420-424 (empty state) + `src/features/connection/components/home-screen.tsx` lines 26-36 (centered layout)

**Empty state centering pattern** (App.tsx lines 420-423):
```typescript
<div className="flex items-center justify-center h-full text-muted-foreground">
  <p>Select a database from the toolbar.</p>
</div>
```

**Centered content column pattern** (home-screen.tsx lines 26-36):
```typescript
<div className="h-screen flex flex-col items-center justify-center bg-muted p-8">
  {/* Hero - Logo and Title */}
  <div className="flex items-center mb-12">
    ...
  </div>
  {/* Action Buttons */}
  <div className="flex flex-col gap-2 w-80">
    ...
  </div>
</div>
```

**Button with icon pattern** (home-screen.tsx lines 68-79, Settings button):
```typescript
<Button
  variant="outline"
  className="w-full h-12 justify-between px-4"
  onClick={onOpenSettings}
>
  <span className="flex items-center gap-3">
    <Settings className="w-5 h-5" />
    Settings
  </span>
</Button>
```

**Icon import** -- uses `FolderSync` and `Settings` from lucide-react:
```typescript
import { FolderSync, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
```

---

### `src/features/schema-graph/store.ts` (MODIFY -- add explorer mode)

**Analog:** Self -- canvas mode pattern at lines 1077-1106

**Mode type** (store.ts line 64):
```typescript
mode: "connected" | "canvas";
```
Change to:
```typescript
mode: "connected" | "canvas" | "explorer";
```

**Canvas mode enter/exit pattern** (store.ts lines 1077-1106):
```typescript
enterCanvasMode: (schema?, positions?, filePath?) => {
  const s = schema ?? { ...EMPTY_SCHEMA };
  const schemas = getAvailableSchemas(s);
  set({
    mode: "canvas",
    schema: s,
    canvasFilePath: filePath ?? null,
    canvasIsDirty: false,
    nodePositions: positions ?? {},
    availableSchemas: schemas,
    isConnected: false,
    connectionInfo: null,
    serverConnection: null,
    availableDatabases: [],
    selectedDatabase: null,
    searchFilter: "",
    debouncedSearchFilter: "",
    schemaFilter: "all",
    focusedTableId: null,
    ...createDefaultObjectFilterState(),
    edgeTypeFilter: new Set(ALL_EDGE_TYPES),
    selectedEdgeIds: new Set<string>(),
    error: null,
  });
},

exitCanvasMode: () =>
  set({
    ...createInitialSchemaState(),
  }),
```

Explorer mode is simpler -- per RESEARCH.md, it only sets `mode` without touching other state:
```typescript
enterExplorerMode: () => set({ mode: "explorer" }),
exitExplorerMode: () => set({ mode: "connected" }),
```

**Interface additions** (add alongside lines 119-125):
```typescript
enterExplorerMode: () => void;
exitExplorerMode: () => void;
```

---

### `src/App.tsx` (MODIFY -- add explorer conditional)

**Analog:** Self -- canvas mode integration

**Mode derived state pattern** (App.tsx line 96):
```typescript
const isCanvasMode = mode === "canvas";
```
Add:
```typescript
const isExplorerMode = mode === "explorer";
```

**Store selector pattern** (App.tsx lines 28-82) -- add `enterExplorerMode` and `exitExplorerMode` to the existing `useShallow` selector.

**Callback handler pattern** (App.tsx lines 163-166):
```typescript
const handleEnterCanvasMode = useCallback(() => {
  if (isCanvasMode) return;
  requestCanvasAction("enter");
}, [isCanvasMode, requestCanvasAction]);
```
Explorer equivalent is simpler (no dirty-state guard):
```typescript
const handleEnterExplorer = useCallback(() => {
  enterExplorerMode();
}, [enterExplorerMode]);

const handleExitExplorer = useCallback(() => {
  exitExplorerMode();
}, [exitExplorerMode]);
```

**Keyboard shortcut pattern** (App.tsx lines 266-282):
```typescript
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key === "k") {
      e.preventDefault();
      if (!isCanvasMode) {
        handleEnterCanvasMode();
      }
    }
    if (mod && e.key === "s" && isCanvasMode) {
      e.preventDefault();
      void handleCanvasSave();
    }
  };
  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}, [isCanvasMode, handleEnterCanvasMode, handleCanvasSave]);
```
Add `Cmd+E` inside the same handler:
```typescript
if (mod && e.key === "e") {
  e.preventDefault();
  if (!isExplorerMode) {
    handleEnterExplorer();
  }
}
```

**showHome conditional pattern** (App.tsx line 357-358):
```typescript
const showHome =
  !schema && mode !== "canvas" && (!isConnected || !serverConnection);
```
Update to exclude explorer:
```typescript
const showHome =
  !schema && mode !== "canvas" && mode !== "explorer"
  && (!isConnected || !serverConnection);
```

**Conditional rendering pattern** (App.tsx lines 384-429):
```typescript
{showHome ? (
  <HomeScreen
    onOpenConnectionModal={() => setConnectionModalOpen(true)}
    onOpenSettings={() => setSettingsOpen(true)}
    onOpenAbout={() => setAboutOpen(true)}
    onEnterCanvasMode={handleEnterCanvasMode}
  />
) : (
  <ReactFlowProvider>
    ...
  </ReactFlowProvider>
)}
```
Add explorer branch between showHome and the ReactFlowProvider:
```typescript
{showHome ? (
  <HomeScreen ... onEnterExplorer={handleEnterExplorer} />
) : isExplorerMode ? (
  <ExplorerShell
    onHome={handleExitExplorer}
    onOpenSettings={() => setSettingsOpen(true)}
  />
) : (
  <ReactFlowProvider>...</ReactFlowProvider>
)}
```

---

### `src/features/connection/components/home-screen.tsx` (MODIFY -- add explorer button)

**Analog:** Self -- Canvas Mode button at lines 54-66

**Props interface pattern** (home-screen.tsx lines 6-11):
```typescript
interface HomeScreenProps {
  onOpenConnectionModal?: () => void;
  onOpenSettings?: () => void;
  onOpenAbout?: () => void;
  onEnterCanvasMode?: () => void;
}
```
Add: `onEnterExplorer?: () => void;`

**Button pattern** (home-screen.tsx lines 54-66):
```typescript
<Button
  variant="outline"
  className="w-full h-12 justify-between px-4"
  onClick={onEnterCanvasMode}
>
  <span className="flex items-center gap-3">
    <PenTool className="w-5 h-5" />
    Canvas Mode
  </span>
  <kbd className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
    {modKey}+K
  </kbd>
</Button>
```
New button placed after Canvas Mode, before Settings (per D-09):
```typescript
<Button
  variant="outline"
  className="w-full h-12 justify-between px-4"
  onClick={onEnterExplorer}
>
  <span className="flex items-center gap-3">
    <FolderSync className="w-5 h-5" />
    Integration Explorer
  </span>
  <kbd className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
    {modKey}+E
  </kbd>
</Button>
```

**Icon import** (home-screen.tsx line 1):
```typescript
import { Server, Settings, Info, PenTool } from "lucide-react";
```
Add `FolderSync` to this import.

---

## Shared Patterns

### Presentational Component Convention
**Source:** `CLAUDE.md` + all components
**Apply to:** All 3 new explorer components

Components receive callbacks as props. No direct store access. No Tauri IPC calls. Example from home-screen.tsx:
```typescript
interface HomeScreenProps {
  onOpenConnectionModal?: () => void;
  onOpenSettings?: () => void;
  onOpenAbout?: () => void;
  onEnterCanvasMode?: () => void;
}

export function HomeScreen({ ... }: HomeScreenProps) {
  // Pure rendering, event handlers call props
}
```

### shadcn/ui Button Usage
**Source:** `src/components/ui/button.tsx` via home-screen.tsx
**Apply to:** `explorer-nav-bar.tsx`, `explorer-empty-state.tsx`
```typescript
import { Button } from "@/components/ui/button";
// Variants: "outline" for toolbar/nav buttons, "default" for primary CTA
```

### Tooltip Pattern
**Source:** `src/features/toolbar/components/toolbar.tsx` lines 951-965
**Apply to:** `explorer-nav-bar.tsx`
```typescript
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

<TooltipProvider>
  <Tooltip>
    <TooltipTrigger asChild>
      <Button variant="outline" size="sm" className="h-9 px-2" onClick={handler}>
        <Icon className="w-4 h-4" />
      </Button>
    </TooltipTrigger>
    <TooltipContent>Label</TooltipContent>
  </Tooltip>
</TooltipProvider>
```

### Zustand Store Test Pattern
**Source:** `src/features/schema-graph/store.test.ts` lines 1-54
**Apply to:** New `src/features/explorer/store-integration.test.ts`
```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSchemaStore, createInitialSchemaState } from "./store";

vi.mock("./services/schema-service", () => ({
  schemaService: {
    loadSchema: vi.fn(),
    loadMockSchema: vi.fn(),
  },
}));

vi.mock("@/features/settings/services/settings-service", () => ({
  settingsService: {
    saveSettings: vi.fn(),
  },
}));

describe("explorer mode", () => {
  beforeEach(() => {
    useSchemaStore.setState(createInitialSchemaState());
    vi.clearAllMocks();
  });

  it("enters explorer mode", () => {
    useSchemaStore.getState().enterExplorerMode();
    expect(useSchemaStore.getState().mode).toBe("explorer");
  });
});
```

## No Analog Found

No files lack an analog. Every new/modified file has an exact or strong role-match analog in the existing codebase. This phase is entirely pattern-following -- no novel architecture is introduced.

## Metadata

**Analog search scope:** `src/App.tsx`, `src/features/connection/components/`, `src/features/schema-graph/`, `src/features/toolbar/components/`
**Files scanned:** 6 analogs read
**Pattern extraction date:** 2026-05-22
