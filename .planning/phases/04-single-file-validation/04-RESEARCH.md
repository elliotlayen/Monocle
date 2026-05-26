# Phase 4: Single-File Validation - Research

**Researched:** 2026-05-26
**Domain:** Rust byte-level file analysis, encoding detection, Monaco Editor decorations, VS Code-style problems panel
**Confidence:** HIGH

## Summary

Phase 4 adds automatic character-level and encoding validation to the existing file viewing experience. The implementation spans two tiers: a Rust backend that reads files as raw bytes, detects encoding, transcodes to UTF-8, and scans for problematic characters; and a React frontend that surfaces results through three UI touchpoints (tree badges, problems panel, inline Monaco decorations).

The technical domain is well-understood and the required libraries are mature. The Rust side uses `encoding_rs` (v0.8.35) for encoding/decoding and `chardetng` (v1.0.0) for encoding detection -- both written by the same author (Henri Sivonen, Mozilla) and used in Firefox. The frontend side leverages Monaco Editor's built-in decoration APIs (`createDecorationsCollection`, glyph margin, overview ruler) which are already available in the project's installed version (0.55.1). No new frontend dependencies are needed.

The main complexity lies in: (1) correctly identifying character positions (line/column) during byte-level scanning after transcoding to UTF-8, (2) managing the resizable split panel layout for the problems panel, and (3) wiring the click-to-jump interaction that crosses component boundaries (problems panel -> store -> Monaco editor).

**Primary recommendation:** Extend the existing `read_file_cmd` to read raw bytes, detect encoding via `chardetng` + `encoding_rs`, transcode to UTF-8, scan for invalid characters, and return validation results alongside content. On the frontend, add validation state to the Zustand store, build three new components (ProblemsPanel, ProblemRow, ValidationStatusBar), modify XmlSourceView for decorations, and add dot badges to FolderTreeNode.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Problems panel is a VS Code-style bottom split panel within the content area, below the source/tree view with a drag handle for resizing. Collapsible.
- **D-02:** Panel auto-shows when validation finds issues on file open. Clean files keep panel hidden. User can collapse; stays collapsed until a new file with issues is opened.
- **D-03:** Panel shows problems for the active tab only. Switching tabs updates the panel.
- **D-04:** Thin status bar at bottom always shows error/warning counts and detected encoding. Clickable to toggle problems panel.
- **D-05:** All validation runs in Rust, alongside file reading. `read_file_cmd` extended to return validation results.
- **D-06:** Character-level checks only: illegal XML characters, null bytes, invalid XML control characters, non-UTF8 bytes.
- **D-07:** No XML structural validation. Existing DOMParser-based tree view already surfaces parse errors.
- **D-08:** Rust reads raw bytes, detects encoding using encoding_rs, transcodes to UTF-8 with lossy replacement. Files always viewable.
- **D-09:** Encoding always shown in status bar. Non-UTF8 flagged as warning.
- **D-10:** BOM detected and flagged as warning. BOM bytes not shown in content.
- **D-11:** Two severity levels: Error (red) and Warning (yellow).
- **D-12:** Errors: unescaped entities in content, null bytes, invalid XML control characters, non-UTF8 bytes that could not transcode.
- **D-13:** Warnings: BOM detected, non-UTF8 encoding, bare CR without LF.
- **D-14:** Files with errors show red dot badge; warnings only show yellow dot. No count.
- **D-15:** Badges persist for session after validation. Cleared on restart.
- **D-16:** Re-opening a validated file reuses cached results (no re-scan).
- **D-17:** No indicator for clean files.
- **D-18:** File nodes only -- no aggregate badges on parent folders.
- **D-19:** Lines with issues get gutter icon (red/yellow circle).
- **D-20:** Bad characters get inline background highlight.
- **D-21:** Clicking a problem auto-switches to source view and jumps to line/column.

