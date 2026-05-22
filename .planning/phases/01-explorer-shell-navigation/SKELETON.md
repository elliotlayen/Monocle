# Walking Skeleton -- Monocle Integration Explorer

**Phase:** 1
**Generated:** 2026-05-22

## Capability Proven End-to-End

A user can click "Integration Explorer" on the home screen (or press Cmd+E) and enter a new full-screen mode with a nav bar and empty state, then return to the home screen without losing any existing app state.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Mode state management | Extend existing Zustand `useSchemaStore.mode` union with `"explorer"` | App already manages mode switching (connected/canvas) through a single Zustand store. Adding to the union follows the established pattern and avoids split state. |
| Feature directory | `src/features/explorer/components/` | Project uses feature-based architecture per CLAUDE.md. Explorer is a new top-level feature alongside connection, schema-graph, canvas, toolbar, export, settings. |
| Component architecture | Presentational components with callback props, no direct store access | Matches the strict layering enforced by CLAUDE.md: components are presentational only, App.tsx wires store to components. |
| Navigation pattern | Conditional rendering in App.tsx based on mode state (no React Router) | Existing app uses state-driven conditional rendering, not a router. Explorer follows the same pattern used by canvas mode. |
| Nav bar approach | Dedicated ExplorerNavBar, separate from existing Toolbar | D-01 explicitly requires separate nav bars. The existing Toolbar is deeply coupled to schema/canvas state and should not be extended. |
| UI primitives | Existing shadcn/ui (button, tooltip) + lucide-react icons | Zero new dependencies. All UI primitives already installed and used throughout the app. |
| Empty state strategy | Static getting-started content with Open Settings CTA | Phase 1 has no data to display. The empty state guides users toward configuring folder sources (Phase 2). |
| Keyboard shortcuts | Cmd+E registered in existing App.tsx useEffect keydown handler | Follows Cmd+K (canvas mode) pattern exactly. Single handler for all global shortcuts. |

## Stack Touched in Phase 1

- [x] Project scaffold -- existing (React 19 + Vite + Tauri 2 + TypeScript 5.8)
- [x] Routing -- Explorer mode via state-driven conditional in App.tsx (new conditional branch)
- [ ] Database -- not applicable (explorer is read-only file browser; no DB interaction in any phase)
- [x] UI -- ExplorerShell, ExplorerNavBar, ExplorerEmptyState components wired to App.tsx
- [x] Full-stack run command -- `npm run tauri dev` (existing, exercises complete app including new explorer mode)

Note: The Integration Explorer feature does not use a database. It reads files from network shares via Tauri/Rust in later phases. Phase 1 is purely UI shell with no I/O.

## Out of Scope (Deferred to Later Slices)

- Folder source configuration (Phase 2)
- Tree sidebar with lazy-loading folder navigation (Phase 2)
- XML file viewing (tree view and source view) (Phase 3)
- File validation and problem detection (Phase 4)
- Bulk validation and reporting (Phase 5)
- Search (filename and content) (Phase 6)
- File comparison/diff (Phase 7)
- Analytics dashboard (Phase 8)
- Folder watching and notifications (Phase 9)
- Bookmarks and XPath (Phase 10)
- Sidebar resize/collapse (Phase 2 -- D-07, D-08 deferred)
- Explorer-specific settings UI (Phase 2)

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- Phase 2: User can configure folder sources and navigate a Client > Date > File tree in a collapsible sidebar
- Phase 3: User can open XML files in tabs with tree view and syntax-highlighted source view
- Phase 4: User can see validation issues (bad characters, encoding) highlighted in opened files
- Phase 5: User can run bulk validation scans on folders with streamed progress and export reports
- Phase 6: User can search by filename or XML content across configured sources
- Phase 7: User can compare two files with side-by-side or inline diff
- Phase 8: User can view client dashboards, error heatmaps, and timeline charts
- Phase 9: User receives notifications when new files appear in monitored folders
- Phase 10: User can bookmark files and run XPath queries
