# Phase 1: Explorer Shell & Navigation - Context

**Gathered:** 2026-05-22
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the entry point and layout container for the Integration Explorer feature. Users can click a button on the home screen to enter a new full-screen Explorer mode, see a minimal nav bar with a home button, and view a getting-started empty state. No folder browsing, file viewing, or validation — just the shell that hosts everything.

</domain>

<decisions>
## Implementation Decisions

### Mode Switching UX
- **D-01:** Explorer gets its own dedicated nav bar, separate from Schema Graph and Canvas toolbars. There is no shared cross-mode tab bar — users switch modes from the home screen.
- **D-02:** The Explorer nav bar is minimal: app name/logo on the left, a Home button to return to the home screen, and a settings gear on the right. Placeholder space for future controls (search, filters, etc. in later phases).
- **D-03:** Only the Explorer gets a home button. Schema Graph and Canvas modes keep their existing toolbars unchanged — they already have disconnect/exit buttons.
- **D-04:** Clicking Home in the Explorer instantly returns to the home screen. No "dirty state" dialog — Explorer is read-only, so there's nothing to lose.

### Empty State Content
- **D-05:** The empty content area shows a getting-started guide: feature name ("Integration Explorer"), brief description of what it does, instruction to configure folder sources in Settings, and an "Open Settings" action button. Modeled after VS Code's "Open a folder to get started" pattern.
- **D-06:** No sidebar in Phase 1. The content area takes the full width. The sidebar appears in Phase 2 when folder sources are configured.

### Layout Proportions
- **D-07:** The explorer sidebar (arriving in Phase 2) will be resizable via a drag handle. Width persists across sessions.
- **D-08:** The sidebar will be collapsible via a toggle button, matching the existing schema-browser-sidebar toggle pattern.

### Home Screen Button
- **D-09:** Integration Explorer button placed below Canvas Mode in the home screen button list. Order: Connect to Server, Canvas Mode, Integration Explorer, Settings, About.
- **D-10:** Same outline button style as existing buttons — no special prominence.
- **D-11:** Uses the `FolderSync` Lucide icon.
- **D-12:** Keyboard shortcut: Cmd+E (Ctrl+E on Windows).

### Theme and Visual Style
- **D-13:** Explorer matches the existing app's visual style exactly — same shadcn/ui components, same visual density, same color palette. No special styling for the broader audience.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Context
- `.planning/PROJECT.md` — Project overview, constraints (read-only, Tauri 2, lazy loading, cross-platform), and key decisions
- `.planning/REQUIREMENTS.md` — Requirement BRWS-09 maps to this phase
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria, and dependencies

### Existing Codebase (Integration Points)
- `src/App.tsx` — Root component that manages mode state and renders HomeScreen vs connected view. New "explorer" mode state integrates here.
- `src/features/connection/components/home-screen.tsx` — Home screen with existing buttons. New Integration Explorer button goes here.
- `src/features/schema-graph/store.ts` — Zustand store managing `mode` state. Explorer mode state either extends this or uses a new store.
- `src/features/toolbar/components/toolbar.tsx` — Existing toolbar pattern for reference. Explorer gets its own nav bar component.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/ui/button.tsx` (shadcn): Home screen buttons, nav bar buttons, "Open Settings" action
- `src/components/ui/separator.tsx` (shadcn): Visual dividers if needed in nav bar
- `src/features/schema-graph/components/sidebar-toggle.tsx`: Toggle button pattern for collapsible sidebar (Phase 2+)
- `src/features/settings/services/settings-service.ts`: Settings persistence pattern for sidebar width

### Established Patterns
- Mode state: `useSchemaStore` manages `mode` field (currently `"canvas"` or default). Explorer adds a new mode value.
- Home screen callbacks: `HomeScreen` takes `onOpenConnectionModal`, `onOpenSettings`, `onOpenAbout`, `onEnterCanvasMode` as props. New `onEnterExplorer` follows the same pattern.
- Keyboard shortcuts: Registered in `App.tsx` via `useEffect` on `keydown`. Cmd+E follows the same pattern as Cmd+K (canvas).
- Feature module structure: `src/features/{name}/components/`, `services/`, `hooks/`, `store.ts`, `types.ts`.

### Integration Points
- `App.tsx` line 357-358: `showHome` conditional determines whether to render `HomeScreen` or the connected view. Explorer mode needs its own branch here.
- `App.tsx` line 96: `isCanvasMode = mode === "canvas"` pattern — Explorer follows the same: `isExplorerMode = mode === "explorer"`.
- `src/hooks/use-menu-events.ts`: Menu event handling for native macOS/Windows menus. Explorer may need menu items in the future.

</code_context>

<specifics>
## Specific Ideas

- The "Open Settings" button on the empty state should open the app settings where folder source configuration will live (Phase 2 adds the actual folder source settings).
- The getting-started empty state should be centered vertically and horizontally in the content area, similar to the existing "Select a database from the toolbar" empty state in Schema Graph mode.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 1-Explorer Shell & Navigation*
*Context gathered: 2026-05-22*