### Claude's Discretion
No items explicitly marked for Claude's discretion. The CONTEXT.md is comprehensive with locked decisions covering all aspects.

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VALD-01 | App detects XML-invalid characters (unescaped entities, control characters, null bytes) and encoding issues (non-UTF8, BOM problems) in opened files | Rust validation engine using `encoding_rs` + `chardetng` for encoding detection, byte-level scanning for XML-invalid characters per XML 1.0 spec |
| VALD-02 | Files with detected issues show a red badge/icon in the folder tree | Validation cache in Zustand store keyed by file path; `FolderTreeNode` reads cache to render dot badges |
| VALD-03 | A problems panel lists all detected issues with line number, column, description, and severity, with click-to-jump to the location in source view | New ProblemsPanel + ProblemRow components; Monaco `setPosition` + `revealLineInCenter` for jump; store action to switch view mode |
| VALD-04 | Source view highlights bad characters inline with gutter markers on affected lines | Monaco `createDecorationsCollection` API with `glyphMarginClassName`, `className`, `overviewRuler`, and `hoverMessage` options |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Encoding detection & transcoding | Rust Backend | -- | Raw byte access required; `encoding_rs`/`chardetng` are Rust crates with no JS equivalent at this quality level |
| Character-level validation | Rust Backend | -- | Scanning raw bytes before transcoding catches issues that post-transcode JS cannot detect (e.g., original encoding, which bytes were replaced) |
| Validation result transport | Rust Backend (serialization) | Frontend (deserialization) | Extended `read_file_cmd` response carries problems array, encoding, BOM flag via Tauri IPC |
| Validation cache | Frontend (Zustand) | -- | Session-scoped in-memory cache; no persistence needed across restarts |
| Problems panel UI | Frontend (React) | -- | New presentational components consuming store state |
| Monaco decorations | Frontend (React) | -- | Editor instance API for glyph margin, inline highlights, overview ruler |
| Tree badges | Frontend (React) | -- | Read validation cache from store in existing `FolderTreeNode` |
| Click-to-jump navigation | Frontend (React) | -- | Store action + Monaco editor ref coordination |

## Standard Stack

### Core (Rust -- new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `encoding_rs` | 0.8.35 | Encoding/decoding per WHATWG Encoding Standard | Used in Firefox (Gecko); the canonical Rust implementation of the Encoding Standard. Handles transcoding to UTF-8 with U+FFFD replacement for malformed sequences. [ASSUMED -- known from training data as the standard Rust encoding crate; registry-verified via `cargo search`] |
| `chardetng` | 1.0.0 | Character encoding detection | Companion to encoding_rs by the same author (Henri Sivonen). Used in Firefox for encoding detection. Returns `&'static Encoding` compatible with encoding_rs. [ASSUMED -- same provenance reasoning; registry-verified] |

### Core (Frontend -- already installed, no new deps)

| Library | Version | Purpose | Already In Project |
|---------|---------|---------|-------------------|
| `monaco-editor` | 0.55.1 | Code editor with decoration APIs | Yes -- `package.json` |
| `@monaco-editor/react` | 4.7.0 | React wrapper for Monaco | Yes -- `package.json` |
| `zustand` | 5.0.9 | State management with validation cache | Yes -- `package.json` |
| `lucide-react` | 0.555.0 | Icons for severity indicators | Yes -- `package.json` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `chardetng` | `charset-detect` or `chardet` crate | chardetng is purpose-built for encoding_rs compatibility, used in Firefox, 1.0 stable. Others are ports with less integration. |
| `encoding_rs` | `encoding` (0.2.x) crate | `encoding` is older, not maintained, does not implement WHATWG standard. encoding_rs is the modern replacement. |
| Mouse-drag resize panel | `react-resizable-panels` library | Hand-rolling a simple vertical drag is straightforward (one state + mousemove listener). No library needed for a single resize handle. |

**Installation (Rust):**
```bash
# Add to src-tauri/Cargo.toml [dependencies]
encoding_rs = "0.8"
chardetng = "1.0"
```

**Installation (Frontend):**
No new packages required. All dependencies are already installed.

## Package Legitimacy Audit

> slopcheck was unavailable at research time. All recommended packages are tagged `[ASSUMED]` and the planner must gate each install behind a `checkpoint:human-verify` task.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| encoding_rs | crates.io | ~8 yrs (first published ~2016) | Very high (used in Firefox) | github.com/hsivonen/encoding_rs | N/A | Approved [ASSUMED] |
| chardetng | crates.io | ~4 yrs (1.0.0 stable) | High (used in Firefox) | github.com/niclas-patel/chardetng or hsivonen | N/A | Approved [ASSUMED] |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*slopcheck was unavailable at research time. The two Rust crates above are well-known (Firefox lineage) but formally tagged `[ASSUMED]` per protocol. Planner must gate install behind checkpoint.*

## Architecture Patterns

### System Architecture Diagram

