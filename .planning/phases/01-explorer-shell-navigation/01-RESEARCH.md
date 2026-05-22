# Phase 1: Explorer Shell & Navigation - Research

**Researched:** 2026-05-22
**Domain:** React component architecture, Zustand state management, Tauri desktop app mode switching
**Confidence:** HIGH

## Summary

Phase 1 adds a new "explorer" mode to the existing Monocle Tauri desktop app. The app already has two modes ("connected" for schema graph, "canvas" for freeform editing) managed via a Zustand store. This phase adds a third mode with its own full-screen shell containing a nav bar and empty state. No new external packages are required -- everything uses existing shadcn/ui components and lucide-react icons already installed.

The critical integration point is `App.tsx`, which uses a `showHome` conditional (line 357) to decide whether to render `HomeScreen` or the connected view. Explorer mode needs its own branch in this conditional. The mode state lives in `useSchemaStore` (currently typed as `"connected" | "canvas"`) and needs `"explorer"` added.

**Primary recommendation:** Follow the existing canvas mode pattern exactly -- add `"explorer"` to the mode union, add `enterExplorerMode`/`exitExplorerMode` actions to the store, add a conditional branch in App.tsx, and create three new components under `src/features/explorer/components/`.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Explorer gets its own dedicated nav bar, separate from Schema Graph and Canvas toolbars. There is no shared cross-mode tab bar -- users switch modes from the home screen.
- **D-02:** The Explorer nav bar is minimal: app name/logo on the left, a Home button to return to the home screen, and a settings gear on the right. Placeholder space for future controls (search, filters, etc. in later phases).
- **D-03:** Only the Explorer gets a home button. Schema Graph and Canvas modes keep their existing toolbars unchanged -- they already have disconnect/exit buttons.
- **D-04:** Clicking Home in the Explorer instantly returns to the home screen. No "dirty state" dialog -- Explorer is read-only, so there's nothing to lose.
- **D-05:** The empty content area shows a getting-started guide: feature name ("Integration Explorer"), brief description of what it does, instruction to configure folder sources in Settings, and an "Open Settings" action button. Modeled after VS Code's "Open a folder to get started" pattern.
- **D-06:** No sidebar in Phase 1. The content area takes the full width. The sidebar appears in Phase 2 when folder sources are configured.
- **D-07:** The explorer sidebar (arriving in Phase 2) will be resizable via a drag handle. Width persists across sessions.
- **D-08:** The sidebar will be collapsible via a toggle button, matching the existing schema-browser-sidebar toggle pattern.
- **D-09:** Integration Explorer button placed below Canvas Mode in the home screen button list. Order: Connect to Server, Canvas Mode, Integration Explorer, Settings, About.
- **D-10:** Same outline button style as existing buttons -- no special prominence.
- **D-11:** Uses the `FolderSync` Lucide icon.
- **D-12:** Keyboard shortcut: Cmd+E (Ctrl+E on Windows).
- **D-13:** Explorer matches the existing app's visual style exactly -- same shadcn/ui components, same visual density, same color palette. No special styling for the broader audience.

### Claude's Discretion
None specified -- all decisions were locked in context.

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BRWS-09 | Integration Explorer is accessible from the home screen as a new button and has a top navigation bar consistent with other modes | Full codebase analysis of App.tsx, HomeScreen, Toolbar, and store.ts provides exact integration points. UI-SPEC defines all visual contracts. |

</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Mode switching (home -> explorer) | Frontend (React) | -- | Pure client-side state transition via Zustand store; no backend involvement |
| Explorer shell layout | Frontend (React) | -- | CSS flex layout, no server rendering |
| Nav bar with Home/Settings buttons | Frontend (React) | -- | Presentational component with callbacks |
| Empty state content | Frontend (React) | -- | Static content, no data fetching |
| Keyboard shortcut (Cmd+E) | Frontend (React) | -- | Window keydown event listener in App.tsx |
| Settings dialog opening | Frontend (React) | -- | Reuses existing `AppSettingsSheet` component and state |

