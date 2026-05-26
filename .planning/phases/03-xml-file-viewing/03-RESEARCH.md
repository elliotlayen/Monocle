# Phase 3: XML File Viewing - Research

**Researched:** 2026-05-26
**Domain:** Tauri desktop app -- XML file viewing with Monaco editor, DOMParser tree, tabbed interface
**Confidence:** HIGH

## Summary

Phase 3 extends the existing Integration Explorer (Phases 1-2) with a tabbed file viewer: users click files in the sidebar tree and view them in either a syntax-highlighted source view (Monaco Editor) or a collapsible XML tree view (browser DOMParser). The technology stack is almost entirely already in place -- Monaco is bundled (just needs XML language contribution loaded), DOMParser is a built-in browser API, and Tauri plugins for file dialog/FS are configured. The main new infrastructure is a Rust `read_file_cmd` command, clipboard access via `@tauri-apps/plugin-clipboard-manager`, the `opener:allow-open-path` permission for opening files externally, and significant Zustand store extension for tab/file state.

No third-party UI libraries are needed. The XML tree view is hand-built from Radix/shadcn primitives (consistent with the folder tree in Phase 2). The tab bar is a custom component (not shadcn Tabs) to support close buttons and horizontal scroll overflow. All decisions are locked in CONTEXT.md with detailed UI-SPEC contracts.

**Primary recommendation:** Build incrementally in this order: (1) Rust `read_file_cmd` + service layer, (2) store extension for tabs, (3) tab bar component, (4) Monaco XML source view, (5) XML tree view, (6) file actions, (7) wire into ExplorerShell and FolderTreeNode.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Source view uses Monaco Editor (already bundled for SQL). Add XML language contribution with syntax highlighting and code folding. Read-only mode.
- **D-02:** Source view is the default when opening a file. Users toggle to tree view from the content header bar.
- **D-03:** Any file can be opened as text in the source view (not just XML). Tree view is only available for valid XML files.
- **D-04:** File content is read entirely into memory via a new Rust Tauri command (`read_file_cmd` or similar). No streaming or chunking. Simple loading spinner while reading.
- **D-05:** The file reading path goes through Rust (new Tauri command), consistent with Phase 2's directory listing pattern. Enables future Phase 4 validation additions in Rust without frontend changes.
- **D-06:** Monaco gets XML syntax highlighting plus code folding (collapse XML elements). No autocomplete or validation markers -- this is read-only viewing.
- **D-07:** VS Code-style tree rendering: element name as node label, attributes shown inline after the tag name.
- **D-08:** Tree starts fully collapsed -- only the root element visible. User expands manually.
- **D-09:** XML parsing for the tree view happens on the frontend using the browser's built-in DOMParser. No Rust-side XML parsing in this phase.
- **D-10:** Comments, processing instructions, and CDATA sections appear as distinct styled nodes in the tree.
- **D-11:** No hard limit on open tabs. Tabs scroll horizontally when they overflow the tab bar.
- **D-12:** Tab labels show filename only. Full path shown in tooltip. Duplicate names get parent folder disambiguator.
- **D-13:** Tabs do not persist across sessions. App opens with no tabs and the empty state view.
- **D-14:** Clicking a file already open in a tab switches to that existing tab. No duplicate tabs.
- **D-15:** Content area empty state is context-aware.
- **D-16:** A header bar between the tabs and the content area shows filename, file size, and a tree/source toggle control.
- **D-17:** File actions available in header bar (copy path, copy content) and context menu (full set).
- **D-18:** "Open in external editor" uses OS default application. No configurable editor path.
- **D-19:** "Save a copy" uses Tauri's native save dialog.

### Claude's Discretion

No discretion areas specified -- all decisions are locked.

### Deferred Ideas (OUT OF SCOPE)