```
File Click (sidebar)
      |
      v
[Explorer Store: openFile()]
      |
      v
[explorerService.readFile(path)]
      |
      v (Tauri IPC)
[read_file_cmd (Rust)]
      |
      +-- std::fs::read(path) --> raw bytes
      |
      +-- chardetng::EncodingDetector --> detected encoding
      |
      +-- encoding_rs::Encoding::decode() --> UTF-8 string + had_errors flag
      |       (BOM removal, U+FFFD replacement for malformed bytes)
      |
      +-- validate_characters(utf8_string) --> Vec<ValidationProblem>
      |       (scans for null bytes, control chars, unescaped entities, bare CR)
      |
      +-- Return FileContent { content, size, problems, encoding, hasBom }
      |
      v (Tauri IPC response)
[Explorer Store]
      |
      +-- Update FileTab with problems, encoding, hasBom
      +-- Update validationCache[filePath]
      +-- Determine problemsPanelOpen (auto-show if issues found)
      |
      v
[FileContentArea]
      |
      +-- [XmlSourceView] --> Monaco decorations (glyph, inline, overview ruler)
      +-- [ProblemsPanel] --> Clickable problem list (auto-switches view, jumps)
      +-- [ValidationStatusBar] --> Error/warning counts + encoding display
      |
      v
[FolderTreeNode] reads validationCache --> dot badge (red/yellow)
```

### Recommended Project Structure

```
src-tauri/src/
  commands/
    explorer.rs              # Extended read_file_cmd + new validation module
  validation/
    mod.rs                   # pub mod validator; pub mod encoding;
    validator.rs             # validate_characters() -- XML character scanning
    encoding.rs              # detect_and_decode() -- chardetng + encoding_rs pipeline
  types/
    explorer.rs              # New: FileContent, ValidationProblem, Severity structs

src/features/explorer/
  components/
    problems-panel.tsx       # NEW: VS Code-style collapsible bottom panel
    problem-row.tsx          # NEW: Single problem entry (severity + location + description)
    validation-status-bar.tsx # NEW: Thin bottom bar with counts + encoding
    file-content-area.tsx    # MODIFIED: Add panel + status bar + drag resize
    xml-source-view.tsx      # MODIFIED: glyphMargin, decorations, revealLine
    folder-tree-node.tsx     # MODIFIED: Add validation dot badges
  hooks/
    use-validation-decorations.ts  # NEW: Hook to compute Monaco decorations from problems
  types.ts                   # MODIFIED: Add ValidationProblem, ValidationStatus, extend FileTab
  store.ts                   # MODIFIED: Add validationCache, panel state, panel actions
  services/
    explorer-service.ts      # MODIFIED: Updated return type from readFile
```

### Pattern 1: Extended IPC Response Shape

**What:** Extend the existing `read_file_cmd` response to include validation data alongside content, rather than adding a separate validation command.
**When to use:** When validation is inherently tied to file reading (same raw bytes, same I/O operation).
**Example:**

```rust
// Rust: Extended response struct
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileContent {
    pub content: String,
    pub size: u64,
    pub problems: Vec<ValidationProblem>,
    pub encoding: String,
    pub has_bom: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationProblem {
    pub line: u32,
    pub column: u32,
    pub end_column: u32,
    pub message: String,
    pub severity: String,  // "error" or "warning"
    pub code: String,      // e.g., "null-byte", "unescaped-ampersand"
}
```

```typescript
// TypeScript: Matching frontend types
interface FileContent {
  content: string;
  size: number;
  problems: ValidationProblem[];
  encoding: string;
  hasBom: boolean;
}

interface ValidationProblem {
  line: number;
  column: number;
  endColumn: number;
  message: string;
  severity: "error" | "warning";
  code: string;
}
```

### Pattern 2: Encoding Detection Pipeline

**What:** Read raw bytes, detect encoding, decode to UTF-8, track what was replaced.
**When to use:** When files may have arbitrary encodings and you need both the decoded content and metadata about the encoding.
**Example:**

```rust
// Source: encoding_rs docs.rs + chardetng docs.rs [ASSUMED -- based on API research]
use encoding_rs::Encoding;
use chardetng::EncodingDetector;

pub struct DecodeResult {
    pub content: String,
    pub encoding_name: String,
    pub has_bom: bool,
    pub had_errors: bool,  // true if U+FFFD replacements occurred
}

pub fn detect_and_decode(raw_bytes: &[u8]) -> DecodeResult {
    // 1. Check for BOM first (UTF-8 BOM: EF BB BF)
    let has_bom = raw_bytes.starts_with(&[0xEF, 0xBB, 0xBF]);

    // 2. Try UTF-8 first (fast path -- most files)
    let (cow, encoding, had_errors) = Encoding::for_label(b"utf-8")
        .unwrap()
        .decode(raw_bytes);

    // encoding_rs::decode() does BOM sniffing -- if BOM present, it
    // returns the BOM-detected encoding and removes the BOM bytes.
    // The returned `encoding` tells us what was actually used.

    if encoding == encoding_rs::UTF_8 && !had_errors && !has_bom {
        // Pure UTF-8, no issues -- fast path
        return DecodeResult {
            content: cow.into_owned(),
            encoding_name: "UTF-8".to_string(),
            has_bom: false,
            had_errors: false,
        };
    }

    // 3. If UTF-8 had errors, try detecting the real encoding
    if had_errors {
        let mut detector = EncodingDetector::new();
        detector.feed(raw_bytes, true);
        let detected = detector.guess(None, true);
        // detected is not UTF-8 -- try transcoding with detected encoding
        let (decoded, _, had_errors_2) = detected.decode(raw_bytes);
        return DecodeResult {
            content: decoded.into_owned(),
            encoding_name: detected.name().to_string(),
            has_bom,
            had_errors: had_errors_2,
        };
    }

    DecodeResult {
        content: cow.into_owned(),
        encoding_name: encoding.name().to_string(),
        has_bom,
        had_errors,
    }
}
```

