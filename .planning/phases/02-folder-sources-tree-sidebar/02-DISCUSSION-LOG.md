# Phase 2: Folder Sources & Tree Sidebar - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-05-22
**Phase:** 2-Folder Sources & Tree Sidebar
**Areas discussed:** Source config UX, Tree sidebar behavior, Favorites & filtering, Network I/O resilience

---

## Source Config UX

| Option | Description | Selected |
|--------|-------------|----------|
| Settings sheet section | Add a 'Folder Sources' section to the existing settings panel | ✓ |
| Sidebar inline controls | Add/remove buttons directly in the sidebar header | |
| Both -- settings + sidebar | Settings sheet for full CRUD, sidebar has quick-add button | |

**User's choice:** Settings sheet section
**Notes:** Consistent with existing app settings pattern.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Path only | Just the folder path | |
| Path + label | User gives each source a display name | |
| Path + label + type tag | Label plus a tag for categorization | ✓ |

**User's choice:** Path + label + type tag
**Notes:** Followed up -- tags are freeform (user types whatever they want), not restricted to fixed options.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Native folder dialog | Use Tauri's native open-folder dialog only | |
| Text input + browse | Text field for UNC paths with optional Browse button | ✓ |
| Text input only | Just a text field for pasting paths | |

**User's choice:** Text input + browse
**Notes:** Supports both UNC network paths (typed) and local paths (browsed).

---

| Option | Description | Selected |
|--------|-------------|----------|
| Empty state with action | Update Phase 1 empty state to point to Settings | ✓ |
| Guided onboarding | Short wizard with inline path entry | |
| You decide | Planner picks | |

**User's choice:** Empty state with action
**Notes:** Minimal change, leverages what's already built in Phase 1.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Validate on save | Block save if unreachable | |
| Save with warning | Save regardless, show yellow warning if unreachable | ✓ |
| No validation | Save as-is, errors surface on expand | |

**User's choice:** Save with warning
**Notes:** Useful when VPN isn't connected but user knows the path is correct.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Insertion order | Sources appear in order added | |
| Drag to reorder | Users can drag sources in settings | ✓ |
| You decide | Planner picks | |

**User's choice:** Drag to reorder

---

| Option | Description | Selected |
|--------|-------------|----------|
| No limit | Unlimited sources | ✓ |
| Soft limit (10-20) | Warning after N sources | |
| You decide | Planner determines | |

**User's choice:** No limit

---

| Option | Description | Selected |
|--------|-------------|----------|
| Inbound / Outbound / Other | Three fixed tags | |
| Freeform tags | User types whatever label they want | ✓ |
| Fixed with icon hints | Fixed tags with directional icons | |

**User's choice:** Freeform tags

---

| Option | Description | Selected |
|--------|-------------|----------|
| Full edit | Change path, label, and tag in-place | ✓ |
| Delete and re-add | No edit, remove and re-create | |
| You decide | Planner decides | |

**User's choice:** Full edit

---

## Tree Sidebar Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Flat roots, nested below | Each source is a root, 3 levels of nesting below | ✓ |
| Grouped by tag | Group sources by tag first, then nest | |
| You decide | Planner determines | |

**User's choice:** Flat roots, nested below

---

| Option | Description | Selected |
|--------|-------------|----------|
| Name + count badge | Show child count on all nodes | ✓ |
| Name only | No counts, simpler | |
| Name + count on expand | Show count only after expanded | |

**User's choice:** Name + count badge
**Notes:** Counts are fetched on expand only (lazy). No pre-fetching.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Newest first | Most recent dates at top | |
| Oldest first | Chronological order | |
| User-togglable | Default newest-first with sort toggle | ✓ |

**User's choice:** User-togglable
**Notes:** Sort preference is session-only, resets to newest-first on app restart.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Spinner in node | Small spinner replaces expand chevron | ✓ |
| Skeleton children | Placeholder rows while loading | |
| You decide | Planner picks | |

**User's choice:** Spinner in node

---

| Option | Description | Selected |
|--------|-------------|----------|
| No action (Phase 3) | Files appear but clicking does nothing | ✓ |
| Show file info panel | Basic metadata on click | |
| Select + highlight only | Visual feedback only | |

**User's choice:** No action (Phase 3)
**Notes:** Content area keeps the getting-started empty state.

---

| Option | Description | Selected |
|--------|-------------|----------|
| XML files only | Only show .xml files | |
| All files, XML highlighted | Show all files, XML visually distinct | ✓ |
| You decide | Planner determines | |

**User's choice:** All files, XML highlighted

---

| Option | Description | Selected |
|--------|-------------|----------|
| Persist in settings | Save sort preference to AppSettings | |
| Session only | Default each launch, ephemeral toggle | ✓ |
| Per-source | Each source remembers its own sort | |