None -- discussion stayed within phase scope.

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BRWS-04 | User can view an XML file in a collapsible tree view showing elements, attributes, namespaces, comments, and processing instructions | DOMParser API, XmlTreeView/XmlTreeNode components, node type handling for all 5 XML node categories |
| BRWS-05 | User can view an XML file as syntax-highlighted raw source and toggle between tree and source views | Monaco Editor XML language contribution, XmlSourceView component, view mode toggle in FileContentHeader |
| BRWS-06 | User can open multiple XML files in tabs, each maintaining its own view state | Zustand store tab state, FileTabBar/FileTab components, per-tab viewMode and scrollPosition |
| BRWS-07 | User can copy a file's full path, open it in an external editor, copy raw content, or export/save a copy | Clipboard-manager plugin for copy, opener plugin openPath for external editor, dialog+fs plugins for save copy |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Components are presentational only** -- props in, UI out, no direct Tauri IPC calls
- **All Tauri IPC goes through services layer** (`src/features/*/services/`)
- **UI components use shadcn/ui** from `src/components/ui/`
- **Store via Zustand** with `useShallow` selectors
- **Adding a new Tauri command** requires: Rust command in `commands/*.rs`, register in `lib.rs`, add to `src/services/tauri.ts`, create feature service wrapper
- **Type consistency**: TypeScript types must mirror Rust types with camelCase (Rust uses `#[serde(rename_all = "camelCase")]`)
- **Validation at end of task**: `npm run lint`, `npm run test`, `npm run build`, `cargo check` if Rust changed
- **No emojis** in code, comments, commits, or documentation
- **Commit messages**: No "Generated with Claude Code" or "Co-Authored-By" lines

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| File content reading | Rust backend (Tauri command) | -- | D-05 locks this: Rust command enables Phase 4 validation additions without frontend changes. Network I/O with timeout/cancellation follows Phase 2 pattern. |
| XML parsing for tree view | Browser / Client (DOMParser) | -- | D-09 locks this: browser built-in DOMParser, no Rust-side XML parsing. |
| XML syntax highlighting | Browser / Client (Monaco Editor) | -- | Monaco runs entirely in browser. XML language contribution loaded via dynamic import. |
| Tab state management | Browser / Client (Zustand store) | -- | Client-only state, no persistence across sessions (D-13). |
| Clipboard write | Rust backend (Tauri plugin) | -- | `@tauri-apps/plugin-clipboard-manager` avoids browser security prompts. |
| Open in external editor | Rust backend (Tauri opener plugin) | -- | `@tauri-apps/plugin-opener` openPath uses OS default app (D-18). |
| Save file copy | Rust backend (Tauri dialog + fs plugins) | Browser / Client (dialog trigger) | Frontend triggers save dialog, Tauri writes file. Already in use by canvas feature. |

## Standard Stack

### Core (already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `monaco-editor` | ^0.55.1 | XML syntax highlighting, code folding, read-only source view | Already bundled for SQL; XML language contribution ships with it [VERIFIED: local node_modules inspection] |
| `@monaco-editor/react` | ^4.7.0 | React wrapper for Monaco Editor | Already used by `SqlCodeBlock` component [VERIFIED: codebase inspection] |
| `zustand` | ^5.0.9 | Tab/file state management in explorer store | Already the app-wide state management pattern [VERIFIED: codebase inspection] |
| `@tauri-apps/api` | ^2.9.1 | `invoke` for calling Rust commands | Core Tauri IPC mechanism [VERIFIED: codebase inspection] |
| `@tauri-apps/plugin-dialog` | ^2.6.0 | Native save dialog for "Save Copy" feature | Already used by canvas-file-service [VERIFIED: codebase inspection] |
| `@tauri-apps/plugin-fs` | ^2.4.5 | `writeFile` for saving copy to chosen destination | Already used by canvas-file-service and export-service [VERIFIED: codebase inspection] |
| `@tauri-apps/plugin-opener` | ^2.5.2 (installed) | `openPath` for "Open in External Editor" | Already installed, just needs `allow-open-path` permission added [VERIFIED: local node_modules inspection] |
| `lucide-react` | ^0.555.0 | Icons (X, FileCode, FileText, Code, TreePine, Copy, etc.) | Already the app-wide icon library [VERIFIED: codebase inspection] |

