# Roadmap: Monocle Integration Explorer

## Overview

The Integration Explorer transforms Monocle from a schema visualizer into a dual-purpose tool by adding a file browser, validator, and analysis engine for XML integration files on network shares. The roadmap starts with the navigation foundation and I/O patterns critical for VPN-accessed SMB shares, layers on the XML viewing experience, then delivers the two core value propositions (validation and search) before expanding into comparison, analytics, and monitoring. Each phase delivers end-to-end user value -- users can adopt after any phase and get meaningful capability.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Explorer Shell & Navigation** - Mode entry point, layout shell, top nav integration with existing modes (completed 2026-05-22)
- [x] **Phase 2: Folder Sources & Tree Sidebar** - Configurable root folders, lazy-loading folder tree, date formatting, client filtering and favorites (completed 2026-05-26)
- [x] **Phase 3: XML File Viewing** - Tree view, syntax-highlighted source view, tabbed multi-file interface, file actions (completed 2026-05-26)
- [ ] **Phase 4: Single-File Validation** - Illegal character detection, problem badges in tree, problems panel, inline source highlighting
- [ ] **Phase 5: Bulk Validation & Reporting** - Folder-wide validation scans with streaming progress and multi-format report export
- [ ] **Phase 6: Search** - Filename filtering, XML content search, configurable search scope
- [ ] **Phase 7: File Comparison** - Side-by-side and inline diff for any two files
- [ ] **Phase 8: Analytics Dashboard** - Client dashboard, error heatmap, timeline view, file size anomaly detection
- [ ] **Phase 9: Folder Watching & Notifications** - Polling-based folder monitoring with desktop and in-app notifications
- [ ] **Phase 10: Bookmarks & XPath** - File/folder bookmarks with notes and XPath query support

## Phase Details

### Phase 1: Explorer Shell & Navigation

**Goal**: Users can enter Integration Explorer from the home screen and see the layout shell that will host all explorer functionality
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: BRWS-09
**Success Criteria** (what must be TRUE):

  1. User can click "Integration Explorer" on the home screen and enter a new full-screen mode
  2. A top navigation bar appears with Monocle branding, Home button, and Settings button (per D-01: users switch modes from the home screen, not from the nav bar)
  3. The explorer layout shows a full-width content area with getting-started empty state (per D-06: sidebar deferred to Phase 2)
  4. User can return to the home screen or switch to other modes without losing app state

**Plans**: 1 plan

Plans:

- [x] 01-01-PLAN.md -- Explorer mode state, shell components, home screen button, keyboard shortcut, and visual verification

**UI hint**: yes

### Phase 2: Folder Sources & Tree Sidebar

**Goal**: Users can configure their network share root folders and navigate the Client > Date > File hierarchy without waiting for full directory scans
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: BRWS-01, BRWS-02, BRWS-03, BRWS-08
**Success Criteria** (what must be TRUE):

  1. User can add, edit, and remove root folder paths in settings, and those paths persist across app restarts
  2. The sidebar displays a tree organized as Root > Client (3-letter code) > Date folder > Files, loading children only when a node is expanded
  3. Date folders display both raw and formatted dates (e.g., "20251223 (Dec 23, 2025)")
  4. User can type in a filter field to narrow the client list and pin favorite clients to always appear at the top
  5. Expanding folders over a slow network connection shows a loading indicator rather than freezing the UI

**Plans**: 3 plans

Plans:

- [x] 02-01-PLAN.md -- Rust backend (FolderSource model, directory listing with timeout/cancel, favorites), frontend types, Zustand store, IPC services, utility functions, and tests
- [x] 02-02-PLAN.md -- Settings Folder Sources section (CRUD, drag-to-reorder, browse, path validation), updated empty state messaging
- [x] 02-03-PLAN.md -- Tree sidebar (lazy-loading tree, date formatting, filter bar, favorites with star/context-menu, sort toggle, resize/collapse), visual verification

**UI hint**: yes

### Phase 3: XML File Viewing

**Goal**: Users can open and inspect XML integration files with the same ease as a code editor, viewing structure or raw source across multiple tabs
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: BRWS-04, BRWS-05, BRWS-06, BRWS-07
**Success Criteria** (what must be TRUE):

  1. Clicking a file in the tree opens it in a collapsible tree view showing elements, attributes, namespaces, comments, and processing instructions
  2. User can toggle between tree view and syntax-highlighted raw source view for the same file
  3. User can open multiple files in tabs, each maintaining its own view mode and scroll position
  4. User can copy a file's full path, open it in an external editor, copy raw content, or save a copy to another location

**Plans**: 3 plans

Plans:

**Wave 1**

- [x] 03-01-PLAN.md -- Rust read_file_cmd, clipboard plugin, types/store/services, tab bar, content area, Monaco XML source view, shell wiring, sidebar file click

**Wave 2**

- [x] 03-02-PLAN.md -- XML parser utility, collapsible tree view with element/attribute/text/comment/PI/CDATA rendering, parse error handling
- [x] 03-03-PLAN.md -- File actions hook (clipboard, external editor, save copy), context menus on tabs and sidebar files

**UI hint**: yes

### Phase 4: Single-File Validation

**Goal**: Users can instantly see whether an open file has problems and pinpoint the exact location of every issue
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: VALD-01, VALD-02, VALD-03, VALD-04
**Success Criteria** (what must be TRUE):

  1. When a file is opened, the app automatically detects XML-invalid characters (unescaped entities, control characters, null bytes) and encoding issues (non-UTF8, BOM problems)
  2. Files with detected issues show a red badge/icon in the folder tree sidebar
  3. A problems panel lists all issues with line number, column, description, and severity, and clicking an issue jumps to that location in the source view
  4. In source view, affected lines have gutter markers and bad characters are highlighted inline

