# Phase 5: Bulk Validation & Reporting - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-27
**Phase:** 05-bulk-validation-reporting
**Areas discussed:** Scan trigger & scope, Progress & streaming, Results display, Report export formats

---

## Scan Trigger & Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Right-click context menu only | "Scan for issues" in context menu on folder nodes | |
| Context menu + toolbar button | Context menu for targeted scans, plus toolbar button for scanning selected folder | ✓ |
| Context menu + tree icon button | Context menu plus hover icon on folder nodes | |

**User's choice:** Context menu + toolbar button
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Date folder + client | Scan single date folder or entire client | |
| Date folder + client + source root | All above plus entire source root | |
| Any folder node in the tree | Available on any folder, recursively walks subdirectories | ✓ |

**User's choice:** Any folder node in the tree
**Notes:** User pointed out the folder hierarchy is now generic (Phase 04.1 refactor), so scan scope should match — available on any node, user directs where it happens.

| Option | Description | Selected |
|--------|-------------|----------|
| XML files only | Only process .xml files | |
| All files | Validate every file regardless of extension | |
| Configurable filter | Default .xml, user can specify pattern | ✓ |

**User's choice:** Configurable filter
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| One scan at a time | New scan prompts to cancel current | ✓ |
| Multiple concurrent scans | Independent parallel scans | |

**User's choice:** One scan at a time
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, update tree badges | All scanned files get validation badges | ✓ |
| No, badges only from opening files | Badges only set on individual file open | |

**User's choice:** Yes, update tree badges
**Notes:** User also confirmed the generic folder hierarchy context — removed hardcoded levels so any user can use this.

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, aggregate folder badges | Parent shows worst severity of children | ✓ |
| No, file badges only | Only individual files get badges | |
| Count badge on folders | Folders show count badge (e.g., "3 errors") | |

**User's choice:** Yes, aggregate folder badges
**Notes:** None

---

## Progress & Streaming

| Option | Description | Selected |
|--------|-------------|----------|
| Real-time per-file updates | Each file fires Tauri event with result and totals | ✓ |
| Periodic batch updates | One update per ~10 file batch | |
| Completion only | Spinner until done | |

**User's choice:** Real-time per-file updates
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Inline panel in content area | Progress bar, file count, current file, cancel button | ✓ |
| Bottom status bar + notification | Subtle background scanning | |
| Modal dialog with progress | Blocking modal | |

**User's choice:** Inline panel in content area
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, after initial sample | Calculate ETA from average time per file | |
| No, just counts and percentage | "45 of 200 files (23%)" | ✓ |
| You decide | Claude's discretion | |

**User's choice:** No, just counts and percentage
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Tauri events | app_handle.emit, same as menu events | ✓ |
| Tauri channel API | Tauri 2's Channel<T> | |
| You decide | Claude's discretion | |

**User's choice:** Tauri events
**Notes:** None

---

## Results Display

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated scan results tab | Special tab in content area alongside file tabs | ✓ |
| Replace progress panel in-place | Progress transitions to results | |
| Separate results panel | Bottom split panel | |

**User's choice:** Dedicated scan results tab
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| File list with expandable rows | Summary stats, sortable columns, expand for problems | ✓ |
| Grouped by severity | Errors first, then warnings | |
| Tree mirroring folder structure | Results in folder hierarchy | |

**User's choice:** File list with expandable rows
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, open file in new tab | Opens regular file tab with source + problems panel | ✓ |
| Yes, jump to first issue | Opens file and scrolls to first problem | |
| No, self-contained | Results show all detail needed | |

**User's choice:** Yes, open file in new tab
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, show all files | All files with green checkmark for clean, can filter to issues only | ✓ |
| No, only files with issues | Clean files in summary stats only | |

**User's choice:** Yes, show all files
**Notes:** None

---

## Report Export Formats

| Option | Description | Selected |
|--------|-------------|----------|
| One row per problem | File Path, Line, Column, Severity, Issue Code, Description, Encoding | ✓ |
| One row per file | Summary-level, loses individual problem details | |
| Both options | Two CSVs: summary + detail | |

**User's choice:** One row per problem (CSV)
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Summary + file details | Header, stats, file-by-file detail | ✓ |
| Summary only | One-page overview | |
| You decide | Claude's discretion | |

**User's choice:** Summary + file details (PDF)
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Toolbar in scan results tab | Export dropdown in results tab header | ✓ |
| Reuse existing export button | Add formats to main toolbar export dropdown | |
| Both locations | Redundant but discoverable | |

**User's choice:** Toolbar in scan results tab
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Scan scope + date + summary stats | Full context in every export | ✓ |
| Minimal (date + totals only) | Less context | |
| You decide | Claude's discretion | |

**User's choice:** Scan scope + date + summary stats
**Notes:** None

| Option | Description | Selected |
|--------|-------------|----------|
| Plain text summary | Compact text for Slack/Teams/email | |
| Markdown table | Renders in GitHub/Jira | |
| Both | Two separate clipboard options | ✓ |

**User's choice:** Both plain text and markdown table as separate clipboard options
**Notes:** User requested both formats available in the export dropdown.

| Option | Description | Selected |
|--------|-------------|----------|
| Session-only | Results in memory only, export before closing | ✓ |
| Persist last scan | Most recent result persisted to disk | |
| You decide | Claude's discretion | |

**User's choice:** Session-only
**Notes:** Consistent with Phase 3 D-13 (tabs don't persist across sessions).

---

## Claude's Discretion

None — all decisions made by user.

## Deferred Ideas

None — discussion stayed within phase scope.