## Standard Stack

### Core (already installed -- no new packages)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | ^19.1.0 | UI framework | Already in project [VERIFIED: package.json] |
| zustand | ^5.0.9 | State management (mode switching) | Already in project, manages all app state [VERIFIED: package.json] |
| lucide-react | ^0.555.0 | Icons (FolderSync, Home, Settings) | Already in project [VERIFIED: package.json] |
| @radix-ui/react-tooltip | ^1.2.8 | Tooltip for nav bar buttons | Already in project via shadcn/ui [VERIFIED: package.json] |
| tailwindcss | ^4.1.17 | Styling | Already in project [VERIFIED: package.json] |

### Supporting (already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| class-variance-authority | ^0.7.1 | Button variant styling | Used by shadcn Button component |
| zustand/shallow | (bundled) | Shallow equality for store selectors | Prevent unnecessary re-renders |

### Alternatives Considered

None -- this phase uses only existing project dependencies. No new packages needed.

**Installation:**
```bash
# No installation needed -- all dependencies already present
```

## Package Legitimacy Audit

No new packages are installed in this phase. All referenced libraries are already present in package.json and in active use throughout the codebase.

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
User Action                          App.tsx                           Store
    |                                  |                                |
    | Click "Integration Explorer"     |                                |
    | or press Cmd+E                   |                                |
    |--------------------------------->|                                |
    |                                  | enterExplorerMode()            |
    |                                  |------------------------------->|
    |                                  |                                | set({ mode: "explorer" })
    |                                  |<-------------------------------|
    |                                  |                                |
    |                                  | showHome=false                 |
    |                                  | isExplorerMode=true            |
    |                                  |                                |
    |   <ExplorerShell>                |                                |
    |     <ExplorerNavBar              |                                |
    |       onHome={exitExplorerMode}  |                                |
    |       onSettings={openSettings}/>|                                |
    |     <ExplorerEmptyState          |                                |
    |       onOpenSettings />          |                                |
    |   </ExplorerShell>               |                                |
    |                                  |                                |
    | Click Home button                |                                |
    |--------------------------------->|                                |
    |                                  | exitExplorerMode()             |
    |                                  |------------------------------->|
    |                                  |                                | set({ mode: "connected" })
    |                                  |<-------------------------------|
    |                                  | showHome=true                  |
    |   <HomeScreen />                 |                                |
```

### Recommended Project Structure

```
src/features/explorer/
  components/
    explorer-shell.tsx         # Full-screen layout: nav bar + content area
    explorer-nav-bar.tsx       # Horizontal bar: logo, spacer, home + settings buttons
    explorer-empty-state.tsx   # Getting-started content with CTA
```

### Pattern 1: Mode State Extension

**What:** Add `"explorer"` to the existing mode union type in the Zustand store, plus enter/exit actions.

**When to use:** Whenever a new full-screen mode is added to the app.

**Example:**
```typescript
// In store.ts -- extend the mode type
// Current: mode: "connected" | "canvas"
// New:     mode: "connected" | "canvas" | "explorer"

// Add to SchemaStore interface:
enterExplorerMode: () => void;
exitExplorerMode: () => void;

// Implementation:
enterExplorerMode: () => set({ mode: "explorer" }),
exitExplorerMode: () => set({ mode: "connected" }),
```
Source: Analysis of existing `enterCanvasMode` / `exitCanvasMode` pattern at store.ts lines 1077-1106 [VERIFIED: codebase]

### Pattern 2: Conditional Rendering in App.tsx

**What:** The root App component uses conditionals to render the correct mode view.

**When to use:** When determining which top-level view to show.

**Example:**
```typescript
// Current showHome logic (App.tsx line 357):
const showHome = !schema && mode !== "canvas" && (!isConnected || !serverConnection);

// Updated logic -- Explorer mode should NOT show home:
const showHome = !schema && mode !== "canvas" && mode !== "explorer"
  && (!isConnected || !serverConnection);