### Pattern 3: Monaco Decoration Collection

**What:** Use `createDecorationsCollection` (the modern API replacing deprecated `deltaDecorations`) to apply glyph margin, inline highlight, and overview ruler markers.
**When to use:** When the editor content is read-only and decorations correspond to external analysis results.
**Example:**

```typescript
// Source: Monaco Editor API [ASSUMED -- based on CHANGELOG and API research]
import type { editor } from "monaco-editor";

function applyValidationDecorations(
  editorInstance: editor.IStandaloneCodeEditor,
  problems: ValidationProblem[]
): editor.IEditorDecorationsCollection {
  const decorations: editor.IModelDeltaDecoration[] = problems.map((p) => ({
    range: new monaco.Range(p.line, p.column, p.line, p.endColumn),
    options: {
      glyphMarginClassName:
        p.severity === "error"
          ? "validation-glyph-error"
          : "validation-glyph-warning",
      className:
        p.severity === "error"
          ? "validation-inline-error"
          : "validation-inline-warning",
      overviewRuler: {
        color:
          p.severity === "error"
            ? "oklch(0.577 0.245 27.325)"
            : "oklch(0.75 0.15 85)",
        position: 4, // OverviewRulerLane.Right
      },
      hoverMessage: { value: p.message },
      minimap: { color: undefined, position: 0 },
    },
  }));

  return editorInstance.createDecorationsCollection(decorations);
}
```

### Pattern 4: Click-to-Jump Navigation

**What:** Clicking a problem row triggers a store action that (1) switches to source view if needed, and (2) commands the Monaco editor to reveal and set cursor at the problem location.
**When to use:** When a list UI needs to control the editor's viewport.
**Example:**

```typescript
// Source: Monaco Editor API [ASSUMED]
// In the store: action to request a jump
jumpToProblem: (tabId: string, line: number, column: number) => {
  const { tabs } = get();
  const tab = tabs.find((t) => t.id === tabId);
  if (!tab) return;

  // Switch to source view if currently in tree view
  if (tab.viewMode === "tree") {
    const updated = tabs.map((t) =>
      t.id === tabId ? { ...t, viewMode: "source" as const } : t
    );
    set({ tabs: updated, pendingJump: { tabId, line, column } });
  } else {
    set({ pendingJump: { tabId, line, column } });
  }
},

// In XmlSourceView: respond to pendingJump
// After Monaco mounts or when pendingJump changes:
editorInstance.setPosition({ lineNumber: line, column: column });
editorInstance.revealLineInCenterIfOutsideViewport(line);
editorInstance.focus();
```

### Pattern 5: Validation Cache in Zustand Store

**What:** A `Map<string, CachedValidation>` in the explorer store keyed by file path, persisting for the app session.
**When to use:** When validation results should survive tab close/reopen within the same session (D-15, D-16).
**Example:**

```typescript
// Store extension
interface ExplorerStore {
  // ... existing fields ...
  validationCache: Map<string, {
    problems: ValidationProblem[];
    encoding: string;
    hasBom: boolean;
  }>;
  problemsPanelOpen: boolean;
  problemsPanelHeight: number;
  pendingJump: { tabId: string; line: number; column: number } | null;

  toggleProblemsPanel: () => void;
  setProblemsPanelHeight: (height: number) => void;
  jumpToProblem: (tabId: string, line: number, column: number) => void;
  getValidationStatus: (filePath: string) => "error" | "warning" | "clean" | undefined;
}
```

### Anti-Patterns to Avoid

