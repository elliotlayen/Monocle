---
phase: 03-xml-file-viewing
verified: 2026-05-26T16:11:34Z
status: human_needed
score: 4/4
overrides_applied: 0
re_verification:
  previous_status: gaps_found
  previous_score: 0/4
  gaps_closed:
    - "Clicking a file in the tree opens it in a collapsible tree view showing elements, attributes, namespaces, comments, and processing instructions"
    - "User can toggle between tree view and syntax-highlighted raw source view for the same file"
    - "User can open multiple files in tabs, each maintaining its own view mode and scroll position"
    - "User can copy a file's full path, open it in an external editor, copy raw content, or save a copy to another location"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Open an XML file and toggle to tree view -- verify elements show tag names, inline attributes, and namespace prefixes"
    expected: "Collapsible tree renders with chevrons, element names, attributes as name=value pairs, xmlns attributes visible"
    why_human: "Visual rendering and layout cannot be verified by grep -- need to confirm tree nodes display correctly with proper styling"
  - test: "Open a malformed XML file and confirm tree toggle is disabled with error banner"
    expected: "Amber warning banner says 'Unable to parse XML tree -- showing source view' and the Tree button is grayed out/disabled"
    why_human: "Runtime parse error detection and conditional UI state require a running app"
  - test: "Right-click a file tab and use Copy Path, then paste -- confirm clipboard has the file path"
    expected: "Clipboard contains the full filesystem path; toast appears briefly confirming copy"
    why_human: "Clipboard integration with Tauri plugin requires a running Tauri environment"
  - test: "Use Save Copy from context menu and verify native save dialog appears and file is written"
    expected: "OS native save dialog opens, writing to chosen location succeeds, success toast appears"
    why_human: "Native dialog integration and filesystem write require a running Tauri environment"
---

# Phase 3: XML File Viewing Verification Report

**Phase Goal:** Users can open and inspect XML integration files with the same ease as a code editor, viewing structure or raw source across multiple tabs
**Verified:** 2026-05-26T16:11:34Z
**Status:** human_needed
**Re-verification:** Yes -- after gap closure

## Re-verification Summary

