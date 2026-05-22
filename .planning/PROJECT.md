# Monocle — Integration Explorer

## What This Is

Monocle is a Tauri desktop application that currently visualizes SQL Server database schemas. This milestone adds a new major feature called "Integration Explorer" — a tool for browsing, searching, validating, and analyzing XML integration files stored on network shares. It targets an entire department currently using Windows Explorer to manually dig through hundreds of client folders containing years of inbound/outbound XML data between two internal software systems.

## Core Value

Instantly find the right integration file and know if it has problems — replacing minutes of manual folder clicking with seconds of targeted search and automatic validation.

## Requirements

### Validated

- Database schema visualization (existing feature — connected mode)
- Canvas mode for offline schema editing (existing feature)
- SQL Server connection with TDS protocol via tiberius (existing)
- Export to PNG, PDF, JSON (existing)
- Settings persistence (existing)
- Auto-updater (existing)

### Active

- [ ] Integration Explorer as a new top-level mode accessible from the home screen
- [ ] Configurable folder sources — add/remove/edit multiple root folder paths, persisted across sessions
- [ ] Folder tree sidebar: Root > Client (3-letter code) > Date folder hierarchy
- [ ] Date folders displayed as raw + formatted (e.g., "20251223 (Dec 23, 2025)")
- [ ] Lazy-loading folder contents on-demand (critical for remote network shares over VPN)
- [ ] Client filtering and favorites (pin frequently used clients to top)
- [ ] XML file viewer with toggle between collapsible tree view and syntax-highlighted raw source
- [ ] Full XML detail in tree view: namespaces, attributes, comments, processing instructions
- [ ] Tabbed interface for opening multiple XML files simultaneously
- [ ] Configurable-scope search: search within current folder, current client, or across all sources
- [ ] Field-level search: find specific values (e.g., patient ID, account number) inside XML content
- [ ] File pattern search: filter by filename pattern or size anomaly
- [ ] Illegal character detection: flag XML-invalid characters and encoding issues (non-UTF8, BOM)
- [ ] Inline problem highlighting in source view with markers on bad characters/lines
- [ ] Problems panel listing line numbers and descriptions (like a code editor)
- [ ] Visual flags on files in the browser (red icon/badge) when issues are detected
- [ ] Bulk scan: run validation on an entire folder and produce a summary report
- [ ] Scan report export: CSV/Excel, PDF, JSON, and clipboard text formats
- [ ] File comparison: side-by-side and inline diff modes, togglable
- [ ] Compare any two files: same client across dates, inbound vs outbound, or arbitrary selection
- [ ] File actions: copy path, open in external editor, copy content, export/save cleaned version
- [ ] Bookmarks: save references to specific files or folders for later revisiting
- [ ] Client dashboard: per-client file counts by date, error rates, last activity
- [ ] Error heatmap: visual overview of which clients/dates have the most issues
- [ ] Timeline view: file volume over time (day/week/month)
- [ ] File size trend analysis: spot anomalies (unusually large or small files)
- [ ] Folder watching: monitor configured folders for new file activity
- [ ] Watch notifications: desktop notifications, in-app badges, auto-validate new files — each individually toggleable in settings
- [ ] XPath query support for power users (nice to have)
- [ ] Top navigation bar consistent with existing modes for switching between features

### Out of Scope

- Editing/fixing XML files with bad characters — identification only, not correction
- Real-time streaming or live tailing of files
- Database integration (linking XML content to SQL Server data)
- Multi-user collaboration or shared bookmarks
- Mobile or web version — desktop only via Tauri
- Automated remediation or file repair

## Context

**The problem:** The department uses two internal software systems that exchange data via XML files stored on a network share. Files are organized as `[root]/[3-letter client code]/[YYYYMMDD]/[files].xml`. There are two root folders (inbound and outbound) but the workflow is the same for both — verifying data was sent/received correctly and debugging failures. Currently everyone browses with Windows Explorer, which is painfully slow when you need to find a specific record across hundreds of clients and years of history.

**Integration file structure:**
```
Root Folder (Inbound or Outbound)/
  ABC/                    # 3-letter client code
    20251223/             # Date folder
      file1.xml           # Integration data
      file2.xml
      ...
    20251224/
      ...
  DEF/
    ...
```

**Scale:** Hundreds of client folders, date folders spanning years, file count per date varies wildly (1 to hundreds). Total volume is substantial.

**Access:** Network shares accessed remotely over VPN — performance-sensitive, lazy loading essential.

**XML content:** Many different XML schemas/structures across files. Semi-structured filenames (some naming convention but inconsistent).

**Common failures:** Illegal characters (unescaped XML entities like `&`, `<`, `>`) and encoding issues (non-UTF8, BOM problems) cause data to fail processing silently.

**Audience:** Entire department — this needs to be approachable, not just a power-user tool.

**Existing app:** Monocle already has a home screen with buttons for "Connect to Server", "Canvas Mode", "Settings", and "About". Integration Explorer will be a new button on this screen, launching into its own full-screen mode with a sidebar + content layout (like VS Code) and the same top navigation bar pattern used by other modes.

## Constraints

- **Tech stack**: Must use existing Tauri 2 + React + TypeScript + Rust architecture
- **Network performance**: Remote VPN access means all file I/O must be lazy and non-blocking; never scan entire folder trees upfront
- **Read-only**: Integration Explorer is read-only — no file modification, only viewing and analysis
- **Cross-platform**: Must work on both macOS and Windows (existing Tauri targets)
- **File system access**: Uses Tauri's fs plugin for file reading; network share paths must work on both platforms

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| New mode in existing app (not separate app) | Keeps single tool for the department; leverages existing infrastructure (settings, updater, theme) | -- Pending |
| Lazy loading over indexing | Network shares over VPN make upfront scanning impractical; load on-demand as user navigates | -- Pending |
| Read-only (no file editing/fixing) | Scope control; users identify issues and report them, don't fix files themselves | -- Pending |
| Multiple configurable folder sources | Users may have personal folders of test XML files beyond the standard inbound/outbound | -- Pending |
| Sidebar + content layout | Matches VS Code mental model that's familiar; consistent with schema browser sidebar pattern | -- Pending |
| Feature name: "Integration Explorer" | Matches department terminology for these files | -- Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-22 after initialization*
