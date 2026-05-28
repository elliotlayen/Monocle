# Phase 6: Search - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-05-28
**Phase:** 6-Search
**Areas discussed:** Search panel placement, Results presentation, Scope selection UX, Unified vs separate search

---

## Search Panel Placement

| Option | Description | Selected |
|--------|-------------|----------|
| VS Code search sidebar | Dedicated search panel replacing folder tree when activated | |
| Toolbar search bar | Search input in top toolbar area | |
| Sidebar section above tree | Collapsible search section at top of existing sidebar, above tree | Yes |

**User's choice:** Sidebar section above tree

| Option | Description | Selected |
|--------|-------------|----------|
| Click to expand panel | Search header bar, click to expand inputs | |
| Always-visible search bar | Input always visible, scope/advanced controls appear on use | Yes |
| Keyboard shortcut toggle | Hidden by default, Cmd+F opens it | |

**User's choice:** Always-visible search bar

| Option | Description | Selected |
|--------|-------------|----------|
| Replace the filter | One input handles both filename filtering and content search | Yes |
| Separate inputs | Keep existing filter, add new search bar alongside | |

**User's choice:** Replace the filter

| Option | Description | Selected |
|--------|-------------|----------|
| Toggle switch | Segmented control: Filename / Content | Yes |
| Search on Enter | Typing filters filenames, Enter triggers content search | |
| Icon button trigger | Typing filters filenames, icon button launches content search | |

**User's choice:** Toggle switch (Filename | Content)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, below the input | Content mode reveals scope dropdown + Search button below | Yes |
| Inline with input | Scope selector inside/next to search bar | |
| Always visible controls | Scope selector always visible regardless of mode | |

**User's choice:** Controls row appears below input in Content mode only

| Option | Description | Selected |
|--------|-------------|----------|
| Filenames and folders | Filter matches file names, folder names, client codes | Yes |
| Filenames only | Filter only matches actual file names | |

**User's choice:** Filenames and folders (preserves current behavior)

| Option | Description | Selected |
|--------|-------------|----------|
| Substring only | Simple contains-match | Yes |
| Glob patterns | Support *, ? wildcards | |
| Glob with substring fallback | Glob if *, ? present, otherwise substring | |

**User's choice:** Substring only

| Option | Description | Selected |
|--------|-------------|----------|
| Always case-insensitive | All searches ignore case | Yes |
| Toggle for case sensitivity | Aa toggle button like VS Code | |

**User's choice:** Always case-insensitive

---

## Results Presentation

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated results tab | Results open as tab in content area | |
| Sidebar results list | Results appear in sidebar, replacing tree temporarily | Yes |
| Both sidebar + tab | Brief list in sidebar, detailed tab on click | |

**User's choice:** Sidebar results list

| Option | Description | Selected |
|--------|-------------|----------|
| File name + match count | Compact: filename and number of matches | Yes |
| File name + line snippets | Expandable with matched lines and context | |
| File name + first match preview | Filename, count, and single-line preview | |

**User's choice:** File name + match count (compact)

| Option | Description | Selected |
|--------|-------------|----------|
| Jump to first match | File opens scrolled to first match, term highlighted | Yes |
| Open at top, highlight all | Opens from top with all occurrences highlighted | |
| Open at top, no highlights | Opens normally, user uses Ctrl+F manually | |

**User's choice:** Jump to first match

| Option | Description | Selected |
|--------|-------------|----------|
| Stream progressively | Results appear as files are scanned, progress indicator + cancel | Yes |
| Wait for all results | Loading spinner until complete | |

**User's choice:** Stream progressively

| Option | Description | Selected |
|--------|-------------|----------|
| Clear search input | X button or Escape restores tree | Yes |
| Explicit back button | Back arrow at top of results | |
| Both clear and back | Either method works | |

**User's choice:** Clear search input

| Option | Description | Selected |
|--------|-------------|----------|
| Grouped by folder | Results under collapsible folder headers | Yes |
| Flat list | Single flat list sorted by relevance or name | |

**User's choice:** Grouped by folder

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, summary header | Header with total matches, files, scope | Yes |
| No header, just results | Results directly, no summary | |

**User's choice:** Summary header

| Option | Description | Selected |
|--------|-------------|----------|
| Matches only | Only files with matches shown | Yes |
| All scanned files | All files including non-matches | |

**User's choice:** Matches only

---

## Scope Selection UX

**Notes:** User pointed out that Phase 04.1 removed hardcoded Client > Date > File hierarchy, so scope options should be tree-relative rather than structure-specific.

| Option | Description | Selected |
|--------|-------------|----------|
| Three tree-relative options | Selected folder, This source, All sources | Yes |
| Just selected + all | Two options only | |

**User's choice:** Three tree-relative scope options

| Option | Description | Selected |
|--------|-------------|----------|
| Selected folder | Narrowest scope, fastest over VPN | Yes |
| This source | Broader starting point | |
| All sources | Everything | |

**User's choice:** Selected folder as default

| Option | Description | Selected |
|--------|-------------|----------|
| Default to All sources | Fall back to All sources when nothing selected | |
| Prompt to select first | Message asking user to select a folder | Yes |
| Auto-select first source | Automatically scope to first root | |

**User's choice:** Prompt to select first