**Plans**: 2 plans

Plans:

**Wave 1**

- [ ] 04-01-PLAN.md -- Rust validation engine (encoding detection, character scanning), extended read_file_cmd IPC, frontend types/store/service wiring, tree badges

**Wave 2**

- [ ] 04-02-PLAN.md -- Problems panel, validation status bar, drag-resizable layout, Monaco decorations (gutter markers, inline highlights, overview ruler), click-to-jump navigation

**UI hint**: yes

### Phase 5: Bulk Validation & Reporting

**Goal**: Users can scan an entire folder or client's files for problems in one action and export the results for sharing or tracking
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: VALD-05, VALD-06
**Success Criteria** (what must be TRUE):

  1. User can right-click a folder or client in the tree and run a bulk validation scan that processes all contained XML files
  2. Scan progress streams in real time showing files processed, issues found, and estimated time remaining, with a cancel button
  3. Scan results display as a summary report listing each file, its issues, and aggregate statistics
  4. User can export scan reports in CSV, PDF, JSON, and clipboard text formats

**Plans**: TBD

Plans:

- [ ] 05-01: TBD

### Phase 6: Search

**Goal**: Users can find any file by name or locate specific values inside XML content across thousands of files without manually opening each one
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: SRCH-01, SRCH-02, SRCH-03
**Success Criteria** (what must be TRUE):

  1. User can filter the current file list by typing a filename pattern and see matching files highlighted or filtered in real time
  2. User can search for a specific value (e.g., patient ID, account number) inside XML file content and see results listing matching files with context snippets
  3. User can choose search scope -- current folder, current client (all dates), or all configured sources -- before executing a search
  4. Search results stream in progressively as files are scanned, with the ability to cancel a long-running search

**Plans**: TBD

Plans:

- [ ] 06-01: TBD

**UI hint**: yes

### Phase 7: File Comparison

**Goal**: Users can compare any two XML files to see exactly what changed between them
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: ANLS-01
**Success Criteria** (what must be TRUE):

  1. User can select two files and open a comparison view showing their differences
  2. User can toggle between side-by-side and inline diff display modes
  3. Differences are highlighted at the line level with added, removed, and modified lines visually distinct

**Plans**: TBD

Plans:

- [ ] 07-01: TBD

**UI hint**: yes

### Phase 8: Analytics Dashboard

**Goal**: Users can see patterns across clients and dates -- who has the most issues, when activity spikes, and which files are anomalous
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: ANLS-02, ANLS-03, ANLS-04, ANLS-05
**Success Criteria** (what must be TRUE):

  1. User can view a per-client dashboard showing file counts by date, error rates, and most recent activity
  2. User can view an error heatmap showing issue density across clients and dates at a glance
  3. User can view a timeline chart of file volume over time with day, week, and month granularity options
  4. Files with anomalous sizes (unusually large or small compared to peers) are flagged in the UI

**Plans**: TBD

Plans:

- [ ] 08-01: TBD

**UI hint**: yes

### Phase 9: Folder Watching & Notifications

**Goal**: Users are automatically alerted when new files appear in monitored folders without manually refreshing
**Mode:** mvp
**Depends on**: Phase 4
**Requirements**: MNTR-01
**Success Criteria** (what must be TRUE):

  1. User can enable folder watching on any configured source folder and see new files appear in the tree automatically
  2. Desktop notifications fire when new files are detected (togglable in settings)
  3. In-app badges indicate folders with new unviewed files (togglable in settings)
  4. New files are automatically validated on arrival with issues immediately visible (togglable in settings)

**Plans**: TBD

Plans:

- [ ] 09-01: TBD

### Phase 10: Bookmarks & XPath

**Goal**: Power users can save references to important files and run structured queries against XML content
**Mode:** mvp
**Depends on**: Phase 3
**Requirements**: MNTR-02, MNTR-03
**Success Criteria** (what must be TRUE):

  1. User can bookmark a file or folder with an optional note and see all bookmarks in a dedicated panel
  2. Bookmarks persist across sessions and clicking a bookmark navigates to the saved file or folder
  3. User can enter an XPath expression and run it against the current file, seeing matching nodes highlighted
  4. User can run an XPath query across multiple files and see aggregated results

**Plans**: TBD

Plans:

- [ ] 10-01: TBD

**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10

Note: Phases 6 and 7 depend on Phase 2 and Phase 3 respectively (not Phase 5), so they could theoretically begin once their dependencies complete. The linear ordering above is the default; parallelization may be applied during planning.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Explorer Shell & Navigation | 1/1 | Complete    | 2026-05-22 |
| 2. Folder Sources & Tree Sidebar | 3/3 | Complete   | 2026-05-26 |
| 3. XML File Viewing | 3/3 | Complete | 2026-05-26 |
| 4. Single-File Validation | 0/2 | Planned | - |
| 5. Bulk Validation & Reporting | 0/? | Not started | - |
| 6. Search | 0/? | Not started | - |
| 7. File Comparison | 0/? | Not started | - |
| 8. Analytics Dashboard | 0/? | Not started | - |
| 9. Folder Watching & Notifications | 0/? | Not started | - |
| 10. Bookmarks & XPath | 0/? | Not started | - |