// New derived state:
const isExplorerMode = mode === "explorer";

// In JSX render:
{showHome ? (
  <HomeScreen ... onEnterExplorer={handleEnterExplorer} />
) : isExplorerMode ? (
  <ExplorerShell
    onHome={handleExitExplorer}
    onOpenSettings={() => setSettingsOpen(true)}
  />
) : (
  <ReactFlowProvider>
    {/* existing schema/canvas view */}
  </ReactFlowProvider>
)}
```
Source: Analysis of App.tsx lines 357-429 [VERIFIED: codebase]

### Pattern 3: Home Screen Button Addition

**What:** Add a new button to the HomeScreen component following the exact pattern of existing buttons.

**When to use:** When adding a new mode entry point.

**Example:**
```typescript
// In HomeScreen -- add onEnterExplorer prop and button after Canvas Mode
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
Source: home-screen.tsx lines 53-66 (Canvas Mode button pattern) [VERIFIED: codebase]

### Pattern 4: Keyboard Shortcut Registration

**What:** Register Cmd+E in the existing keyboard handler in App.tsx.

**When to use:** For new global keyboard shortcuts.

**Example:**
```typescript
// In App.tsx useEffect keyboard handler (lines 266-282):
if (mod && e.key === "e") {
  e.preventDefault();
  if (!isExplorerMode) {
    handleEnterExplorer();
  }
}
```
Source: Existing Cmd+K handler pattern at App.tsx lines 269-274 [VERIFIED: codebase]

### Pattern 5: Nav Bar Component

**What:** The ExplorerNavBar follows the exact same container classes as the existing Toolbar.

**When to use:** When creating mode-specific toolbars.

**Example:**
```typescript
// Toolbar.tsx line 484 provides the canonical container classes:
<div className="relative z-20 flex items-center gap-3 px-3 py-2 bg-background border-b border-border">
```
Source: toolbar.tsx line 484 [VERIFIED: codebase]

### Anti-Patterns to Avoid

- **Shared toolbar component:** Do NOT attempt to make the Toolbar component handle Explorer mode. D-01 explicitly requires separate nav bars. The existing Toolbar is deeply coupled to schema/canvas state.
- **New Zustand store for explorer:** Do NOT create a separate store. The `mode` field already lives in `useSchemaStore` and the existing pattern extends it (canvas added the same way). Creating a second store would split mode state across stores.
- **Direct Tauri IPC in components:** Per CLAUDE.md, components are presentational only. The ExplorerShell receives callbacks as props. No direct store access in leaf components where avoidable.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tooltip behavior | Custom tooltip | shadcn `Tooltip` component (already installed) | Handles positioning, delay, accessibility |
| Button variants | Custom styled buttons | shadcn `Button` with `variant="outline"` | Consistent with entire app |
| Icon set | SVG icons | `lucide-react` FolderSync, Home, Settings icons | Already used throughout; `FolderSync` confirmed present |
| Settings dialog | New settings panel | Existing `AppSettingsSheet` component | Already handles all settings UI; opened via `setSettingsOpen(true)` |
| Mode state management | Custom context/reducer | Zustand `useSchemaStore.mode` | Already manages all app state including mode switching |

**Key insight:** Phase 1 requires zero new infrastructure. Every UI primitive, state management pattern, and component library is already in the project. The entire phase is wiring new components into existing patterns.

## Common Pitfalls

### Pitfall 1: Breaking the showHome Conditional

**What goes wrong:** Adding Explorer mode without updating the `showHome` conditional causes the app to show the schema/canvas view instead of the explorer when no schema is loaded.
**Why it happens:** The current logic `!schema && mode !== "canvas" && (!isConnected || !serverConnection)` does not account for `mode === "explorer"`. When Explorer mode is active and `showHome` evaluates to `true`, the home screen shows instead of the explorer.
**How to avoid:** Update `showHome` to exclude explorer mode: `mode !== "explorer"`. Then add an `isExplorerMode` check before the ReactFlowProvider block.
**Warning signs:** Clicking "Integration Explorer" shows the home screen again or shows the empty schema view.