### New Dependencies

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@tauri-apps/plugin-clipboard-manager` | 2.3.2 (npm) | `writeText` for copy-to-clipboard actions (copy path, copy content) | Required for BRWS-07 clipboard operations without browser security prompts [VERIFIED: npm registry, slopcheck OK, official Tauri docs] |
| `tauri-plugin-clipboard-manager` | 2.3.2 (Cargo) | Rust-side clipboard plugin init | Paired with npm package above [VERIFIED: crates.io registry] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@tauri-apps/plugin-clipboard-manager` | `navigator.clipboard.writeText()` | Browser API may trigger security prompts in Tauri webview (especially on Linux); plugin is consistent with Tauri patterns. Plugin preferred. |
| Custom `read_file_cmd` Rust command | `readTextFile` from `@tauri-apps/plugin-fs` | FS plugin can read files directly, but D-05 mandates Rust command for Phase 4 extensibility. Locked decision. |
| Custom tab bar component | shadcn `Tabs` | shadcn Tabs uses Radix TabsPrimitive which does not support close buttons or scrollable overflow. Custom implementation required per UI-SPEC. |

**Installation (Phase 3 new dependencies only):**
```bash
# Frontend
npm install @tauri-apps/plugin-clipboard-manager

# Backend (add to src-tauri/Cargo.toml)
# tauri-plugin-clipboard-manager = "2"
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@tauri-apps/plugin-clipboard-manager` | npm | ~2 yrs (Tauri v2 era) | Part of official Tauri plugins-workspace | [github.com/tauri-apps/plugins-workspace](https://github.com/tauri-apps/plugins-workspace) | [OK] | Approved |
| `tauri-plugin-clipboard-manager` | crates.io | ~2 yrs | Official Tauri ecosystem | Same as above | [OK] | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*Note: slopcheck was installed and run successfully. The `@tauri-apps/plugin-clipboard-manager` package passed with [OK] status. It is part of the official `tauri-apps/plugins-workspace` monorepo.*

## Architecture Patterns

### System Architecture Diagram

```
User clicks file in sidebar
        |
        v
FolderTreeNode (onClick handler)
        |
        v
ExplorerStore.openFile(path)
        |
        +--- Check if tab already open --> Switch to existing tab (D-14)
        |
        +--- New file:
             |
             v
        explorerService.readFile(path)
             |
             v
        tauri.readFile(path)    -- invoke("read_file_cmd", { path })
             |
             v
        Rust: read_file_cmd
        (spawn_blocking + std::fs::read_to_string + metadata)
        (timeout: 15s, same pattern as list_directory_cmd)
             |
             v
        Returns { content: string, size: number }
             |
             v
        Store adds tab: { filePath, fileName, content, size, viewMode, ... }
             |
             v
        ExplorerShell renders:
        +------------------------------------------+
        | FileTabBar (active tab highlighted)      |
        +------------------------------------------+
        | FileContentHeader (name, size, toggle)   |
        +------------------------------------------+
        | XmlSourceView (Monaco, default)          |
        |   or                                     |
        | XmlTreeView (DOMParser-based)            |
        +------------------------------------------+

        View mode toggle:
        Source <--> Tree (per-tab, scroll position preserved)

        DOMParser flow (tree view only):
        content string --> new DOMParser().parseFromString(content, "text/xml")
                      --> Check for <parsererror> --> parseError flag
                      --> Walk DOM tree recursively --> XmlTreeNode components
```

### Recommended Project Structure

```
src/features/explorer/
  components/
    file-tab-bar.tsx           # Scrollable tab bar with close buttons
    file-tab.tsx               # Individual tab with context menu
    file-content-area.tsx      # Container: header + source/tree view
    file-content-header.tsx    # Filename, size, toggle, action buttons
    xml-source-view.tsx        # Monaco Editor wrapper (read-only XML)
    xml-tree-view.tsx          # Collapsible XML tree from DOMParser
    xml-tree-node.tsx          # Single tree row (element/text/comment/PI/CDATA)
    explorer-shell.tsx         # MODIFIED: conditionally render tabs + content
    explorer-empty-state.tsx   # MODIFIED: context-aware messaging (D-15)
    folder-tree-node.tsx       # MODIFIED: file onClick, context menu
  hooks/
    use-file-actions.ts        # Clipboard, open external, save copy logic
  services/
    explorer-service.ts        # EXTENDED: readFile method
  utils/
    xml-parser.ts              # DOMParser wrapper with error handling
    file-size-format.ts        # Format bytes to human-readable (KB, MB)
    tab-disambiguator.ts       # Resolve duplicate tab filenames
  store.ts                     # EXTENDED: tab/file state
  types.ts                     # EXTENDED: FileTab, ViewMode types

src/services/
  tauri.ts                     # EXTENDED: readFile command

src/lib/
  monaco-xml-loader.ts         # Lazy XML language contribution loader

src-tauri/src/
  commands/
    explorer.rs                # EXTENDED: read_file_cmd
  commands/mod.rs              # EXTENDED: export read_file_cmd
  lib.rs                       # EXTENDED: register read_file_cmd
```

### Pattern 1: Lazy Monaco XML Language Loading

**What:** Extend the existing `ensureMonacoSqlLoaded` pattern to load XML language support.
**When to use:** Before rendering XmlSourceView for the first time.

```typescript
// Source: Existing pattern in src/lib/monaco-sql-loader.ts [VERIFIED: codebase]
// New file: src/lib/monaco-xml-loader.ts
import { loader } from "@monaco-editor/react";

let monacoXmlLoadPromise: Promise<void> | null = null;

export const ensureMonacoXmlLoaded = () => {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }

  if (monacoXmlLoadPromise) {
    return monacoXmlLoadPromise;
  }

  monacoXmlLoadPromise = Promise.all([
    import("monaco-editor/esm/vs/editor/editor.api"),
    import("monaco-editor/esm/vs/basic-languages/xml/xml.contribution.js"),
  ]).then(([localMonaco]) => {
    loader.config({ monaco: localMonaco });
  });

  return monacoXmlLoadPromise;
};
```

**Note:** The XML contribution at `monaco-editor/esm/vs/basic-languages/xml/xml.contribution.js` exists in the installed package. [VERIFIED: local filesystem check]

### Pattern 2: Rust File Reading Command

**What:** New `read_file_cmd` following the established `list_directory_cmd` pattern.
**When to use:** Called when user clicks a file in the sidebar tree.

```rust
// Source: Pattern from src-tauri/src/commands/explorer.rs [VERIFIED: codebase]
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileContent {
    pub content: String,
    pub size: u64,
}

#[tauri::command]
pub async fn read_file_cmd(path: String) -> Result<FileContent, String> {
    tokio::time::timeout(
        Duration::from_secs(30),
        tokio::task::spawn_blocking(move || {
            let metadata = std::fs::metadata(&path)
                .map_err(|e| format!("Failed to read file '{}': {}", path, e))?;
            let size = metadata.len();
            let content = std::fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read file '{}': {}", path, e))?;
            Ok(FileContent { content, size })
        }),
    )
    .await
    .map_err(|_| "File read timed out after 30 seconds".to_string())?
    .map_err(|e| format!("File read task failed: {}", e))?
}
```

**Key detail:** Uses `std::fs::read_to_string` (blocking I/O via `spawn_blocking`) with 30s timeout. Network share files over VPN may be slow. 30s is more generous than directory listing's 15s because file reads are single operations, not iterative.

### Pattern 3: Zustand Store Extension for Tabs

**What:** Extend the existing `useExplorerStore` with tab management state and actions.
**When to use:** Add to the existing store, not a separate store.

```typescript
// Source: Pattern from src/features/explorer/store.ts [VERIFIED: codebase]
// New types in types.ts:
export type ViewMode = "source" | "tree";

export interface FileTab {
  id: string;           // file path as unique ID
  filePath: string;
  fileName: string;     // display name (with disambiguator if needed)
  content: string;      // raw file content
  fileSize: number;     // bytes
  viewMode: ViewMode;   // default: "source" (D-02)
  scrollPosition: { source: number; tree: number };
  isXml: boolean;
  parseError: boolean;
  isLoading: boolean;
}

// New store state:
interface ExplorerStore {
  // ... existing state ...
  tabs: FileTab[];
  activeTabId: string | null;

  // New actions:
  openFile: (filePath: string) => Promise<void>;
  closeTab: (tabId: string) => void;
  closeOtherTabs: (tabId: string) => void;
  closeAllTabs: () => void;
  setActiveTab: (tabId: string) => void;
  setViewMode: (tabId: string, mode: ViewMode) => void;
  setScrollPosition: (tabId: string, view: ViewMode, position: number) => void;
}
```

### Pattern 4: DOMParser XML Parsing with Error Detection

**What:** Parse XML content using browser DOMParser, detect errors, walk the tree.
**When to use:** When user switches to tree view for an XML file.

```typescript
// Source: MDN DOMParser API [CITED: developer.mozilla.org/en-US/docs/Web/API/DOMParser]
export interface ParseResult {
  document: Document | null;
  error: string | null;
}

export function parseXml(content: string): ParseResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, "text/xml");

  // DOMParser does not throw on error -- it returns a document with a
  // <parsererror> element. Check for this.
  const errorNode = doc.querySelector("parsererror");
  if (errorNode) {
    return { document: null, error: errorNode.textContent ?? "Parse error" };
  }

  return { document: doc, error: null };
}

// Node type constants for walking the DOM tree:
// Node.ELEMENT_NODE = 1
// Node.TEXT_NODE = 3
// Node.CDATA_SECTION_NODE = 4
// Node.PROCESSING_INSTRUCTION_NODE = 7
// Node.COMMENT_NODE = 8
```

**Key detail:** DOMParser does NOT throw on malformed XML. It returns a document containing a `<parsererror>` element. The code must check for this element to detect parse failures. [CITED: developer.mozilla.org/en-US/docs/Web/API/DOMParser/parseFromString]

### Pattern 5: File Actions via Tauri Plugins

**What:** Clipboard write, open external, save copy.

```typescript
// Clipboard (copy path, copy content):
// Source: [CITED: v2.tauri.app/plugin/clipboard/]
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
await writeText(filePath); // copy path
await writeText(content);  // copy content

// Open in external editor:
// Source: [VERIFIED: @tauri-apps/plugin-opener dist-js/index.d.ts]
import { openPath } from "@tauri-apps/plugin-opener";
await openPath(filePath); // opens with OS default app (D-18)

// Save copy:
// Source: Pattern from canvas-file-service.ts [VERIFIED: codebase]
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
const destPath = await save({ defaultPath: fileName });
if (destPath) {
  const encoder = new TextEncoder();
  await writeFile(destPath, encoder.encode(content));
}
```

### Anti-Patterns to Avoid

- **Reading files via `@tauri-apps/plugin-fs` directly:** D-05 mandates Rust command. This ensures Phase 4 can add validation in the same read path without changing the frontend.
- **Using `navigator.clipboard.writeText()`:** May trigger security prompts in Tauri webview. Use the official clipboard-manager plugin instead.
- **Parsing XML in Rust:** D-09 locks XML parsing to frontend DOMParser. No Rust XML crates needed in this phase.
- **Using shadcn Tabs component for file tabs:** Radix TabsPrimitive does not support close buttons or scrollable horizontal overflow. Build custom FileTabBar.
- **Attempting to persist tab state:** D-13 explicitly says no tab persistence across sessions.
- **Creating a separate Zustand store for tabs:** Extend the existing `useExplorerStore` to keep tab state co-located with sidebar state.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| XML syntax highlighting | Custom tokenizer/highlighter | Monaco Editor + XML contribution | Monaco handles edge cases (CDATA, PIs, namespaces, entities). Already bundled. |
| XML parsing for tree | Custom XML parser | Browser DOMParser | Built-in, handles all XML node types correctly. Zero bundle size impact. |
| File save dialog | Custom file picker | `@tauri-apps/plugin-dialog` `save()` | Native OS dialog, consistent UX, already configured. |
| Clipboard access | `navigator.clipboard` | `@tauri-apps/plugin-clipboard-manager` | Avoids webview security prompts, consistent with Tauri plugin patterns. |
| Open file externally | Custom shell commands | `@tauri-apps/plugin-opener` `openPath()` | Cross-platform OS default app opening, already installed. |
| File size formatting | Inline math | Dedicated utility function | Reusable across phases; handles KB/MB/GB with proper rounding. |

**Key insight:** This phase has zero heavy dependencies to add. Monaco (for source view) and DOMParser (for tree view) are both already available. The only new package is the Tauri clipboard plugin.

## Common Pitfalls

### Pitfall 1: DOMParser Silent Parse Failure

**What goes wrong:** DOMParser does not throw exceptions on malformed XML. Instead, it returns a document containing a `<parsererror>` element. Code that does not check for this will render a broken tree.
**Why it happens:** Developers expect parsing errors to throw, like JSON.parse does.
**How to avoid:** Always check `doc.querySelector("parsererror")` after `parseFromString`. If found, set `parseError: true` on the tab and force source view (D-10 specific handling).
**Warning signs:** Tree view renders with weird `<parsererror>` nodes visible.

### Pitfall 2: Monaco Editor Memory Leaks with Multiple Instances

**What goes wrong:** Creating a new Monaco Editor instance per tab without disposing old ones causes memory to grow unboundedly as users open/close tabs.
**Why it happens:** Monaco editors maintain their own internal model state. If the React component unmounts but the editor model is not disposed, it leaks.
**How to avoid:** Only render ONE Monaco Editor instance at a time (the active tab). When switching tabs, update the editor's value/model rather than unmounting/remounting. Use `editor.setValue()` or switch models. Alternatively, since this is read-only, simply key the Editor component by `activeTabId` to force unmount/remount (simpler approach).
**Warning signs:** Memory usage grows linearly with number of tab switches.

### Pitfall 3: Scroll Position Loss on View Toggle

**What goes wrong:** User scrolls deep into a file in source view, switches to tree view and back, and their scroll position is lost.
**Why it happens:** Unmounting Monaco or the tree view resets scroll state.
**How to avoid:** Store `scrollPosition` per tab per view mode in the Zustand store. On mount, restore scroll position. For Monaco, use `editor.setScrollTop()`. For tree view, use `scrollArea.scrollTo()`.
**Warning signs:** Users lose their place when toggling between views.

### Pitfall 4: Tab Disambiguation Logic Edge Cases

**What goes wrong:** Two files named `file1.xml` from different paths don't get disambiguated, or the disambiguator shows unhelpful info.
**Why it happens:** Simple filename comparison without considering the parent folder structure.
**How to avoid:** When multiple open tabs share the same filename, compute the nearest unique parent folder for each and append it: `file1.xml - 20251223`. Recompute on tab open/close.
**Warning signs:** Two identical tab labels with no way to tell them apart.

### Pitfall 5: Network Share Timeout on File Read

**What goes wrong:** Reading a large file over VPN-accessed SMB share hangs the UI.
**Why it happens:** `std::fs::read_to_string` blocks until complete or error. Over slow networks this can take minutes.
**How to avoid:** The Rust command uses `tokio::time::timeout` (30s). On timeout, return an error. Frontend shows the loading spinner and can show error toast on failure.
**Warning signs:** Loading spinner stays indefinitely. App feels frozen.

### Pitfall 6: XML Namespace Handling in DOMParser

**What goes wrong:** Elements with namespaces (e.g., `<soap:Envelope xmlns:soap="...">`) may display incorrectly if the tree only shows `localName` vs `tagName`.
**Why it happens:** DOMParser fully resolves namespaces. `element.tagName` includes the prefix, `element.localName` does not.
**How to avoid:** Use `element.tagName` for display (preserves prefixes). Show `xmlns` attributes as regular attributes.
**Warning signs:** Namespace prefixes disappear or elements show unexpected names.

### Pitfall 7: Large Files Freezing the UI During DOMParser Parsing

**What goes wrong:** DOMParser runs synchronously on the main thread. A 10MB XML file may cause a noticeable UI freeze.
**Why it happens:** DOMParser.parseFromString is synchronous and cannot be moved to a web worker (DOM API not available in workers).
**How to avoid:** Parse lazily -- only parse when user switches to tree view, not on file open. Show a brief "Parsing..." state. For very large files (>5MB), consider warning the user. D-08 helps: tree starts collapsed, so rendering is fast even for large DOMs.
**Warning signs:** UI freezes for 1-2 seconds when switching to tree view on large files.

## Code Examples

### File Size Formatting Utility

```typescript
// New utility: src/features/explorer/utils/file-size-format.ts
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const value = bytes / Math.pow(k, i);
  // Show decimal only for KB and above, and only if not whole number
  if (i === 0) return `${bytes} B`;
  return `${value % 1 === 0 ? value : value.toFixed(1)} ${units[i]}`;
}
```

### Tab Disambiguator

```typescript
// New utility: src/features/explorer/utils/tab-disambiguator.ts
export function disambiguateTabNames(
  tabs: { filePath: string; fileName: string }[]
): Map<string, string> {
  const nameMap = new Map<string, string>();
  const nameCounts = new Map<string, number>();

  // Count duplicates
  for (const tab of tabs) {
    const base = tab.filePath.split(/[/\\]/).pop() ?? tab.fileName;
    nameCounts.set(base, (nameCounts.get(base) ?? 0) + 1);
  }

  // Build display names
  for (const tab of tabs) {
    const parts = tab.filePath.split(/[/\\]/);
    const base = parts.pop() ?? tab.fileName;
    if ((nameCounts.get(base) ?? 0) > 1 && parts.length > 0) {
      const parent = parts[parts.length - 1];
      nameMap.set(tab.filePath, `${base} - ${parent}`);
    } else {
      nameMap.set(tab.filePath, base);
    }
  }

  return nameMap;
}
```

### ExplorerShell Integration

```typescript
// Modified: src/features/explorer/components/explorer-shell.tsx
// Show FileTabBar + FileContentArea when tabs are open,
// ExplorerEmptyState when no tabs.

// Pseudocode (actual implementation in tasks):
const { tabs, activeTabId } = useExplorerStore(useShallow((s) => ({
  tabs: s.tabs,
  activeTabId: s.activeTabId,
})));

const hasOpenTabs = tabs.length > 0;

return (
  <div className="flex flex-col h-screen">
    <ExplorerNavBar onHome={onHome} onOpenSettings={onOpenSettings} />
    <div className="flex flex-row flex-1 overflow-hidden">
      <ExplorerSidebar />
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <SidebarToggle onClick={() => setSidebarOpen(true)} visible={!sidebarOpen} />
        {hasOpenTabs ? (
          <>
            <FileTabBar />
            <FileContentArea />
          </>
        ) : (
          <ExplorerEmptyState onOpenSettings={onOpenSettings} />
        )}
      </div>
    </div>
  </div>
);
```

### Tauri Capabilities Update

```json
// Modified: src-tauri/capabilities/default.json
{
  "permissions": [
    "core:default",
    "opener:default",
    "opener:allow-open-path",
    "updater:default",
    "process:default",
    "dialog:default",
    "fs:default",
    "fs:allow-write-text-file",
    "fs:allow-write-file",
    "fs:allow-read-file",
    "fs:allow-read-text-file",
    "clipboard-manager:allow-write-text"
  ]
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| prism-react-renderer for syntax highlighting | Monaco Editor (already in use since canvas feature) | Pre-Phase 3 | Monaco is already the standard in this codebase; no migration needed |
| `tauri::api::shell::open` (v1) | `@tauri-apps/plugin-opener` `openPath` (v2) | Tauri v2 migration | The opener plugin API is the correct v2 approach |
| `navigator.clipboard` | `@tauri-apps/plugin-clipboard-manager` | Tauri v2 plugin ecosystem | Plugin avoids webview security prompt issues |

**Deprecated/outdated:**
- `@tauri-apps/api/shell`: Removed in Tauri v2. Use `@tauri-apps/plugin-opener` instead. [CITED: v2.tauri.app/plugin/opener/]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `navigator.clipboard.writeText()` may trigger security prompts in Tauri webview | Standard Stack / Alternatives | LOW -- if it works without prompts, the clipboard-manager plugin is still the cleaner approach but could be skipped |
| A2 | DOMParser handles all XML node types (CDATA, PI, comments) correctly in the Tauri webview (WebKit on macOS, WebView2 on Windows) | Architecture Patterns | LOW -- DOMParser is a well-established web standard; unlikely to have issues in modern webviews |
| A3 | `std::fs::read_to_string` with 30s timeout is sufficient for VPN-accessed network share files | Pitfalls | MEDIUM -- very large files may take longer; but 30s aligns with the directory listing pattern |

## Open Questions

1. **Maximum file size handling**
   - What we know: D-04 says read entirely into memory, no streaming. DOMParser is synchronous.
   - What's unclear: Is there a practical upper limit? Files could potentially be several MB.
   - Recommendation: For MVP, accept any file size. If DOMParser parsing takes >2s, the loading state covers it. Monitor in real usage and add a size warning in a future phase if needed.

2. **Non-UTF8 file encoding**
   - What we know: `std::fs::read_to_string` expects valid UTF-8. Phase 4 adds encoding detection.
   - What's unclear: What happens if a file has non-UTF8 encoding in Phase 3?
   - Recommendation: `read_to_string` will return an error for non-UTF8. Show error toast. Phase 4 will handle encoding properly.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest 2.1.2 |
| Config file | `vitest.config.ts` |
| Quick run command | `npm run test -- --run` |
| Full suite command | `npm run test` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BRWS-04 | XML tree view parses elements, attributes, namespaces, comments, PIs | unit | `npx vitest run src/features/explorer/utils/xml-parser.test.ts` | Wave 0 |
| BRWS-05 | View mode toggle between source and tree | unit | `npx vitest run src/features/explorer/store.test.ts` | Wave 0 |
| BRWS-06 | Tab management: open, close, switch, no duplicates | unit | `npx vitest run src/features/explorer/store.test.ts` | Wave 0 |
| BRWS-07 | File actions: copy path/content, open external, save copy | manual-only | N/A (requires Tauri runtime) | N/A |

### Sampling Rate
- **Per task commit:** `npm run test -- --run`
- **Per wave merge:** `npm run test && npm run lint && npm run build`
- **Phase gate:** Full suite green before verify-work

### Wave 0 Gaps
- [ ] `src/features/explorer/utils/xml-parser.test.ts` -- covers BRWS-04 (XML parsing, error detection, node type handling)
- [ ] `src/features/explorer/utils/file-size-format.test.ts` -- covers file size formatting
- [ ] `src/features/explorer/utils/tab-disambiguator.test.ts` -- covers BRWS-06 (duplicate tab name handling)
- [ ] `src/features/explorer/store.test.ts` -- extend existing store test file with tab management (open, close, switch, view mode, no duplicates)

*(Note: Explorer store integration test already exists at `src/features/explorer/store-integration.test.ts`. Tab-related tests should extend this or create a focused store test.)*

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A -- local desktop app |
| V3 Session Management | no | N/A -- no sessions |
| V4 Access Control | no | N/A -- inherits OS file permissions |
| V5 Input Validation | yes | DOMParser for XML (built-in browser validation); Rust `read_to_string` rejects non-UTF8 |
| V6 Cryptography | no | N/A -- no crypto operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via file path | Tampering | Tauri FS plugin scope restricts accessible paths; `read_file_cmd` receives path from frontend but reads through OS filesystem permissions |
| Large file DoS (memory exhaustion) | Denial of Service | Timeout on Rust command (30s); files read into memory but this is a local desktop app, user controls input |
| Malicious XML content (XXE) | Information Disclosure | DOMParser in browser context does not resolve external entities by default; no XXE risk |

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `src/lib/monaco-sql-loader.ts`, `src/features/schema-graph/components/sql-code-block.tsx`, `src/features/canvas/services/canvas-file-service.ts`, `src-tauri/src/commands/explorer.rs`, `src/features/explorer/store.ts` -- verified patterns, versions, APIs
- `node_modules/monaco-editor/esm/vs/basic-languages/xml/xml.contribution.js` -- verified XML language contribution exists
- `node_modules/@tauri-apps/plugin-opener/dist-js/index.d.ts` -- verified `openPath` API signature
- `node_modules/@tauri-apps/plugin-fs/dist-js/index.d.ts` -- verified `readTextFile`, `writeFile`, `stat` APIs

### Secondary (MEDIUM confidence)
- [Tauri v2 Clipboard Plugin docs](https://v2.tauri.app/plugin/clipboard/) -- clipboard-manager API and permissions
- [Tauri v2 Opener Plugin docs](https://v2.tauri.app/plugin/opener/) -- opener permissions and scope
- [MDN DOMParser](https://developer.mozilla.org/en-US/docs/Web/API/DOMParser) -- parseFromString behavior, error detection

### Tertiary (LOW confidence)
- [GitHub Issue #12007](https://github.com/tauri-apps/tauri/issues/12007) -- navigator.clipboard security prompt issue (used to justify clipboard-manager plugin over browser API)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all core libraries already installed and verified in codebase; only new dependency is official Tauri plugin
- Architecture: HIGH -- all patterns follow established codebase conventions; no novel architecture needed
- Pitfalls: HIGH -- pitfalls derived from verified DOMParser behavior, established Monaco patterns, and known network I/O challenges from prior phases

**Research date:** 2026-05-26
**Valid until:** 2026-06-25 (stable -- no fast-moving dependencies)