- **Running validation in JavaScript:** The CONTEXT.md explicitly locks validation to Rust (D-05). JavaScript cannot access raw bytes before encoding, cannot use encoding_rs, and would duplicate I/O.
- **Separate validation command:** Adding a new Tauri command for validation would mean two IPC round trips per file open and two reads of the same file. The decision is to extend `read_file_cmd`.
- **Using deltaDecorations:** Deprecated since Monaco 0.34.0. Use `createDecorationsCollection` instead for cleaner lifecycle management.
- **Storing validation in FileTab only:** Tab close loses results. The validation cache in the store (keyed by path) survives tab close for badge persistence (D-15).
- **Modifying tree view rendering for jump:** Click-to-jump should auto-switch to source view (D-21), not try to scroll the XML tree view.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Encoding detection | Custom byte-pattern matching | `chardetng` crate | Encoding detection is notoriously hard; chardetng handles dozens of encodings, is battle-tested in Firefox |
| Encoding transcoding | Manual codec tables | `encoding_rs` crate | Implements the full WHATWG Encoding Standard with proper U+FFFD replacement |
| Editor decorations | Custom overlay DOM elements | Monaco `createDecorationsCollection` | Built-in API handles scrolling, folding, viewport optimization, and cleanup |
| Overview ruler markers | Custom scrollbar rendering | Monaco `overviewRuler` option | Built-in feature that coordinates with editor scrolling |
| BOM detection | Manual byte checks only | `encoding_rs::Encoding::decode()` | BOM sniffing is built into encode_rs's `decode()` method -- it returns the actual encoding used after BOM detection |

**Key insight:** The file validation domain has two deceptively complex sub-problems (encoding detection and editor decoration management) where mature, battle-tested libraries exist. The character scanning itself is the only part that should be custom code, and it's straightforward once you have clean UTF-8 content.

## Common Pitfalls

### Pitfall 1: Line/Column Calculation After Transcoding

**What goes wrong:** Byte offsets in the original file do not match character positions in the transcoded UTF-8 string. A character at byte offset 100 in Windows-1252 may be at a different position in UTF-8 after multi-byte characters expand.
**Why it happens:** encoding_rs transcodes the entire buffer at once, returning a `Cow<str>`. The original byte positions are lost.
**How to avoid:** Run character validation AFTER transcoding on the UTF-8 string, using string iteration to track line/column. The validator operates on `&str`, not `&[u8]`. For the "non-UTF8 bytes replaced" case, scan for U+FFFD in the transcoded output rather than trying to map back to original byte positions.
**Warning signs:** Column numbers that don't match what Monaco shows; off-by-one in multi-byte character positions.

### Pitfall 2: Unescaped Entity Detection False Positives

**What goes wrong:** Scanning for bare `&` or `<` characters produces false positives inside CDATA sections, processing instructions, comments, or already-escaped entity references like `&amp;`.
**Why it happens:** Character-level scanning without any XML context awareness.
**How to avoid:** Per D-06 and D-07, Phase 4 does character-level checks only (no structural parsing). The validator should flag ALL bare `&` and `<` characters -- this is intentionally conservative. Files that use CDATA sections will get false positives, which is acceptable for a byte-level validator. The existing tree view (DOMParser) already handles structural validation. Document this trade-off clearly.
**Warning signs:** Users seeing warnings for valid CDATA content. This is expected behavior per the phase scope.

### Pitfall 3: Monaco Decoration Lifecycle Management

**What goes wrong:** Decorations from a previous file persist when switching tabs, or decorations accumulate on each re-render.
**Why it happens:** `createDecorationsCollection` returns a collection object that must be explicitly updated or cleared when the model changes.
**How to avoid:** Store the `IEditorDecorationsCollection` reference and call `.set([])` to clear or `.set(newDecorations)` to update when the active tab changes. Use a React effect that depends on the active tab's problems array.
**Warning signs:** Decorations appearing on wrong files; decoration count growing over time.

### Pitfall 4: Drag Resize Interaction Conflicts

**What goes wrong:** The drag handle for the problems panel interferes with text selection in Monaco or the problems list scroll.
**Why it happens:** Mouse events bubble up and competing drag handlers capture the wrong events.
**How to avoid:** Use a dedicated 4px drag handle element with `cursor-row-resize`. Attach mousedown only on the handle, not on the panel body. Use `e.preventDefault()` during drag to prevent text selection. Release on mouseup anywhere (attach to window).
**Warning signs:** Cannot select text while near the panel border; panel resizes when trying to scroll.

### Pitfall 5: encoding_rs BOM Handling Subtlety

**What goes wrong:** BOM is sometimes removed and sometimes not, depending on which decode method is called.
**Why it happens:** `encoding_rs::Encoding::decode()` performs BOM sniffing and removes BOM. But `decode_without_bom_handling()` does not. Using the wrong method leads to BOM bytes appearing in content or BOM not being detected.
**How to avoid:** Use `Encoding::decode()` (the standard decode method) which handles BOM automatically. Check the returned encoding to see if BOM changed it. Separately check `raw_bytes.starts_with(&[0xEF, 0xBB, 0xBF])` (UTF-8 BOM) or `raw_bytes.starts_with(&[0xFF, 0xFE])` / `raw_bytes.starts_with(&[0xFE, 0xFF])` (UTF-16 BOMs) before decoding to set the `hasBom` flag.
**Warning signs:** BOM characters appearing at the start of file content in Monaco; BOM warning not appearing for files that have one.