### Pitfall 2: Canvas Mode Dirty State Interaction

**What goes wrong:** Entering Explorer mode while canvas has unsaved changes loses the dirty state silently.
**Why it happens:** `enterCanvasMode` resets all state. If Explorer mode naively sets `mode: "explorer"`, it doesn't trigger the canvas dirty dialog.
**How to avoid:** Explorer mode entry should be gated behind the same dirty-state check as other mode transitions, OR (simpler for MVP) explorer entry from the home screen means canvas is already exited. Since explorer entry only happens from the home screen (per D-01), and getting to the home screen from canvas already triggers the dirty dialog, this is not actually a problem in practice.
**Warning signs:** Look for any code path that enters Explorer directly from canvas mode without going through home first.

### Pitfall 3: State Leaking Between Modes

**What goes wrong:** Entering Explorer mode while connected to a database, then returning home, loses the database connection.
**Why it happens:** If `enterExplorerMode` resets connection state (following the canvas pattern which resets everything), the schema/connection data is lost.
**How to avoid:** Explorer mode entry should ONLY set `mode: "explorer"` without touching any other state. Unlike canvas mode (which creates a fresh schema), explorer mode has no schema state to manage. Exit should set `mode: "connected"` to return to whatever state existed before.
**Warning signs:** After entering and exiting Explorer, the schema graph toolbar shows "no connection" or the database selector is empty.

### Pitfall 4: Keyboard Shortcut Conflicts