**User's choice:** Session only

---

| Option | Description | Selected |
|--------|-------------|----------|
| Keep empty state | Getting-started state until Phase 3 | ✓ |
| Contextual placeholder | Updates based on selection | |
| You decide | Planner determines | |

**User's choice:** Keep empty state

---

## Favorites & Filtering

| Option | Description | Selected |
|--------|-------------|----------|
| Pinned section at top | Favorites section at top, also in normal position | ✓ |
| Pinned at top only | Removed from alphabetical position | |
| Star icon, natural order | Stay in alphabetical, star icon marks favorites | |

**User's choice:** Pinned section at top

---

| Option | Description | Selected |
|--------|-------------|----------|
| Right-click context menu | Right-click -> 'Add to Favorites' | |
| Star icon on hover | Star appears on hover, click to toggle | |
| Both | Star on hover + context menu | ✓ |

**User's choice:** Both

---

| Option | Description | Selected |
|--------|-------------|----------|
| Rust AppSettings | Store in settings.json via Rust | ✓ |
| localStorage | Store in browser localStorage | |
| You decide | Planner picks | |

**User's choice:** Rust AppSettings
**Notes:** Favorites are per-source, not global.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Filter bar above tree | Permanently visible search/filter input | ✓ |
| Collapsible filter | Hidden by default, revealed by icon | |
| Cmd+F focus | Always visible with keyboard shortcut | |

**User's choice:** Filter bar above tree
**Notes:** Matches schema-browser-sidebar's search input pattern.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Clients only | Filter only 3-letter client codes | |
| All visible nodes | Matches any visible node | ✓ |
| Clients + dates | Clients and date folders only | |

**User's choice:** All visible nodes
**Notes:** Only filters already-loaded nodes, doesn't trigger new network fetches.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Global | Favorited in all sources containing it | |
| Per-source | Scoped to each source independently | ✓ |
| You decide | Planner determines | |

**User's choice:** Per-source

---

| Option | Description | Selected |
|--------|-------------|----------|
| Always visible when favorites exist | Section only appears if favorites exist | ✓ |
| Always show section header | Show even when empty with hint | |
| You decide | Planner determines | |

**User's choice:** Always visible when favorites exist

---

## Network I/O Resilience

| Option | Description | Selected |
|--------|-------------|----------|
| Greyed-out with error icon | Source greyed with warning icon and tooltip | ✓ |
| Inline error message | Error row as child node | |
| Toast notification | Error communicated via toast | |

**User's choice:** Greyed-out with error icon

---

| Option | Description | Selected |
|--------|-------------|----------|
| 5 seconds | Fail fast | |
| 10 seconds | More tolerant of VPN latency | |
| 15 seconds with progress | Longer timeout with elapsed time and cancel button | ✓ |

**User's choice:** 15 seconds with progress
**Notes:** Cancel button appears after 3s.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Cache until refresh | Manual refresh clears cache | |
| TTL-based cache (5 min) | Auto-expire after 5 minutes | |
| No cache, always re-fetch | Every expand hits filesystem | ✓ |

**User's choice:** No cache, always re-fetch

---

| Option | Description | Selected |
|--------|-------------|----------|
| spawn_blocking with timeout | tokio::task::spawn_blocking + timeout | |
| std::fs in dedicated thread pool | Standard library fs in custom thread pool | |
| You decide | Researcher investigates | ✓ |

**User's choice:** You decide (Claude's discretion)
**Notes:** Researcher should investigate best approach for UNC path issues.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Abort the operation | Terminates directory read, node collapses | ✓ |
| Dismiss UI, complete in background | Hides spinner, read completes silently | |
| You decide | Planner determines | |

**User's choice:** Abort the operation

---

| Option | Description | Selected |
|--------|-------------|----------|
| Manual retry only | User re-clicks expand to retry | ✓ |
| Retry button in error state | Inline retry link below failed node | |
| You decide | Planner determines | |

**User's choice:** Manual retry only

---

| Option | Description | Selected |
|--------|-------------|----------|
| React to failures only | No proactive checking | ✓ |
| Periodic health ping | Ping each source every 30-60s | |
| You decide | Planner determines | |

**User's choice:** React to failures only

---

| Option | Description | Selected |
|--------|-------------|----------|
| Load all at once | One call per expand, virtual scrolling for rendering | ✓ |
| Paginate (batch of 50) | Load 50 children with 'Load more' | |
| You decide | Planner determines | |

**User's choice:** Load all at once

---

## Claude's Discretion

- UNC path hang workaround (D-29): Researcher should investigate the best approach for handling `tokio::fs::read_dir` issues on Windows UNC paths.

## Deferred Ideas

None -- discussion stayed within phase scope.