Previous verification (2026-05-26T15:59:01Z) found 0/4 truths verified. Plans 02 and 03 had not been executed. All three plans are now complete with SUMMARY files. All 4 previously-failed truths are now verified at the code level.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Clicking a file in the tree opens it in a collapsible tree view showing elements, attributes, namespaces, comments, and processing instructions | VERIFIED | xml-parser.ts: DOMParser wrapper with ParseResult type. xml-tree-view.tsx: Renders XmlTreeNode with expand/collapse via expandedIds Set (starts empty = collapsed). xml-tree-node.tsx: Handles Element (nodeType 1) with tagName + inline attributes, Text (3), CDATA (4), PI (7), Comment (8). Namespace prefixes preserved in tagName (tested: soap:Envelope). xmlns attributes shown inline. |
| 2 | User can toggle between tree view and syntax-highlighted raw source view for the same file | VERIFIED | file-content-header.tsx: Tree/Source segmented toggle calls setViewMode. file-content-area.tsx: Conditional render -- showTreeView ? XmlTreeView : XmlSourceView. Parse error disables tree toggle (parseError flag). Monaco Editor provides XML syntax highlighting. |
| 3 | User can open multiple files in tabs, each maintaining its own view mode and scroll position | VERIFIED | store.ts: tabs array with openFile (dedup via existing tab check), closeTab/closeOtherTabs/closeAllTabs. FileTab type has per-tab viewMode and scrollPosition { source: number, tree: number }. XmlTreeView restores scroll on mount. XmlSourceView has same pattern. 16 store tests + 11 parser tests all passing. |
| 4 | User can copy a file's full path, open it in an external editor, copy raw content, or save a copy to another location | VERIFIED | use-file-actions.ts: copyPath (writeText from @tauri-apps/plugin-clipboard-manager), copyContent (writeText), openExternal (openPath from @tauri-apps/plugin-opener), saveCopy (save dialog + writeFile from @tauri-apps/plugin-fs). All 4 actions wired to: header buttons (copyPath, copyContent), tab context menu (all 4), sidebar file context menu (all 4). Tauri plugins installed in package.json + Cargo.toml, registered in lib.rs, capabilities granted in default.json. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src-tauri/src/commands/explorer.rs` | read_file_cmd Rust command | VERIFIED | FileContent struct + read_file_cmd at line 113, registered in lib.rs generate_handler |
| `src/features/explorer/store.ts` | Tab state management with parseError | VERIFIED | 449 lines. openFile, closeTab, closeOtherTabs, closeAllTabs, setActiveTab, setViewMode, setScrollPosition. parseXml imported and called during openFile to set parseError. |
| `src/features/explorer/store.test.ts` | Store tab management tests | VERIFIED | 16 test cases including 3 parseError tests (malformed XML, valid XML, non-XML) |
| `src/features/explorer/components/file-tab-bar.tsx` | Horizontal scrollable tab bar | VERIFIED | FileTabBar component renders tabs with close/switch/context menu |
| `src/features/explorer/components/xml-source-view.tsx` | Monaco XML source view | VERIFIED | XmlSourceView with Monaco Editor, XML language, folding, scroll persistence |
| `src/features/explorer/utils/xml-parser.ts` | DOMParser wrapper with error detection | VERIFIED | 20 lines. parseXml function + ParseResult interface. Handles empty input, whitespace, malformed XML via parsererror detection. |
| `src/features/explorer/utils/xml-parser.test.ts` | Parser tests | VERIFIED | 11 tests covering valid XML, malformed XML, empty input, whitespace, comments, CDATA, PIs, namespace prefixes |
| `src/features/explorer/components/xml-tree-view.tsx` | Collapsible XML tree from parsed DOM | VERIFIED | 80 lines. Uses parseXml via useMemo, expandedIds Set for collapse state, scroll persistence via ref, renders XmlTreeNode for root element. |
| `src/features/explorer/components/xml-tree-node.tsx` | Node renderer for elements, text, comments, PIs, CDATA | VERIFIED | 227 lines. Switch on nodeType: Element (1) with chevron + tagName + inline attrs, Text (3), CDATA (4), PI (7), Comment (8). Each type has distinct icon and styling. |
| `src/features/explorer/hooks/use-file-actions.ts` | File action handlers | VERIFIED | 49 lines. copyPath, copyContent, openExternal, saveCopy. Uses clipboard-manager, opener, dialog, fs plugins. Error handling + toasts. |
| `src/features/explorer/components/file-content-area.tsx` | Content area with tree/source conditional render | VERIFIED | 71 lines. Imports XmlTreeView + XmlSourceView. showTreeView conditional on viewMode, isXml, and !parseError. Parse error banner rendered when applicable. |
| `src/features/explorer/components/file-content-header.tsx` | Header with toggle and action buttons | VERIFIED | 122 lines. Tree/Source toggle with disabled state on parseError. Copy Path + Copy Content buttons with onClick handlers wired to useFileActions. |
| `src/features/explorer/components/file-tab.tsx` | Tab with full context menu | VERIFIED | 111 lines. Context menu: Close, Close Others, Close All, Copy Path, Open in External Editor, Copy Content, Save Copy. All wired to useFileActions. |
| `src/features/explorer/components/folder-tree-node.tsx` | File node with context menu | VERIFIED | 406 lines. File nodes wrapped in ContextMenu with Copy Path, Open in External Editor, Copy Content (disabled if not open), Save Copy (disabled if not open). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| folder-tree-node.tsx | store.ts | onFileClick -> openFile | WIRED | FolderTreeNode onClick calls onFileClick(node.path) |
| store.ts | explorer-service.ts | explorerService.readFile | WIRED | openFile action calls explorerService.readFile(filePath) |
| explorer-service.ts | tauri.ts | tauri.readFile | WIRED | readFile method invokes read_file_cmd |
| explorer-shell.tsx | file-tab-bar.tsx | conditional render | WIRED | FileTabBar rendered when tabs.length > 0 (line 38) |
| explorer-shell.tsx | file-content-area.tsx | conditional render | WIRED | FileContentArea rendered when tabs.length > 0 (line 39) |
| file-content-area.tsx | xml-tree-view.tsx | conditional render when viewMode is tree | WIRED | Import line 7, render line 55. Conditional: showTreeView ? XmlTreeView : XmlSourceView |
| xml-tree-view.tsx | xml-parser.ts | parseXml call on content | WIRED | Import line 3, useMemo call line 21: parseXml(content) |
| file-content-header.tsx | use-file-actions.ts | useFileActions hook | WIRED | Import line 12, destructure line 22, onClick on buttons lines 98/110 |
| file-tab.tsx | use-file-actions.ts | useFileActions hook | WIRED | Import line 16, destructure line 36, context menu items lines 104-107 |
| folder-tree-node.tsx | use-file-actions.ts | useFileActions hook | WIRED | Import line 32, destructure line 59, context menu items lines 279-289 |
| use-file-actions.ts | @tauri-apps/plugin-clipboard-manager | writeText import | WIRED | Import line 2 |
| use-file-actions.ts | @tauri-apps/plugin-opener | openPath import | WIRED | Import line 3 |
| use-file-actions.ts | @tauri-apps/plugin-dialog | save import | WIRED | Import line 4 |
| use-file-actions.ts | @tauri-apps/plugin-fs | writeFile import | WIRED | Import line 5 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| xml-source-view.tsx | content (prop) | store.ts -> explorerService.readFile -> read_file_cmd | Yes (Rust reads file from filesystem) | FLOWING |
| xml-tree-view.tsx | content (prop) | store.ts -> explorerService.readFile -> read_file_cmd -> parseXml | Yes (DOMParser produces Document from file content) | FLOWING |
| file-content-header.tsx | tab (prop) | store.ts activeTab | Yes (tab populated by openFile action) | FLOWING |
| file-tab.tsx | tab (prop) | store.ts tabs array | Yes (tab populated by openFile action) | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Build compiles (tsc + vite) | npm run build | Success (user confirmed) | PASS |
| All tests pass | npm run test | 176/176 tests pass (user confirmed) | PASS |
| cargo check passes | cargo check (in src-tauri/) | Success (user confirmed) | PASS |
| xml-parser.ts exists and substantive | wc -l + content check | 20 lines, DOMParser wrapper | PASS |
| xml-tree-view.tsx exists and substantive | wc -l + content check | 80 lines, collapsible tree | PASS |
| xml-tree-node.tsx exists and substantive | wc -l + content check | 227 lines, 5 node type renderers | PASS |
| use-file-actions.ts exists and substantive | wc -l + content check | 49 lines, 4 action handlers with plugin calls | PASS |
| Header buttons have onClick handlers | grep onClick in file-content-header.tsx | copyPath and copyContent wired | PASS |
| Tab context menu has file actions | grep in file-tab.tsx | Copy Path, Open in External Editor, Copy Content, Save Copy all present | PASS |
| Sidebar file context menu exists | grep in folder-tree-node.tsx | File nodes wrapped in ContextMenu with all 4 actions | PASS |