**What goes wrong:** Cmd+E might conflict with other functionality or fire when the user is typing in an input field.
**Why it happens:** The keydown handler fires on any keypress with the meta/ctrl modifier.
**How to avoid:** Check that Cmd+E is not already bound (verified: it is not -- only Cmd+K and Cmd+S are registered). Consider whether to prevent the shortcut when focus is in an input/textarea (existing shortcuts don't do this, so follow the same convention).
**Warning signs:** Pressing Cmd+E while typing in the search bar triggers mode switch.

### Pitfall 5: Forgetting the FolderSync Import

**What goes wrong:** TypeScript compiles but the icon doesn't render.
**Why it happens:** `FolderSync` is a less common lucide icon. Developers might use `Folder` instead.
**How to avoid:** Use the exact import: `import { FolderSync } from "lucide-react"`. Verified the icon exists in the installed lucide-react@0.555.0 at `node_modules/lucide-react/dist/esm/icons/folder-sync.js`.
**Warning signs:** The button appears but without an icon, or with a different icon.

## Code Examples

### Explorer Shell Component

```typescript
// src/features/explorer/components/explorer-shell.tsx
// Source: UI-SPEC layout specification + existing App.tsx pattern
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
Source: UI-SPEC layout + App.tsx line 393 container pattern [VERIFIED: codebase + UI-SPEC]

### Explorer Nav Bar Component

```typescript
// src/features/explorer/components/explorer-nav-bar.tsx
// Source: UI-SPEC nav bar specification + toolbar.tsx line 484
import { Home, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

interface ExplorerNavBarProps {
  onHome: () => void;
  onOpenSettings: () => void;
}

export function ExplorerNavBar({ onHome, onOpenSettings }: ExplorerNavBarProps) {
  return (
    <div className="relative z-20 flex items-center gap-3 px-3 py-2 bg-background border-b border-border">
      <span
        className="font-semibold text-base"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        Monocle
      </span>
      <div className="flex-1" />
      <div className="flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-2"
                onClick={onHome}
              >
                <Home className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Home</TooltipContent>
          </Tooltip>
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
      </div>
    </div>
  );
}
```
Source: UI-SPEC nav bar spec + toolbar.tsx lines 484-492, 951-965 [VERIFIED: codebase + UI-SPEC]

### Explorer Empty State Component

```typescript
// src/features/explorer/components/explorer-empty-state.tsx
// Source: UI-SPEC empty state specification
import { FolderSync, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ExplorerEmptyStateProps {
  onOpenSettings: () => void;
}

export function ExplorerEmptyState({ onOpenSettings }: ExplorerEmptyStateProps) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-3 text-center">
        <FolderSync className="w-10 h-10 text-muted-foreground mb-1" />
        <h2 className="text-xl font-semibold">Integration Explorer</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Browse, search, and validate XML integration files from your
          configured folder sources.
        </p>
        <Button className="mt-6" onClick={onOpenSettings}>
          <Settings className="w-4 h-4" />
          Open Settings
        </Button>
      </div>
    </div>
  );
}
```
Source: UI-SPEC empty state spec + App.tsx lines 421-423 empty state pattern [VERIFIED: codebase + UI-SPEC]

### Store Mode Extension

```typescript
// In store.ts -- additions to SchemaStore interface and implementation
// Source: existing enterCanvasMode/exitCanvasMode pattern

// Type update:
mode: "connected" | "canvas" | "explorer";

// Interface additions:
enterExplorerMode: () => void;
exitExplorerMode: () => void;

// Implementation:
enterExplorerMode: () => set({ mode: "explorer" }),
exitExplorerMode: () => set({ mode: "connected" }),
```
Source: store.ts lines 1077-1106 (canvas mode pattern) [VERIFIED: codebase]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Multiple Zustand stores per feature | Single store with mode field | Existing pattern | All mode state lives in one store; Explorer follows this |
| React Router for navigation | Conditional rendering in App.tsx | Existing pattern | No router -- mode switching is state-driven |
| Separate toolbar per mode | Shared toolbar with mode-aware rendering | Existing (schema/canvas share Toolbar) | Explorer breaks this -- gets its own nav bar per D-01 |

**Deprecated/outdated:**
- Nothing in this phase touches deprecated APIs. All React 19 patterns are used (functional components, hooks).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Explorer mode entry only happens from the home screen, never directly from canvas/schema mode | Common Pitfalls | If Explorer can be entered from connected mode, state preservation logic needs to be more careful |
| A2 | The `FolderSync` icon at lucide-react@0.555.0 renders correctly | Code Examples | Would need a different icon; verified file exists but not visually confirmed |
| A3 | Cmd+E is not already bound to any OS-level or Tauri-level action | Common Pitfalls | If bound, the shortcut would need a different key combination |

**Note:** A1 is strongly supported by D-01 ("users switch modes from the home screen") and the app architecture (the explorer button is on the home screen). A2 is verified by file existence. A3 is verified by scanning the keydown handler and menu events -- no existing `"e"` binding found.

## Open Questions

1. **Should `enterExplorerMode` preserve or reset schema/connection state?**
   - What we know: Canvas mode resets everything because it creates a new schema. Explorer has no schema.
   - What's unclear: If a user connects to a database, goes home, enters Explorer, then goes home again, should the database connection still be active?
   - Recommendation: Preserve state. `enterExplorerMode` sets only `mode: "explorer"`. `exitExplorerMode` sets `mode: "connected"`. This is the simplest approach and matches D-04 (no state to lose). The user's schema connection survives the round trip.

2. **Should the Cmd+E shortcut work from any mode or only from the home screen?**
   - What we know: D-12 says "Cmd+E" for the shortcut. The canvas Cmd+K shortcut only fires `if (!isCanvasMode)`.
   - What's unclear: Whether Cmd+E should also work when already in schema/canvas mode to switch to Explorer.
   - Recommendation: For MVP, only handle Cmd+E when on the home screen (mirroring Cmd+K pattern). This avoids the state-preservation complexity of switching between active modes.

## Project Constraints (from CLAUDE.md)

| Directive | Category |
|-----------|----------|
| Components are presentational only -- props in, UI out, no direct Tauri IPC calls | Architecture |
| Use shadcn/ui for UI components | Technology |
| No emojis in code, comments, commits, or documentation | Code Style |
| Commit messages: no "Generated with Claude Code" or "Co-Authored-By" lines | Code Style |
| Run `npm run lint` at end of task | Validation |
| Run `npm run build` (includes typecheck) at end of task | Validation |
| Feature-based directory structure: `src/features/{name}/components/` | Architecture |

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest ^2.1.2 |
| Config file | `vitest.config.ts` (environment: node, clearMocks: true) |
| Quick run command | `npm run test -- --run` |
| Full suite command | `npm run test -- --run` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BRWS-09a | Entering explorer mode sets mode to "explorer" | unit | `npx vitest run src/features/explorer/store-integration.test.ts` | No -- Wave 0 |
| BRWS-09b | Exiting explorer mode sets mode to "connected" | unit | `npx vitest run src/features/explorer/store-integration.test.ts` | No -- Wave 0 |
| BRWS-09c | Explorer mode preserves schema/connection state | unit | `npx vitest run src/features/explorer/store-integration.test.ts` | No -- Wave 0 |
| BRWS-09d | showHome is false when mode is "explorer" | unit | `npx vitest run src/features/explorer/store-integration.test.ts` | No -- Wave 0 |
| BRWS-09e | Home screen renders explorer button | manual-only | Visual check -- no DOM test framework configured | N/A |
| BRWS-09f | Keyboard shortcut Cmd+E enters explorer | manual-only | Requires browser event simulation not available in node env | N/A |

### Sampling Rate

- **Per task commit:** `npm run test -- --run`
- **Per wave merge:** `npm run test -- --run && npm run build`
- **Phase gate:** Full suite green + `npm run lint` + `npm run build` before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/features/explorer/store-integration.test.ts` -- covers BRWS-09a through BRWS-09d (store mode transitions and state preservation)
- [ ] Tests should import `useSchemaStore` directly and test the store actions, following the pattern in `src/features/schema-graph/store.test.ts`

*(Note: vitest environment is "node" -- no DOM rendering tests. All testable behaviors are store-level state transitions.)*

## Security Domain

Security enforcement is not explicitly disabled in config.json.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A -- no auth in desktop app |
| V3 Session Management | no | N/A -- no sessions |
| V4 Access Control | no | N/A -- single-user desktop app |
| V5 Input Validation | no | N/A -- no user input processed in Phase 1 (static UI) |
| V6 Cryptography | no | N/A -- no crypto operations |

### Known Threat Patterns for Phase 1 Stack

None. Phase 1 adds only static UI components with no data processing, network requests, or file system access. No new Tauri commands are introduced. The attack surface is identical to the existing app.

## Sources

### Primary (HIGH confidence)
- `src/App.tsx` -- Root component with mode switching logic, keyboard shortcuts, conditional rendering [VERIFIED: codebase read]
- `src/features/schema-graph/store.ts` -- Zustand store with mode state and canvas mode actions [VERIFIED: codebase read]
- `src/features/connection/components/home-screen.tsx` -- Home screen button pattern [VERIFIED: codebase read]
- `src/features/toolbar/components/toolbar.tsx` -- Toolbar container CSS classes and nav bar pattern [VERIFIED: codebase read]
- `01-UI-SPEC.md` -- Visual design contract with component specs, layout, copy, and interaction contracts [VERIFIED: phase artifact]
- `01-CONTEXT.md` -- Locked implementation decisions D-01 through D-13 [VERIFIED: phase artifact]

### Secondary (MEDIUM confidence)
- `vitest.config.ts` -- Test framework configuration [VERIFIED: codebase read]
- `package.json` -- All dependency versions confirmed [VERIFIED: codebase read]
- `node_modules/lucide-react/dist/esm/icons/folder-sync.js` -- FolderSync icon existence [VERIFIED: filesystem check]

### Tertiary (LOW confidence)
- None -- all findings verified against codebase

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- no new packages; all verified in package.json
- Architecture: HIGH -- exact integration points identified in source code with line numbers
- Pitfalls: HIGH -- derived from reading actual code paths, not speculation

**Research date:** 2026-05-22
**Valid until:** 2026-06-22 (stable -- no external dependencies changing)