| Option | Description | Selected |
|--------|-------------|----------|
| Show actual name | Resolved folder/source name in dropdown | Yes |
| Generic label only | Just "Selected folder", "This source", etc. | |

**User's choice:** Show actual name

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-update with selection | Scope follows tree clicks, clears results | Yes |
| Fixed once chosen | Scope locked after selection | |
| Auto-update, no clear | Follows selection but keeps results | |

**User's choice:** Auto-update with selection

| Option | Description | Selected |
|--------|-------------|----------|
| Tree hidden during results | Tree fully replaced by results | Yes |
| Tree below results | Both visible, tree pushed down | |

**User's choice:** Tree hidden during results

| Option | Description | Selected |
|--------|-------------|----------|
| Scope syncs pre-search only | Follows selection during setup, locks on execute | Yes |
| No change needed | Same behavior naturally | |

**User's choice:** Scope syncs pre-search only

| Option | Description | Selected |
|--------|-------------|----------|
| XML files only | Always *.xml | |
| Configurable filter | Default *.xml, user can change | Yes |
| All files | Search everything | |

**User's choice:** Configurable filter

| Option | Description | Selected |
|--------|-------------|----------|
| In the controls row | Same row as scope and Search button | Yes |
| As a dropdown option | Small pill next to scope | |
| In a settings popover | Gear icon opens popover | |

**User's choice:** In the controls row

| Option | Description | Selected |
|--------|-------------|----------|
| Remember within session | Retain values during session, reset on restart | Yes |
| Reset each time | Always reset to defaults | |
| Persist across sessions | Save to settings permanently | |

**User's choice:** Remember within session

---

## Unified vs Separate Search

| Option | Description | Selected |
|--------|-------------|----------|
| All loaded nodes | Filename filter applies to entire loaded tree | Yes |
| Selected scope only | Filename filter respects scope setting | |

**User's choice:** All loaded nodes

| Option | Description | Selected |
|--------|-------------|----------|
| Clear results, show tree | Tree restores, search text preserved as filename filter | Yes |
| Clear everything | Both results and text cleared | |
| Keep results until cleared | Results stay visible after mode switch | |

**User's choice:** Clear results, show tree (text preserved)

| Option | Description | Selected |
|--------|-------------|----------|
| Filename (default) | Starts in Filename mode | Yes |
| Remember last used | Remembers last mode within session | |

**User's choice:** Filename as default

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, Cmd+Shift+F | Toggles between modes with keyboard | Yes |
| No shortcut | Mouse-only toggle | |
| Cmd+Shift+F to Content only | One-way shortcut | |

**User's choice:** Cmd+Shift+F to toggle, Cmd+F for Filename focus

| Option | Description | Selected |
|--------|-------------|----------|
| Highlight all occurrences | All matches highlighted with find-match decorations | Yes |
| Highlight first only | Only first occurrence highlighted | |
| Highlight and populate Find | All highlighted plus Monaco find widget opened | |

**User's choice:** Highlight all occurrences

| Option | Description | Selected |
|--------|-------------|----------|
| Persist within session | Query and mode remembered across mode switches | Yes |
| Clear on mode switch | Fresh start when returning to Explorer | |

**User's choice:** Persist within session

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse encoding pipeline | detect_and_decode from Phase 4/5 | Yes |
| UTF-8 only search | Assume UTF-8, skip detection | |

**User's choice:** Reuse encoding pipeline

| Option | Description | Selected |
|--------|-------------|----------|
| Match count only | Backend returns path + count, Monaco finds matches | Yes |
| Line numbers + count | Full position data from backend | |
| First match position + count | First match only from backend | |

**User's choice:** Match count only

| Option | Description | Selected |
|--------|-------------|----------|
| No limit | Search all files regardless of size | Yes |
| Skip files over threshold | Skip large files, show note | |
| Warn but search anyway | Include with warning indicator | |

**User's choice:** No limit

| Option | Description | Selected |
|--------|-------------|----------|
| Single term only | One query at a time | |
| Multiple terms with AND | Space-separated AND, quotes for phrase | Yes |

**User's choice:** Multiple terms with AND

| Option | Description | Selected |
|--------|-------------|----------|
| No limit, show all | All matching files, sidebar scrolls | Yes |
| Limit with show more | First N results with pagination | |

**User's choice:** No limit, show all

| Option | Description | Selected |
|--------|-------------|----------|
| Sort by match count | Most matches first | |
| Sort by filename | Alphabetical within groups | Yes |
| Sort by file path order | Directory traversal order | |

**User's choice:** Sort by filename

| Option | Description | Selected |
|--------|-------------|----------|
| Show in results as error | Error icon + message, grouped at bottom | Yes |
| Skip and count | Continue, show count in header | |
| Skip silently | No mention of skipped files | |

**User's choice:** Show in results as error

| Option | Description | Selected |
|--------|-------------|----------|
| Abort with message | Stop search, preserve results so far | Yes |
| Continue, skip failures | Keep trying remaining files | |
| Retry with timeout | Retry once per file on timeout | |

**User's choice:** Abort with message

---

## Claude's Discretion

- Multi-term AND search match count: Claude chose sum of all term matches for best relevance signal

## Deferred Ideas

None -- discussion stayed within phase scope.
