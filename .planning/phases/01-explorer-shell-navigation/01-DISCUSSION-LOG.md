# Phase 1: Explorer Shell & Navigation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-05-22
**Phase:** 1-Explorer Shell & Navigation
**Areas discussed:** Mode switching UX, Empty state content, Layout proportions, Home screen button, Theme and visual style

---

## Mode Switching UX

### Top navigation bar pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Tab bar | Horizontal tabs at the top (like browser tabs). Each mode is a tab. Always visible. | |
| Segmented control in toolbar | Compact segmented button group embedded in the toolbar area. | |
| Sidebar icon rail | Vertical icon strip on the far left (like VS Code's Activity Bar). | |

**User's choice:** None of the above. Explorer gets its own dedicated nav bar, just like Schema Graph and Canvas each have their own toolbar. Mode switching stays on the home screen.
**Notes:** "This feature is a whole new UI. So it's ok to have a new nav bar for this. Just like there is a different one for connect to server and for canvas mode."

### Explorer nav bar contents

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal with home button | App name/logo, home button, settings gear. Placeholder for future controls. | yes |
| Breadcrumb-style | Navigation path like 'Home > Integration Explorer'. Natural extension point. | |
| You decide | Claude picks based on codebase patterns. | |

**User's choice:** Minimal with home button

### Cross-mode consistency

| Option | Description | Selected |
|--------|-------------|----------|
| Explorer only for now | Home button only in Explorer. Other modes keep existing toolbars. | yes |
| All modes get home button | Retrofit all toolbars with home button for consistency. | |

**User's choice:** Explorer only for now. Schema Graph and Canvas already have disconnect buttons.

### Returning home behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Simple navigation | Instantly returns home. Explorer is read-only, no unsaved state. | yes |
| You decide | Claude picks based on patterns. | |

**User's choice:** Simple navigation

---

## Empty State Content

### Empty content area

| Option | Description | Selected |
|--------|-------------|----------|
| Getting started guide | Feature name, description, "Configure folder sources" instruction, "Open Settings" button. | yes |
| Minimal placeholder | Just feature name and "No folder sources configured." | |
| You decide | Claude picks based on existing empty state pattern. | |

**User's choice:** Getting started guide

### Sidebar visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Hidden until Phase 2 | No sidebar in Phase 1. Content area takes full width. | yes |
| Visible but empty | Show sidebar panel with placeholder text. | |
| You decide | Claude picks for smoothest Phase 2 transition. | |

**User's choice:** Hidden until Phase 2

---

## Layout Proportions

### Sidebar resize behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Resizable with drag handle | User can drag to resize. Width persists across sessions. | yes |
| Fixed width | Same approach as existing schema-browser-sidebar. | |
| You decide | Claude picks based on patterns. | |

**User's choice:** Resizable with drag handle

### Sidebar collapsibility

| Option | Description | Selected |
|--------|-------------|----------|
| Collapsible with toggle | Toggle button collapses/expands. Matches existing sidebar toggle pattern. | yes |
| Always visible | Sidebar always present in explorer mode. | |
| You decide | Claude picks based on patterns. | |

**User's choice:** Collapsible with toggle

---

## Home Screen Button

### Button placement and style

| Option | Description | Selected |
|--------|-------------|----------|
| Same style, top of list | Same outline button, placed first. | |
| Prominent primary button | Filled/primary-colored button at top. | |
| Same style, grouped | Same outline, modes grouped separately from utilities. | |

**User's choice:** Below Canvas Mode. Order: Connect to Server, Canvas Mode, Integration Explorer, Settings, About. Same outline button style.
**Notes:** User specifically wanted it below Canvas Mode, not at the top.

### Keyboard shortcut

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, Cmd+E | Cmd+E (Ctrl+E on Windows). Mnemonic and available. | yes |
| No shortcut for now | Skip shortcut until feature matures. | |
| You decide | Claude picks based on existing patterns. | |

**User's choice:** Yes, Cmd+E

### Icon choice

| Option | Description | Selected |
|--------|-------------|----------|
| FolderSearch | Folder with magnifying glass. | |
| FileSearch | File with magnifying glass. | |
| Network | Network/graph icon. | |
| You decide | Claude picks. | |

**User's choice:** FolderSync (user-specified, not from presented options). Represents the sync/integration aspect of folder data.

---

## Theme and Visual Style

### Visual tone

| Option | Description | Selected |
|--------|-------------|----------|
| Match existing style | Same shadcn/ui components, density, color palette. | yes |
| Lighter touch for broader audience | Same components but with more spacing, larger touch targets. | |
| You decide | Claude picks based on audience. | |

**User's choice:** Match existing style

---

## Claude's Discretion

None -- user made explicit choices for all decisions.

## Deferred Ideas

None -- discussion stayed within phase scope.
