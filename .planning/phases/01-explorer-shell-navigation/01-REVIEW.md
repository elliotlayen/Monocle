---
phase: 01-explorer-shell-navigation
reviewed: 2026-05-22T00:00:00Z
depth: standard
files_reviewed: 7
files_reviewed_list:
  - src/features/explorer/store-integration.test.ts
  - src/features/explorer/components/explorer-nav-bar.tsx
  - src/features/explorer/components/explorer-empty-state.tsx
  - src/features/explorer/components/explorer-shell.tsx
  - src/features/schema-graph/store.ts
  - src/features/connection/components/home-screen.tsx
  - src/App.tsx
findings:
  critical: 2
  warning: 4
  info: 1
  total: 7
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-05-22T00:00:00Z
**Depth:** standard
**Files Reviewed:** 7
**Status:** issues_found

## Summary

Seven files were reviewed covering the explorer shell navigation feature. The feature introduces a third app mode (`explorer`) alongside the existing `connected` and `canvas` modes, adds `enterExplorerMode` / `exitExplorerMode` actions to the Zustand store, wires them into `App.tsx`, and ships `ExplorerShell`, `ExplorerNavBar`, and `ExplorerEmptyState` components.

Two blockers were found. Both stem from the same root cause: `exitExplorerMode` unconditionally hardcodes `mode: "connected"` with no memory of the previous mode, and `enterExplorerMode` can be triggered from canvas mode without any dirty-state guard. Together these bugs produce either unsaved-work loss or a broken UI state. Four warnings cover a duplicate store action, deprecated browser API, dead code, and domain-mismatched copy. One info item flags a missing regression test.

---

## Critical Issues

### CR-01: Entering explorer from canvas mode then exiting corrupts app state

**File:** `src/App.tsx:289-292` and `src/features/schema-graph/store.ts:1081-1082`

**Issue:** `exitExplorerMode` always sets `mode: "connected"` regardless of the mode that was active before explorer was entered. When a user is in canvas mode (`mode === "canvas"`) and presses `Cmd+E`, `handleEnterExplorer` fires unconditionally (the only guard at line 291 is `!isExplorerMode`, which is true in canvas mode). After pressing Home in the `ExplorerNavBar`, `exitExplorerMode` sets `mode: "connected"`. The canvas schema and `nodePositions` are still in state, but `isCanvasMode` is now `false`, so `canvasMode={isCanvasMode}` passed to `Toolbar` and `SchemaGraphView` resolves to `false`. The canvas-specific toolbar controls (Save, Open, Export…) disappear, canvas CRUD actions on the graph are disabled (`if (state.mode !== "canvas" || !state.schema) return`), and any unsaved canvas changes are silently abandoned without the `CanvasDirtyDialog` being shown.

**Fix:** Track the previous mode before entering explorer and restore it on exit. Minimal fix:

```typescript
// In SchemaStore interface, add:
previousMode: "connected" | "canvas" | null;

// enterExplorerMode — save current mode before switching
enterExplorerMode: () =>
  set((state) => ({
    previousMode: state.mode !== "explorer" ? state.mode : state.previousMode,
    mode: "explorer",
  })),

// exitExplorerMode — restore previous mode, fall back to "connected"
exitExplorerMode: () =>
  set((state) => ({
    mode: state.previousMode ?? "connected",
    previousMode: null,
  })),
```

Additionally, `handleEnterExplorer` in `App.tsx` must respect the canvas dirty check — either gate it the same way as `requestCanvasAction`, or at minimum prevent entry from canvas mode while dirty:

```typescript
const handleEnterExplorer = useCallback(() => {
  if (isCanvasMode && canvasIsDirty) {
    // show dirty dialog or block entry
    return;
  }
  enterExplorerMode();
}, [isCanvasMode, canvasIsDirty, enterExplorerMode]);
```

---

### CR-02: Cmd+E keyboard shortcut enters explorer from canvas mode without dirty-state guard

**File:** `src/App.tsx:289-293`

**Issue:** The keyboard handler at lines 289-292 calls `handleEnterExplorer()` whenever `!isExplorerMode` and `Cmd+E` is pressed. This fires even when `isCanvasMode === true` and `canvasIsDirty === true`. Unlike the canvas "exit", "open", and "enter" actions — which are all funneled through `requestCanvasAction` and show `CanvasDirtyDialog` — the explorer entry path has no such guard. A user with unsaved canvas edits who presses `Cmd+E` by accident will lose those edits when they later press Home (due to CR-01), with no warning dialog.

**Fix:** Wrap the explorer entry in `requestCanvasAction` (add an `"enterExplorer"` action type) or at minimum add an early return when dirty canvas is active:

```typescript
if (mod && e.key === "e") {
  e.preventDefault();
  if (!isExplorerMode) {
    if (isCanvasMode && canvasIsDirty) {
      // Treat same as any other canvas-leaving action
      setPendingCanvasAction("enterExplorer");
      setCanvasDirtyDialogOpen(true);
    } else {
      handleEnterExplorer();
    }
  }
}
```

---

## Warnings

### WR-01: `disconnectServer` and `disconnect` are identical duplicate functions

**File:** `src/features/schema-graph/store.ts:891-908` and `1061-1078`

**Issue:** The two implementations are byte-for-byte identical (diffing them produces only a name change). Both exist in the `SchemaStore` interface (lines 96 and 117) and both are implemented. Callers pick one arbitrarily. Any future change to the disconnect logic must be made in two places — omitting one will silently diverge behavior.

**Fix:** Remove `disconnectServer` from the interface and its implementation. Update any callers to use `disconnect`.

```typescript
// Remove from SchemaStore interface:
disconnectServer: () => void;   // line 96 — delete this

// Remove from store implementation:
disconnectServer: () => set({ ... }),   // lines 891-908 — delete this
```

---

### WR-02: `navigator.platform` is deprecated

**File:** `src/features/connection/components/home-screen.tsx:22-25`

**Issue:** `navigator.platform` was deprecated in the WHATWG Living Standard. Browsers still expose it but may return inconsistent values or remove it in future versions. In a Tauri app this is particularly avoidable since the OS is known at compile time.

**Fix:** Use `navigator.userAgentData?.platform` with a fallback, or import Tauri's `os` plugin which provides a reliable `platform()` API:

```typescript
// Option A: userAgentData with fallback
const isMac =
  (navigator.userAgentData?.platform ?? navigator.platform ?? "")
    .toUpperCase()
    .includes("MAC");

// Option B (preferred for Tauri): use @tauri-apps/plugin-os
import { platform } from "@tauri-apps/plugin-os";
// then in an effect or at app init, set a context value
```

---

### WR-03: Dead code — `createdAt` ternary always produces the same value

**File:** `src/App.tsx:191-194`

**Issue:** The `createdAt` field in `handleCanvasSave` is computed as:

```typescript
createdAt: canvasFilePath
  ? new Date().toISOString()
  : new Date().toISOString(),
```

Both branches are identical — `new Date().toISOString()`. The intended logic almost certainly meant to preserve the original creation timestamp when saving an existing file (i.e. the `canvasFilePath` branch should read the existing `createdAt` from the loaded file). As written, every save overwrites `createdAt` with the current time, making the field semantically useless.

**Fix:** Store `createdAt` in state (or in the loaded file data) and thread it through here:

```typescript
createdAt: existingCreatedAt ?? new Date().toISOString(),
lastModifiedAt: new Date().toISOString(),
```

---

### WR-04: `explorer-empty-state.tsx` describes the wrong product domain

**File:** `src/features/explorer/components/explorer-empty-state.tsx:14-17`

**Issue:** The descriptive paragraph reads: "Browse, search, and validate XML integration files from your configured folder sources." Monocle is a SQL Server schema visualizer; it has no XML integration file feature. This copy was apparently borrowed from a different product context and was not updated. A user reading this screen will be confused about what the explorer actually does.

**Fix:** Update the copy to describe what the integration explorer actually does within this application, or use a placeholder that makes clear the feature is in progress:

```tsx
<p className="text-sm text-muted-foreground max-w-sm">
  Connect a folder to browse and explore schema integration objects.
  Configure a source folder in Settings to get started.
</p>
```

---

## Info

### IN-01: No test covers the canvas-to-explorer-to-exit mode regression

**File:** `src/features/explorer/store-integration.test.ts`

**Issue:** The four tests only cover `connected -> explorer -> connected` transitions. There is no test for `canvas -> explorer -> exit` to assert that the prior mode is preserved. This is the exact path that triggers CR-01 and CR-02. The absence of this test allowed the bug to ship.

**Fix:** Add a test case:

```typescript
it("exitExplorerMode restores canvas mode when entered from canvas", () => {
  useSchemaStore.getState().enterCanvasMode();
  expect(useSchemaStore.getState().mode).toBe("canvas");

  useSchemaStore.getState().enterExplorerMode();
  expect(useSchemaStore.getState().mode).toBe("explorer");

  useSchemaStore.getState().exitExplorerMode();
  expect(useSchemaStore.getState().mode).toBe("canvas");
});
```

---

_Reviewed: 2026-05-22T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