### Probe Execution

Step 7c: SKIPPED (no probes declared in PLAN or conventional paths)

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| BRWS-04 | 03-02 | Collapsible tree view showing elements, attributes, namespaces, comments, PIs | SATISFIED | xml-parser.ts, xml-tree-view.tsx, xml-tree-node.tsx implement full tree with all node types. Namespace prefixes preserved in tagName (test verified). |
| BRWS-05 | 03-01 | Syntax-highlighted raw source and toggle between tree/source views | SATISFIED | Monaco Editor with XML language for source view. Tree/Source toggle in header with conditional render in content area. |
| BRWS-06 | 03-01, 03-02 | Multiple files in tabs, each maintaining own view state | SATISFIED | FileTab type with per-tab viewMode and scrollPosition { source, tree }. Store manages tab CRUD, view mode, and scroll persistence. |
| BRWS-07 | 03-03 | Copy path, open external, copy content, save copy | SATISFIED | use-file-actions.ts with 4 handlers using Tauri plugins. Accessible from header buttons, tab context menu, and sidebar file context menu. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (none) | -- | -- | -- | No debt markers, placeholder text, or stub patterns found in any modified file |

### Human Verification Required

### 1. XML Tree View Visual Rendering

**Test:** Open an XML file with nested elements, attributes, namespace prefixes (e.g., a SOAP envelope), comments, and processing instructions. Toggle to tree view.
**Expected:** Collapsible tree renders with chevron icons on expandable nodes, element tag names (including namespace prefixes like `soap:Envelope`), inline attributes as `name="value"` pairs, xmlns attributes visible. Comments show in italics with `<!-- -->` wrapping. PIs show with `<? ?>` wrapping. Expanding/collapsing nodes works via click.
**Why human:** Visual rendering, icon display, color styling, and interactive expand/collapse behavior cannot be verified by static code analysis.

### 2. Parse Error Handling

**Test:** Open a malformed XML file (e.g., one with unclosed tags). Check the tree/source toggle behavior.
**Expected:** Amber warning banner appears stating "Unable to parse XML tree -- showing source view." The Tree toggle button is visually disabled/grayed out and cannot be clicked. Source view displays the raw content normally.
**Why human:** Runtime parse error detection and conditional UI state (disabled button styling, banner appearance) require a running app to observe.

### 3. Clipboard and File Actions

**Test:** Right-click a file tab and select "Copy Path." Paste into a text editor. Then try "Copy Content," "Open in External Editor," and "Save Copy."
**Expected:** Copy Path puts the full filesystem path in clipboard with a brief success toast. Copy Content puts raw file text in clipboard with toast. Open in External Editor launches the OS default app for that file type. Save Copy opens a native save dialog and writes the file to the chosen location with success toast.
**Why human:** Clipboard integration, native dialog, external app launching, and toast notifications all require a running Tauri environment to test.

### 4. Sidebar File Context Menu

**Test:** Right-click a file node in the sidebar tree (not a folder). Verify the context menu items.
**Expected:** Context menu shows: Copy Path, Open in External Editor, Copy Content (disabled if file not open in a tab), Save Copy (disabled if file not open in a tab). All items work when enabled.
**Why human:** Context menu rendering position, disabled state visual appearance, and plugin action execution require a running app.

### Gaps Summary

No code-level gaps found. All 4 previously-failed truths are now verified with full artifact existence, substantive implementation, wiring, and data flow. The 4 human verification items above are standard runtime checks that cannot be performed by static analysis -- they verify visual rendering, Tauri plugin integration, and interactive behavior in the running app.

---

_Verified: 2026-05-26T16:11:34Z_
_Verifier: Claude (gsd-verifier)_