### Pitfall 6: Bare CR Detection in Content

**What goes wrong:** Forgetting that `\r` alone (without `\n`) is valid per D-13 as a warning, but `\r\n` is the normal Windows line ending and should NOT be flagged.
**Why it happens:** Naive scan for `\r` catches both cases.
**How to avoid:** Check each `\r` and verify the next character is NOT `\n`. Only flag `\r` not followed by `\n`.
**Warning signs:** Every Windows-format file getting hundreds of bare CR warnings.

## Code Examples

Verified patterns from the existing codebase and official sources:

### Existing read_file_cmd (to be extended)

```rust
// Source: src-tauri/src/commands/explorer.rs (current implementation)
#[tauri::command]
pub async fn read_file_cmd(path: String) -> Result<FileContent, String> {
    tokio::time::timeout(
        Duration::from_secs(30),
        tokio::task::spawn_blocking(move || {
            let metadata = std::fs::metadata(&path)
                .map_err(|e| format!("Failed to read file '{}': {}", path, e))?;
            let size = metadata.len();
            // CURRENT: reads as UTF-8 string directly
            let content = std::fs::read_to_string(&path)
                .map_err(|e| format!("Failed to read file '{}': {}", path, e))?;
            Ok(FileContent { content, size })
        }),
    )
    .await
    .map_err(|_| "File read timed out after 30 seconds".to_string())?
    .map_err(|e| format!("File read task failed: {}", e))?
}
// PHASE 4 CHANGE: Replace std::fs::read_to_string with std::fs::read (raw bytes),
// then pipe through detect_and_decode() and validate_characters().
```

### Existing Zustand Store openFile Action (to be extended)

```typescript
// Source: src/features/explorer/store.ts (current implementation)
openFile: async (filePath: string) => {
    // ... creates tab with loading state ...
    try {
      const result = await explorerService.readFile(filePath);
      // PHASE 4 CHANGE: result now includes problems, encoding, hasBom
      // Update tab with validation data
      // Update validationCache
      // Auto-show problems panel if issues found
    } catch {
      // ... error handling ...
    }
},
```

### Existing FolderTreeNode renderBadge (to be extended)

```typescript
// Source: src/features/explorer/components/folder-tree-node.tsx
// Currently renders child count badges for client/date nodes.
// PHASE 4 CHANGE: Add validation dot badges for file nodes.
// Read from store's validationCache to determine badge color.
```

### Monaco Editor onMount Handler (to be extended)

```typescript
// Source: src/features/explorer/components/xml-source-view.tsx
const handleEditorMount: OnMount = (editorInstance) => {
    editorRef.current = editorInstance;
    // ... existing view state restoration ...
    // PHASE 4 CHANGE: Apply validation decorations here
    // Also set up effect to update decorations when problems change
};
```

### XML 1.0 Invalid Character Ranges Reference

