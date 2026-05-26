# Phase 3: XML File Viewing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md -- this log preserves the alternatives considered.

**Date:** 2026-05-26
**Phase:** 03-xml-file-viewing
**Areas discussed:** Source view renderer, XML tree view, Tab interface, File actions surface

---

## Source View Renderer

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse Monaco | Already bundled. Add XML language contribution. Get syntax highlighting, line numbers, search, minimap for free. Read-only mode built in. | ✓ |
| Lightweight viewer | Simpler syntax highlighter (prism/shiki). Smaller footprint but fewer features. | |

**User's choice:** Reuse Monaco
**Notes:** Monaco is already lazy-loaded for SQL. Adding XML language support is incremental.

### Default View Mode

| Option | Description | Selected |
|--------|-------------|----------|
| Tree view first | Most users want structure at a glance. | |
| Source view first | More familiar (like opening a file in a code editor). | ✓ |
| Remember last used | Per-session memory of last view mode. | |

**User's choice:** Source view first

### Toggle Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Tab bar area | Small toggle in the tab bar row. | |
| Content header bar | Bar between tabs and content showing filename, file size, and toggle. | ✓ |

**User's choice:** Content header bar

### Non-XML File Handling

| Option | Description | Selected |
|--------|-------------|----------|
| XML only | Only .xml files openable. Others show a message. | |
| Open anything as text | Any file openable in source view. Tree view only for valid XML. | ✓ |

**User's choice:** Open anything as text

### File Reading Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Read entire file | Simple approach -- read full content into memory via Rust. Loading spinner. | ✓ |
| Stream with progress | Stream in chunks from Rust. Better UX for very large files but more complex. | |
| Read with size guard | Read whole file but check size first. Warn above threshold. | |

**User's choice:** Read entire file

### File I/O Path

| Option | Description | Selected |
|--------|-------------|----------|
| Rust command | New read_file_cmd. Consistent with Phase 2 pattern. Extensible for Phase 4. | ✓ |
| Frontend FS plugin | Use @tauri-apps/plugin-fs directly. Simpler but less extensible. | |

**User's choice:** Rust command

### Monaco XML Features

| Option | Description | Selected |
|--------|-------------|----------|
| Syntax highlighting only | Coloring tags, attributes, comments. No folding. | |
| Highlighting + folding | Syntax highlighting plus code folding. Collapse XML elements. | ✓ |

**User's choice:** Highlighting + folding

---

## XML Tree View

### Tree Display Style

| Option | Description | Selected |
|--------|-------------|----------|
| VS Code-style | Element name as node label, attributes inline, text as child leaf. | ✓ |
| Table-style rows | Element name, attributes, value in separate columns. | |
| Tag preview | Compact preview of opening tag with text inline. | |

**User's choice:** VS Code-style

### Auto-Expand Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Root collapsed | Only root element visible. User expands manually. | ✓ |
| Expand 2 levels | Root and direct children expanded. | |
| Expand all | Entire tree expanded. | |

**User's choice:** Root collapsed

### XML Parsing Location

| Option | Description | Selected |
|--------|-------------|----------|
| Frontend (DOMParser) | Browser's built-in DOMParser. Simple, no extra Rust work. | ✓ |
| Rust backend | Parse in Rust (quick-xml), serialize tree to JSON. More control. | |

**User's choice:** Frontend (DOMParser)

### Special Nodes Display

| Option | Description | Selected |
|--------|-------------|----------|
| Distinct styled nodes | Comments, PIs, CDATA each with unique icon/color/styling. | ✓ |
| Hidden by default | Hidden with a toggle to show/hide. | |

**User's choice:** Distinct styled nodes

---

## Tab Interface

### Tab Limit

| Option | Description | Selected |
|--------|-------------|----------|
| No hard limit | Open as many as desired. Horizontal scroll on overflow. | ✓ |
| Soft limit with warning | No hard cap but indicator after threshold. | |
| Hard limit | Cap at maximum, prompt to close when exceeded. | |

**User's choice:** No hard limit

### Tab Labels

| Option | Description | Selected |
|--------|-------------|----------|
| Filename only | Just filename. Tooltip shows full path. Disambiguator for duplicates. | ✓ |
| Filename + client | Client code prefix (e.g., ABC / file1.xml). | |
| Filename + date | Date suffix (e.g., file1.xml (Dec 23)). | |

**User's choice:** Filename only

### Tab Persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Start fresh | No tab state saved. Opens with empty state each session. | ✓ |
| Persist open tabs | Save open file paths. Reopen on restart. | |

**User's choice:** Start fresh

### Empty Content Area

| Option | Description | Selected |
|--------|-------------|----------|
| Keep current empty state | Show existing getting-started message. | |
| File-focused welcome | Show "Click a file in the sidebar to open it". | |
| Context-aware | Adapt message based on whether sources are configured. | ✓ |

**User's choice:** Context-aware

### Duplicate Tab Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Switch to existing tab | Activate existing tab if file already open. No duplicates. | ✓ |
| Allow duplicates | Always open new tab. | |

**User's choice:** Switch to existing tab

---

## File Actions Surface

### Action Location

| Option | Description | Selected |
|--------|-------------|----------|
| Content header bar | Icon buttons always visible in header. | |
| Right-click context menu | Actions via right-click on tab or sidebar. | |
| Both | Header bar for common actions, context menu for full set. | ✓ |

**User's choice:** Both

### External Editor

| Option | Description | Selected |
|--------|-------------|----------|
| OS default | System's default app for the file type. | ✓ |
| Configurable editor | Setting for external editor path. | |
| OS default for now | Start with OS default, add config later if needed. | ✓ |

**User's choice:** OS default for now

### Save Copy Dialog

| Option | Description | Selected |
|--------|-------------|----------|
| Native save dialog | Tauri's native Save As dialog. Already available via plugin. | ✓ |
| Save to downloads | Auto-save to Downloads folder with toast notification. | |

**User's choice:** Native save dialog

---

## Claude's Discretion

None -- user made explicit choices for all decisions.

## Deferred Ideas

None -- discussion stayed within phase scope.