```rust
// Source: W3C XML 1.0 Specification (Fifth Edition)
// [CITED: https://www.w3.org/TR/xml/#charsets]
//
// Valid XML 1.0 characters:
//   #x9 | #xA | #xD | [#x20-#xD7FF] | [#xE000-#xFFFD] | [#x10000-#x10FFFF]
//
// Therefore INVALID characters are:
//   #x0 (null byte) -- always invalid
//   #x1-#x8 -- control characters
//   #xB (#x0B) -- vertical tab
//   #xC (#x0C) -- form feed
//   #xE-#x1F -- control characters
//   #xFFFE, #xFFFF -- non-characters
//
// Phase 4 checks per D-06 and D-12:
//   ERROR: null bytes (0x00)
//   ERROR: invalid XML control characters (0x01-0x08, 0x0B, 0x0C, 0x0E-0x1F)
//   ERROR: unescaped & < > in content
//   ERROR: non-UTF8 bytes (U+FFFD replacements from encoding_rs)
//   WARNING: BOM detected
//   WARNING: non-UTF8 encoding
//   WARNING: bare CR without LF

fn is_invalid_xml_char(c: char) -> bool {
    matches!(c,
        '\u{0000}' |                    // null byte
        '\u{0001}'..='\u{0008}' |       // control chars
        '\u{000B}' |                     // vertical tab
        '\u{000C}' |                     // form feed
        '\u{000E}'..='\u{001F}'          // control chars
    )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `deltaDecorations()` | `createDecorationsCollection()` | Monaco 0.34.0 (2023) | Soft deprecated; collection API has cleaner lifecycle. Project uses 0.55.1 so new API is available. [CITED: Monaco CHANGELOG] |
| `encoding` crate (0.2.x) | `encoding_rs` (0.8.x) | ~2016 | encoding_rs implements WHATWG standard, is actively maintained, used in Firefox. Old `encoding` crate is unmaintained. [ASSUMED] |
| Manual chardet ports | `chardetng` (1.0.0) | ~2020 | chardetng replaced the old Mozilla chardet algorithm in Firefox. Stable 1.0 release indicates maturity. [ASSUMED] |

**Deprecated/outdated:**
- `deltaDecorations()` on Monaco Editor: still works but `createDecorationsCollection()` is preferred. No breaking change, but new code should use the collection API.
- `std::fs::read_to_string()` in current `read_file_cmd`: must be replaced with `std::fs::read()` (raw bytes) to enable encoding detection.

## Assumptions Log

> List all claims tagged `[ASSUMED]` in this research. The planner and discuss-phase use this section to identify decisions that need user confirmation before execution.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `encoding_rs` 0.8.35 is the standard Rust encoding crate, used in Firefox | Standard Stack | Low -- extremely well-known crate; risk is version mismatch only |
| A2 | `chardetng` 1.0.0 is the companion encoding detector, used in Firefox | Standard Stack | Low -- same author as encoding_rs, stable 1.0 release |
| A3 | `createDecorationsCollection` is the recommended Monaco API replacing `deltaDecorations` | Architecture Patterns | Low -- confirmed in CHANGELOG, soft deprecation only; either API works |
| A4 | Monaco `setPosition` + `revealLineInCenterIfOutsideViewport` is the standard jump-to-location pattern | Code Examples | Low -- standard Monaco API, widely documented |
| A5 | `Encoding::decode()` automatically handles BOM sniffing and U+FFFD replacement | Architecture Patterns | Medium -- if BOM handling differs, content may include BOM bytes or replacement behavior changes |

## Open Questions

1. **Unescaped entity detection scope**
   - What we know: D-06 says "unescaped `&`, `<`, `>` in content". D-07 says no structural validation.
   - What's unclear: Should we skip scanning for `>` since it is technically valid in XML content (only `&` and `<` are always illegal in text content per XML spec)? The CONTEXT.md lists `>` explicitly.
   - Recommendation: Include `>` per the CONTEXT.md decision. It is technically allowed but strongly discouraged in practice and flagging it is consistent with the "conservative character-level check" philosophy.

2. **chardetng Utf8Detection parameter**
   - What we know: `detector.guess(None, allow_utf8)` takes a `Utf8Detection` bool parameter.
   - What's unclear: Should `allow_utf8` be `true` or `false` when we already know UTF-8 decoding failed?
   - Recommendation: Pass `false` (don't allow UTF-8) since we only reach the chardetng path when UTF-8 decoding produced errors, meaning the file is NOT valid UTF-8.

3. **Panel height persistence across sessions**
   - What we know: D-01 says resizable. No decision on whether height persists.
   - What's unclear: Should the problems panel height survive app restart (via settings) or reset to 200px?
   - Recommendation: Default to 200px on every session start. Store height in Zustand (session only). This keeps it simple and avoids settings bloat.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.2 |
| Config file | `vitest.config.ts` (root, environment: node) |
| Quick run command | `npm run test -- --run` |
| Full suite command | `npm run test` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VALD-01 | Validation engine detects invalid chars and encoding issues | unit | `npx vitest run src/features/explorer/utils/validation.test.ts -t "validation"` | Wave 0 |
| VALD-01 | Rust backend returns problems in FileContent | integration (Rust) | `cd src-tauri && cargo test -- validation` | Wave 0 |
| VALD-02 | Tree badges render based on validation cache | unit | `npx vitest run src/features/explorer/components/folder-tree-node.test.ts` | Wave 0 |
| VALD-03 | Problems panel renders problem list with click-to-jump | unit | `npx vitest run src/features/explorer/components/problems-panel.test.ts` | Wave 0 |
| VALD-03 | Store jumpToProblem action sets pendingJump and switches view | unit | `npx vitest run src/features/explorer/store.test.ts -t "jumpToProblem"` | Wave 0 (extend existing) |
| VALD-04 | Decoration hook produces correct Monaco decorations from problems | unit | `npx vitest run src/features/explorer/hooks/use-validation-decorations.test.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `npm run test -- --run`
- **Per wave merge:** `npm run test && npm run build && cd src-tauri && cargo check`
- **Phase gate:** Full suite green + `cargo check` before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/features/explorer/utils/validation.test.ts` -- covers character scanning logic (frontend-side test for the validation problem types/helpers)
- [ ] `src-tauri/src/validation/` -- Rust unit tests inline for `validate_characters()` and `detect_and_decode()`
- [ ] Extend `src/features/explorer/store.test.ts` -- covers validation cache operations and jumpToProblem action

## Security Domain

> This phase reads local files (already established in Phase 3). No new attack surface beyond what exists.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A -- desktop app, no auth in this phase |
| V3 Session Management | no | N/A |
| V4 Access Control | no | File access uses OS permissions (existing pattern) |
| V5 Input Validation | yes | Rust validation engine sanitizes file content before display; encoding_rs handles malformed bytes with U+FFFD replacement (not arbitrary execution) |
| V6 Cryptography | no | N/A |

### Known Threat Patterns for Rust + Tauri File Reading

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal in file read | Tampering | Already mitigated: `read_file_cmd` takes user-provided path; Tauri's `fs` plugin scope is not used here (direct invoke). Path is validated by OS-level file access. No additional risk vs Phase 3. |
| Malicious file content causing UI issues | Tampering | encoding_rs replaces malformed bytes with U+FFFD; Monaco Editor handles arbitrary string content safely |
| Large file denial of service | Denial of Service | Existing 30-second timeout on `read_file_cmd`; file size returned in response for UI display |

## Project Constraints (from CLAUDE.md)

- **No emojis** in code, comments, commits, or documentation
- **Components**: Presentational only (props in, UI out, no direct Tauri IPC)
- **Hooks**: Own state, side effects, event wiring
- **Services**: All Tauri IPC through `src/features/*/services/`
- **Store**: Zustand with `useShallow` selectors
- **UI Components**: Use shadcn/ui from `src/components/ui/`
- **Validation at end of task**: `npm run lint`, `npm run test`, `npm run build`, `cargo check`
- **Type consistency**: TypeScript types must sync with Rust types using `#[serde(rename_all = "camelCase")]`
- **Commit messages**: No "Generated with Claude Code" or "Co-Authored-By" lines

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Rust toolchain | Rust backend validation | Yes | rustc 1.91.1 | -- |
| Node.js | Frontend build | Yes | v24.11.0 | -- |
| cargo (Rust package manager) | Adding encoding_rs, chardetng | Yes | (bundled with rustc) | -- |
| npm | Frontend dependency management | Yes | (bundled with node) | -- |

**Missing dependencies with no fallback:** None
**Missing dependencies with fallback:** None

## Sources

### Primary (HIGH confidence)
- `src-tauri/src/commands/explorer.rs` -- Current `read_file_cmd` implementation
- `src/features/explorer/store.ts` -- Current explorer store with `openFile` action
- `src/features/explorer/components/xml-source-view.tsx` -- Current Monaco configuration
- `src/features/explorer/components/folder-tree-node.tsx` -- Current tree node with badge rendering
- `src/features/explorer/types.ts` -- Current TypeScript types
- `src/services/tauri.ts` -- Current IPC gateway
- `04-CONTEXT.md` -- All 21 locked decisions
- `04-UI-SPEC.md` -- Complete UI design contract

### Secondary (MEDIUM confidence)
- [encoding_rs docs.rs](https://docs.rs/encoding_rs/latest/encoding_rs/) -- `Encoding::decode()` API, BOM handling, U+FFFD replacement
- [chardetng docs.rs](https://docs.rs/chardetng/latest/chardetng/struct.EncodingDetector.html) -- `EncodingDetector` API (feed, guess)
- [Monaco Editor CHANGELOG](https://github.com/microsoft/monaco-editor/blob/main/CHANGELOG.md) -- `createDecorationsCollection` replacing `deltaDecorations`
- [IModelDecorationOptions](https://blutorange.github.io/primefaces-monaco/typedoc/interfaces/monaco.editor.imodeldecorationoptions.html) -- Decoration options interface
- [W3C XML 1.0 Specification](https://www.w3.org/TR/xml/#charsets) -- Valid character ranges
- [Valid characters in XML - Wikipedia](https://en.wikipedia.org/wiki/Valid_characters_in_XML) -- Quick reference for character ranges

### Tertiary (LOW confidence)
- None -- all findings verified with official documentation or codebase inspection

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- encoding_rs and chardetng are well-documented Rust crates verified via cargo search; Monaco Editor APIs verified against installed version
- Architecture: HIGH -- extends established patterns in the codebase (IPC, store, components); no new architectural concepts
- Pitfalls: HIGH -- based on codebase inspection and API documentation; encoding edge cases well-documented

**Research date:** 2026-05-26
**Valid until:** 2026-06-26 (stable domain, mature libraries)
