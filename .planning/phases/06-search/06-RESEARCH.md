# Phase 6: Search - Research

**Researched:** 2026-05-28
**Domain:** Full-text content search over network filesystem + client-side filename filtering in a Tauri 2 desktop app
**Confidence:** HIGH

## Summary

Phase 6 adds a dual-mode search system to the Integration Explorer sidebar. **Filename mode** is a pure client-side filter using the existing `filterTreeNodes` function -- no new backend work. **Content mode** is a backend-driven file scanning operation that reads files from network shares, decodes them via the existing `detect_and_decode` pipeline, searches for user-specified terms, and streams per-file results to the frontend via Tauri events -- following the identical architectural pattern established by `bulk_scan_cmd` in Phase 5.

The phase has minimal technical risk because every core pattern is already implemented in the codebase: directory walking with `walkdir` + `glob::Pattern`, `CancellationToken`-based cancellation, `spawn_blocking` with `std::fs`, `app_handle.emit` event streaming, `createEventHub` frontend subscription, and Monaco Editor decorations via `createDecorationsCollection`. The new work is (1) query parsing (space-separated terms with quoted phrases), (2) case-insensitive string matching with match counting, (3) a new Rust command `content_search_cmd`, (4) six new React components for the sidebar search UI, and (5) extending the explorer Zustand store with search state.

**Primary recommendation:** Follow the `bulk_scan_cmd` pattern exactly for the backend. Use `str::to_lowercase()` + `str::matches().count()` for search matching (no new Rust dependencies needed). Use Monaco's `ITextModel.findMatches()` API for highlighting search terms when opening files from results.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Single always-visible search bar replaces existing filter input
- **D-02:** Segmented control toggle (Filename/Content) next to search bar
- **D-03:** Filename mode = instant client-side substring match (reuse `filterTreeNodes`)
- **D-04:** Content mode shows controls row (scope, file pattern, Search button)
- **D-05:** Filename matching is simple case-insensitive substring (no glob/regex)
- **D-06:** Content search is always case-insensitive, no toggle
- **D-07:** Content search: space-separated terms with AND logic, quoted strings for exact phrases
- **D-08:** Cmd+Shift+F -> Content mode, Cmd+F -> Filename mode
- **D-09:** Three scope options: Selected folder, This source, All sources
- **D-10:** Default scope: Selected folder
- **D-11:** No selection = prompt message + disabled Search button
- **D-12:** Scope dropdown shows resolved names (e.g., "Folder: 20251223")
- **D-13:** Scope auto-updates with tree selection before search; locked during/after search
- **D-14:** File pattern filter default `*.xml`, reuses Phase 5 pattern
- **D-15:** Scope and file pattern remember last-used values within session
- **D-16:** Content results replace folder tree; clearing restores tree
- **D-17:** Results grouped by parent folder, collapsible, with summary header
- **D-18:** Only matching files in results; total scanned in summary
- **D-19:** Progressive streaming with progress indicator + cancel button (same as Phase 5)
- **D-20:** Files sorted alphabetically within folder groups
- **D-21:** No result count limit, sidebar scrolls
- **D-22:** Clicking result opens file in tab, scrolled to first match, all occurrences highlighted via Monaco find-match decorations
- **D-23:** Multi-term search: match count = sum of all term matches
- **D-24:** Switching Content->Filename clears results, restores tree, preserves input text
- **D-25:** Search state persists across app mode switches (session only)
- **D-26:** Unreadable files shown in separate "Errors" group at bottom
- **D-27:** Network unreachable = abort with toast, preserve partial results
- **D-28:** Reuse `detect_and_decode` encoding pipeline for content search
- **D-29:** Backend returns file path + match count only; Monaco finds positions on open
- **D-30:** No file size limit; cancel handles slow searches
- **D-31:** `spawn_blocking` + `std::fs` + `CancellationToken`, consistent with `bulk_scan_cmd`

### Claude's Discretion
- **D-CD-01:** Match count for multi-term AND: sum of all term matches (chosen for relevance signal)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SRCH-01 | User can filter files by filename pattern within the current view | Filename mode (D-03, D-05): reuse existing `filterTreeNodes` function with case-insensitive substring match. Already implemented in `tree-filter.ts`. |
| SRCH-02 | User can search for specific values inside XML file content across multiple files | Content mode (D-07, D-28, D-29): new `content_search_cmd` Rust command using `detect_and_decode` + case-insensitive substring matching. Progressive results via event streaming. |
| SRCH-03 | User can choose search scope: current folder, current client, or all sources | Scope selection (D-09 through D-13): dropdown with three options resolving to filesystem paths. "Selected folder" = tree selection path, "This source" = source root path, "All sources" = iterate all source roots. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Filename filtering | Frontend (client-side) | -- | Already-loaded tree nodes filtered in memory; no I/O needed |
| Content search execution | Backend (Rust) | -- | File I/O over network shares must be in Rust `spawn_blocking`; never in frontend |
| Query parsing (terms + quotes) | Backend (Rust) | -- | Parse once on backend, avoid sending parsed structure over IPC |
| Search progress streaming | Backend (Rust) -> Frontend (events) | -- | `app_handle.emit` from Rust, `createEventHub` subscription on frontend |
| Cancellation | Backend (Rust) | Frontend (trigger) | `CancellationToken` in Rust, cancel command invoked from frontend |
| Results display | Frontend (React) | -- | Pure UI rendering of search results in sidebar |
| Scope resolution | Frontend (React) | -- | Frontend resolves tree selection to filesystem path before passing to backend |
| Monaco search highlighting | Frontend (Monaco) | -- | `findMatches()` on the editor model; decorations applied client-side |

## Standard Stack

### Core

No new dependencies needed. This phase reuses the existing stack entirely.

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `walkdir` | 2.5 | Recursive directory walking | Already used by `bulk_scan_cmd` [VERIFIED: Cargo.toml] |
| `glob` | 0.3 | File pattern matching | Already used by `bulk_scan_cmd` [VERIFIED: Cargo.toml] |
| `encoding_rs` | 0.8 | Encoding detection + transcoding | Already used by `detect_and_decode` [VERIFIED: Cargo.toml] |
| `chardetng` | 1.0 | Encoding detection fallback | Already used by `detect_and_decode` [VERIFIED: Cargo.toml] |
| `tokio-util` | 0.7 | `CancellationToken` | Already used by `cancel_scan_cmd` [VERIFIED: Cargo.toml] |
| `zustand` | 5.0.9 | Frontend state management | Already used by explorer store [VERIFIED: package.json] |
| `@monaco-editor/react` | 4.7.0 | Monaco editor integration | Already used by `XmlSourceView` [VERIFIED: package.json] |
| `@tauri-apps/api` | 2.9.1 | IPC and event system | Already used by services layer [VERIFIED: package.json] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `serde` / `serde_json` | 1.x | Serialization for IPC payloads | Rust command return types and event payloads [VERIFIED: Cargo.toml] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `str::to_lowercase()` + `str::matches()` | `aho-corasick` crate (already transitive dep) | Aho-Corasick is faster for many patterns but adds direct dependency; simple string ops sufficient for 1-5 search terms per file |
| Custom query parser | `regex` crate for term matching | Regex is overkill; D-05/D-06 explicitly exclude regex. Simple split + quote handling is <20 lines |
| Store search results in Zustand | IndexedDB or localStorage | Results are transient (session only per D-25), Zustand in-memory is correct |

**Installation:**
```bash
# No new packages to install -- all dependencies already present
```

## Package Legitimacy Audit

No new packages to install. All libraries referenced are already in the project's `Cargo.toml` and `package.json`.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| (none) | -- | -- | -- | -- | -- | No new packages |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
User types query in SearchBar
        |
        v
  [Filename mode?] ---yes---> filterTreeNodes() (client-side)
        |                            |
        no                           v
        |                     Filtered tree in sidebar
        v
  [Content mode: Search Files clicked]
        |
        v
  Frontend: explorerService.contentSearch(query, folderPath, filePattern, operationId)
        |
        v
  IPC: invoke("content_search_cmd", { query, folderPath, filePattern, operationId })
        |
        v
  Rust backend (spawn_blocking):
    1. Parse query into terms (split spaces, handle quotes)
    2. walkdir + glob::Pattern to collect matching files
    3. For each file:
       a. Check CancellationToken
       b. std::fs::read -> raw bytes
       c. detect_and_decode -> UTF-8 string
       d. Lowercase file content once
       e. Check ALL terms present (AND logic)
       f. Count matches per term, sum total
       g. Emit "search-result" event if match found
       h. Emit "search-progress" event (throttled)
    4. Return SearchSummary
        |
        +---> app_handle.emit("search-progress", progress_payload)
        |         |
        |         v
        |     Frontend: searchProgressHub.subscribe() -> update store
        |
        +---> app_handle.emit("search-result", result_payload)
        |         |
        |         v
        |     Frontend: searchResultHub.subscribe() -> append to store.searchResults
        |
        v
  Return SearchSummary (final totals)
        |
        v
  Frontend: store.searchStatus = "completed"
```

### Recommended Project Structure

```
src/features/explorer/
  components/
    search-bar.tsx              # Unified search input + Filename/Content toggle
    search-controls-row.tsx     # Scope dropdown, file pattern, Search button
    search-results.tsx          # Container replacing tree during content results
    search-result-group.tsx     # Collapsible folder group
    search-result-row.tsx       # Single file result row
    search-progress.tsx         # Inline progress indicator
  hooks/
    use-search-highlight.ts     # Monaco find-match decorations for search terms
  utils/
    query-parser.ts             # Parse search query into terms (optional frontend)
  store.ts                      # Extended with search state (types from types.ts)
  types.ts                      # Extended with SearchMode, SearchResult, etc.
  services/
    explorer-service.ts         # Extended with contentSearch, cancelSearch

src/services/
  events.ts                     # New searchProgressHub and searchResultHub
  tauri.ts                      # New contentSearch and cancelSearch commands

src-tauri/src/
  commands/
    explorer.rs                 # New content_search_cmd, cancel_search_cmd (reuse existing cancel)
    search.rs                   # (Alternative: separate file for search logic)
```

### Pattern 1: Content Search Command (mirrors bulk_scan_cmd)

**What:** Backend command that walks directories, reads + decodes files, searches for terms, streams results via events
**When to use:** Content search execution
**Example:**

```rust
// Source: existing bulk_scan_cmd pattern in src-tauri/src/commands/explorer.rs
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResultPayload {
    pub file_path: String,
    pub file_name: String,
    pub parent_folder: String,
    pub match_count: u32,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchProgressPayload {
    pub files_scanned: u32,
    pub total_files: u32,
    pub matches_found: u32,
    pub files_matched: u32,
}

#[tauri::command]
pub async fn content_search_cmd(
    app: AppHandle,
    query: String,
    folder_path: String,
    file_pattern: String,
    operation_id: String,
    explorer_state: State<'_, ExplorerState>,
) -> Result<SearchSummary, String> {
    // Parse query into terms
    let terms = parse_search_terms(&query);
    if terms.is_empty() {
        return Err("No search terms provided".to_string());
    }

    let pattern = Pattern::new(&file_pattern)
        .map_err(|e| format!("Invalid file pattern: {}", e))?;

    let cancel_token = CancellationToken::new();
    // ... store in ExplorerState.active_listings (reuse same HashMap)

    let result = tokio::task::spawn_blocking(move || {
        // Collect matching files (same as bulk_scan_cmd)
        let matching_files: Vec<PathBuf> = WalkDir::new(&folder_path)
            .into_iter()
            .filter_map(|e| e.ok())
            .filter(|e| !e.file_type().is_dir())
            .filter(|e| e.file_name().to_str()
                .map(|n| pattern.matches(n))
                .unwrap_or(false))
            .map(|e| e.into_path())
            .collect();

        // Search each file
        for file_path in &matching_files {
            if token_clone.is_cancelled() { break; }

            let raw_bytes = match std::fs::read(file_path) { ... };
            let decode_result = detect_and_decode(&raw_bytes);
            let content_lower = decode_result.content.to_lowercase();

            // AND logic: all terms must be present
            let all_present = terms.iter().all(|t| content_lower.contains(t));
            if !all_present { continue; }

            // Count matches per term
            let match_count: u32 = terms.iter()
                .map(|t| content_lower.matches(t).count() as u32)
                .sum();

            // Emit per-file result
            app.emit("search-result", SearchResultPayload { ... });

            // Emit progress (throttled)
            app.emit("search-progress", SearchProgressPayload { ... });
        }

        SearchSummary { ... }
    }).await?;

    Ok(result)
}
```

[VERIFIED: pattern from existing `bulk_scan_cmd` in `src-tauri/src/commands/explorer.rs`]

### Pattern 2: Query Term Parsing

**What:** Parse user input into search terms, handling quoted phrases
**When to use:** Before executing content search
**Example:**

```rust
// Source: custom implementation following D-07
fn parse_search_terms(query: &str) -> Vec<String> {
    let mut terms = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;

    for ch in query.chars() {
        match ch {
            '"' => {
                if in_quotes {
                    if !current.is_empty() {
                        terms.push(current.to_lowercase());
                        current.clear();
                    }
                    in_quotes = false;
                } else {
                    if !current.is_empty() {
                        terms.push(current.to_lowercase());
                        current.clear();
                    }
                    in_quotes = true;
                }
            }
            ' ' if !in_quotes => {
                if !current.is_empty() {
                    terms.push(current.to_lowercase());
                    current.clear();
                }
            }
            _ => current.push(ch),
        }
    }
    if !current.is_empty() {
        terms.push(current.to_lowercase());
    }
    terms
}
```

### Pattern 3: Monaco Find-Match Decorations

**What:** Highlight all occurrences of search terms in an opened file using Monaco's model API
**When to use:** When opening a file from search results (D-22)
**Example:**

```typescript
// Source: Monaco Editor ITextModel.findMatches API [CITED: microsoft.github.io/monaco-editor]
// Combined with existing useValidationDecorations pattern from this codebase

export function useSearchHighlight(
  editorInstance: editor.IStandaloneCodeEditor | null,
  searchTerms: string[] | null
): void {
  const collectionRef = useRef<editor.IEditorDecorationsCollection | null>(null);

  useEffect(() => {
    if (!editorInstance || !searchTerms || searchTerms.length === 0) {
      collectionRef.current?.clear();
      return;
    }

    const model = editorInstance.getModel();
    if (!model) return;

    const decorations: editor.IModelDeltaDecoration[] = [];
    let firstMatch: editor.FindMatch | null = null;

    for (const term of searchTerms) {
      // findMatches(searchString, searchOnlyEditableRange, isRegex, matchCase, wordSeparators, captureMatches)
      const matches = model.findMatches(term, false, false, false, null, false);
      if (!firstMatch && matches.length > 0) {
        firstMatch = matches[0];
      }
      for (const match of matches) {
        decorations.push({
          range: match.range,
          options: {
            className: "search-match-highlight",
            overviewRuler: {
              color: "oklch(0.82 0.12 85)",
              position: 2, // OverviewRulerLane.Center
            },
          },
        });
      }
    }

    collectionRef.current = editorInstance.createDecorationsCollection(decorations);

    // Scroll to first match (D-22)
    if (firstMatch) {
      editorInstance.revealRangeInCenterIfOutsideViewport(firstMatch.range);
    }

    return () => {
      collectionRef.current?.clear();
      collectionRef.current = null;
    };
  }, [editorInstance, searchTerms]);
}
```

[CITED: microsoft.github.io/monaco-editor FindMatch API, plus codebase pattern from `use-validation-decorations.ts`]

### Pattern 4: Event Hub for Search Events

**What:** Create event hubs for streaming search results and progress
**When to use:** Frontend subscription to backend events
**Example:**

```typescript
// Source: existing scanProgressHub pattern in src/services/events.ts
import type { SearchResultPayload, SearchProgressPayload } from "@/features/explorer/types";

export const searchResultHub = createEventHub<SearchResultPayload>("search-result");
export const searchProgressHub = createEventHub<SearchProgressPayload>("search-progress");
```

[VERIFIED: pattern from existing `scanProgressHub` in `src/services/events.ts`]

### Pattern 5: Store Extensions for Search State

**What:** Extend explorer Zustand store with search mode, query, scope, results, and progress
**When to use:** Managing search UI state
**Example:**

```typescript
// Source: existing explorer store pattern, extended per UI-SPEC state management section
// New state fields added to ExplorerStore interface
searchMode: "filename" | "content";        // D-02
searchQuery: string;                        // shared input text
searchScope: "folder" | "source" | "all";  // D-09
searchFilePattern: string;                  // D-14
searchStatus: "idle" | "searching" | "completed" | "cancelled";
searchProgress: SearchProgressPayload | null;
searchResults: SearchResultFile[];          // accumulated from events
searchErrors: SearchErrorFile[];            // D-26
searchSummary: SearchSummary | null;
searchOperationId: string | null;
```

[VERIFIED: pattern from existing store in `src/features/explorer/store.ts`]

### Anti-Patterns to Avoid

- **Reading files in the frontend:** Never use `@tauri-apps/plugin-fs` for content search. All file I/O must go through the Rust backend via `spawn_blocking` + `std::fs` to avoid blocking the main thread and to properly handle encoding detection. [VERIFIED: codebase pattern]
- **Blocking the Tokio runtime:** Do not use `std::fs` directly in async Rust code. Always wrap in `spawn_blocking` (existing pattern in `bulk_scan_cmd`). [VERIFIED: codebase pattern]
- **Using `tokio::fs` for network shares:** The `tokio::fs::read_dir` hang on UNC paths (tokio#5473) is a known issue documented in STATE.md. Stick with `std::fs` inside `spawn_blocking`. [VERIFIED: STATE.md blockers section]
- **Emitting events too frequently:** Throttle event emission to every ~50ms (existing pattern in `bulk_scan_cmd`). Emitting per-file without throttling causes frontend event queue saturation. [VERIFIED: `bulk_scan_cmd` line 358]
- **Creating search results as tabs:** Search results display in the sidebar, not as content tabs. Do not follow the `scan:results` tab pattern here. [VERIFIED: D-16 in CONTEXT.md]
- **Persisting search state to disk:** Search state is session-only (D-25). Do not write to settings or localStorage. [VERIFIED: D-25 in CONTEXT.md]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Encoding detection | Custom byte-level heuristics | `detect_and_decode()` from `validation/encoding.rs` | Already handles BOM, chardetng, encoding_rs pipeline; handles all edge cases for these XML files |
| Directory walking | Manual recursive `std::fs::read_dir` | `walkdir` crate (already a dependency) | Handles symlinks, permission errors, cross-platform paths |
| File pattern matching | Custom glob implementation | `glob::Pattern` (already a dependency) | Handles `*`, `?`, `[...]` patterns correctly |
| Cancellation | Manual `AtomicBool` flags | `tokio_util::sync::CancellationToken` (already a dependency) | Thread-safe, integrates with tokio, already used by existing commands |
| Event streaming | Manual WebSocket or polling | `app_handle.emit()` + `createEventHub()` | Tauri's built-in event system, already proven in Phase 5 scan progress |
| Monaco text search | Manual string indexing for highlight positions | `ITextModel.findMatches()` | Monaco's built-in search handles Unicode, large files, and returns exact ranges |

**Key insight:** This phase should add zero new dependencies. Every infrastructure piece is already in the codebase from Phases 2-5. The only new code is the search command logic, query parser, and UI components.

## Common Pitfalls

### Pitfall 1: Network Share Latency During File Collection
**What goes wrong:** `WalkDir::new()` blocks while enumerating directories over VPN. With "All sources" scope, this could take minutes.
**Why it happens:** walkdir traverses the entire tree synchronously before returning any results.
**How to avoid:** Collect matching file paths first (Phase 1), then search them (Phase 2) -- same two-phase approach as `bulk_scan_cmd`. The file collection phase shows no progress; ensure the progress indicator starts with "Collecting files..." before switching to "Searching... N of M files". Check `CancellationToken` during collection phase too.
**Warning signs:** Search appears to hang with no progress for the first several seconds.

### Pitfall 2: Case-Insensitive Matching with Non-ASCII
**What goes wrong:** `str::to_lowercase()` in Rust handles Unicode correctly (it's not just ASCII tolower), but the lowercased version may have different byte length than the original.
**Why it happens:** Some Unicode characters change byte length when lowercased (e.g., German sharp s).
**How to avoid:** Always compare lowercased-to-lowercased. Since D-29 says we only return match count (not positions), byte offset differences don't matter. The count from `lowercased.matches(term).count()` is correct.
**Warning signs:** Match counts differ between backend and Monaco's `findMatches()` with `matchCase: false`.

### Pitfall 3: Quoted Phrase with Spaces in Query Parsing
**What goes wrong:** Naive `split(' ')` breaks quoted phrases like `"patient id"` into two separate terms.
**Why it happens:** D-07 specifies quoted strings for exact phrase matching.
**How to avoid:** Implement a proper state-machine parser that tracks in-quote state. Test edge cases: unclosed quotes, empty quotes, consecutive spaces, quotes at start/end.
**Warning signs:** Searching for `"John Smith"` matches files containing just "John" or just "Smith" separately.

### Pitfall 4: Memory Pressure on Large Files
**What goes wrong:** Reading very large files (>100MB) into memory for content search causes spikes.
**Why it happens:** D-30 says "no file size limit", but practically, multi-hundred-MB files on network shares will be slow.
**How to avoid:** While D-30 says no limit, consider reading in chunks or skipping files above a reasonable threshold (50MB, consistent with `MAX_SCAN_FILE_SIZE` in `bulk_scan_cmd`). If a file is too large, count it as scanned but not searched, or emit an error result.
**Warning signs:** Memory usage spikes, app becomes unresponsive.

### Pitfall 5: Stale Event Listeners After Search Cancellation
**What goes wrong:** Events from a cancelled search arrive after a new search starts, mixing results.
**Why it happens:** Event emission is asynchronous; cancellation doesn't immediately stop in-flight emits.
**How to avoid:** Include `operationId` in every event payload. Frontend listeners filter events by `operationId` matching the current active search. Same approach as scan progress.
**Warning signs:** Results from a previous search appear in the current results list.

### Pitfall 6: Keyboard Shortcut Conflicts
**What goes wrong:** Cmd+F already has meaning in Monaco Editor (native find). If Explorer mode captures it globally, it may conflict when the editor is focused.
**Why it happens:** Multiple components register the same keyboard shortcut.
**How to avoid:** Only register Cmd+F and Cmd+Shift+F at the Explorer shell level, and only when the Monaco editor is NOT focused. When Monaco has focus, let its native Cmd+F behavior work. Alternatively, always capture at the sidebar level and blur Monaco first.
**Warning signs:** Pressing Cmd+F opens Monaco's built-in find widget instead of focusing the sidebar search bar.

## Code Examples

### Scope Resolution (Frontend)

```typescript
// Source: derived from store/types patterns in codebase
function resolveSearchScope(
  scope: SearchScope,
  treeNodes: Map<string, TreeNode>,
  expandedIds: Set<string>,
  selectedNodeId: string | null,
  folderSources: FolderSource[]
): { paths: string[]; label: string } | null {
  if (!selectedNodeId && scope !== "all") return null;

  switch (scope) {
    case "folder": {
      const node = selectedNodeId ? treeNodes.get(selectedNodeId) : null;
      if (!node || !node.isDir) return null;
      return { paths: [node.path], label: `Folder: ${node.name}` };
    }
    case "source": {
      // Walk up from selected node to find the source root
      // The source node's path is the root folder path
      const sourceNode = findParentSource(selectedNodeId!, treeNodes, folderSources);
      if (!sourceNode) return null;
      return { paths: [sourceNode.path], label: `Source: ${sourceNode.name}` };
    }
    case "all": {
      const paths = folderSources.map(s => s.path);
      return { paths, label: "All sources" };
    }
  }
}
```

### Search Command IPC Registration

```typescript
// Source: existing tauri.ts pattern
// Add to src/services/tauri.ts
contentSearch: (query: string, folderPath: string, filePattern: string, operationId: string) =>
  invokeCommand<SearchSummary>("content_search_cmd", {
    query, folderPath, filePattern, operationId,
  }),
cancelSearch: (operationId: string) =>
  invokeCommand<void>("cancel_scan_cmd", { operationId }),
  // Reuse cancel_scan_cmd -- it just cancels by operationId from ExplorerState.active_listings
```

Note: `cancel_scan_cmd` can be reused directly for search cancellation because it simply looks up the `operationId` in `ExplorerState.active_listings` and cancels the token. No need for a separate cancel command.

### Multi-Folder Search (All Sources scope)

```rust
// Source: derived from bulk_scan_cmd walkdir pattern
// When scope is "All sources", the frontend passes multiple folder paths
// Backend iterates each source root sequentially
let folder_paths: Vec<String> = serde_json::from_str(&folder_paths_json)?;
let mut all_matching_files: Vec<PathBuf> = Vec::new();

for folder_path in &folder_paths {
    if token_clone.is_cancelled() { break; }
    let files: Vec<PathBuf> = WalkDir::new(folder_path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| !e.file_type().is_dir())
        .filter(|e| e.file_name().to_str()
            .map(|n| pattern.matches(n))
            .unwrap_or(false))
        .map(|e| e.into_path())
        .collect();
    all_matching_files.extend(files);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `deltaDecorations()` (deprecated) | `createDecorationsCollection()` | Monaco 0.45+ | Use collection-based API for managing decorations. Already used in `use-validation-decorations.ts` |
| Tauri v1 event system | Tauri v2 `Emitter` trait with `app.emit()` | Tauri 2.0 | Event emission uses `AppHandle::emit()` method. Already established in codebase |
| `tokio::fs` for file I/O | `spawn_blocking` + `std::fs` | Project convention | Avoids tokio::fs hang on UNC paths (tokio#5473). Established in Phase 2 |

**Deprecated/outdated:**
- `deltaDecorations()`: Replaced by `createDecorationsCollection()`. The codebase already uses the current API. [VERIFIED: `use-validation-decorations.ts`]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `str::to_lowercase()` + `str::matches().count()` is sufficient performance for searching files over VPN (no need for `aho-corasick`) | Standard Stack | Low -- aho-corasick is a transitive dep and can be added as direct dep if performance is insufficient |
| A2 | `cancel_scan_cmd` can be reused for search cancellation (same `ExplorerState.active_listings` map) | Code Examples | Low -- if namespace collision is a concern, a separate map can be added trivially |
| A3 | Monaco `findMatches()` with `matchCase: false` produces same match count as Rust `to_lowercase().matches()` for the same input | Pitfalls | Medium -- Unicode edge cases may differ between Rust and JavaScript lowercase. Acceptable because match count is informational, not authoritative |
| A4 | For "All sources" scope, backend accepts a JSON array of folder paths rather than a single path | Architecture | Low -- alternative is making multiple IPC calls. Single call with array is simpler |

## Open Questions

1. **Keyboard shortcut handling when Monaco editor is focused**
   - What we know: Cmd+F is Monaco's native "Find" shortcut. D-08 wants Cmd+F to focus sidebar search.
   - What's unclear: Whether to intercept Cmd+F globally (breaking Monaco's native find) or only when sidebar/tree has focus.
   - Recommendation: Register shortcuts at the Explorer shell level. When Monaco editor has focus, let its native find work. Add a note in the UI (tooltip) that Cmd+F focuses sidebar search when sidebar is focused. This avoids breaking Monaco's UX.

2. **"All sources" scope: single command call or multiple?**
   - What we know: D-09 has "All sources" as a scope option. The backend `content_search_cmd` could accept either a single folder path or an array.
   - What's unclear: Whether to pass all source paths in one call or iterate from the frontend.
   - Recommendation: Accept a `folder_paths: Vec<String>` parameter (JSON array). A single backend call with all paths is simpler for cancellation and progress tracking.

3. **Match count discrepancy between backend and Monaco**
   - What we know: Backend counts matches via `to_lowercase().matches()`. Monaco counts via `findMatches()` with `matchCase: false`.
   - What's unclear: Whether they will always produce identical counts for the same content.
   - Recommendation: Accept minor discrepancies. The backend count is for the results list; Monaco highlighting is for visual reference. Document this as expected behavior.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Frontend build | Yes | v24.11.0 | -- |
| npm | Package management | Yes | 11.6.1 | -- |
| Rust toolchain | Backend build | Yes | 1.91.1 | -- |
| Cargo | Rust package management | Yes | 1.91.1 | -- |

**Missing dependencies with no fallback:** None
**Missing dependencies with fallback:** None

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.2 (frontend), Rust built-in `#[test]` (backend) |
| Config file | `vitest.config.ts` (frontend), default cargo test (backend) |
| Quick run command | `npm run test -- --run` |
| Full suite command | `npm run test -- --run && cd src-tauri && cargo test` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SRCH-01 | Filename filtering uses existing `filterTreeNodes` | unit | `npm run test -- --run src/features/explorer/utils/tree-filter.test.ts` | No (Wave 0) |
| SRCH-02a | Query parser handles space-separated terms and quotes | unit | `cd src-tauri && cargo test parse_search_terms` | No (Wave 0) |
| SRCH-02b | Content search finds terms in decoded file content | unit | `cd src-tauri && cargo test content_search` | No (Wave 0) |
| SRCH-02c | Store search state transitions (idle->searching->completed) | unit | `npm run test -- --run src/features/explorer/store.test.ts` | Yes (extend) |
| SRCH-03 | Scope resolution maps tree selection to folder paths | unit | `npm run test -- --run src/features/explorer/utils/scope-resolver.test.ts` | No (Wave 0) |

### Sampling Rate

- **Per task commit:** `npm run test -- --run && npm run build`
- **Per wave merge:** `npm run test -- --run && cd src-tauri && cargo test && npm run build`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/features/explorer/utils/tree-filter.test.ts` -- covers SRCH-01 (confirm existing filter works for search use case)
- [ ] `src-tauri/src/commands/explorer.rs` tests -- covers SRCH-02a (query parser) and SRCH-02b (search logic)
- [ ] `src/features/explorer/store.test.ts` extensions -- covers SRCH-02c (search state transitions)
- [ ] `src/features/explorer/utils/scope-resolver.test.ts` -- covers SRCH-03 (scope resolution)

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A -- desktop app, no auth |
| V3 Session Management | No | N/A -- no sessions |
| V4 Access Control | No | N/A -- read-only filesystem access |
| V5 Input Validation | Yes | Validate `file_pattern` via `glob::Pattern::new()` (already does this). Validate `query` is non-empty. Validate `folder_path` exists before walking. |
| V6 Cryptography | No | N/A -- no crypto operations |

### Known Threat Patterns for Tauri + Filesystem

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via search scope | Tampering | Backend validates `folder_path` is within configured source roots. Do not allow arbitrary path search. |
| Regex denial of service | Denial of Service | D-05/D-06 explicitly exclude regex. Search terms are plain substrings only. |
| Large file memory exhaustion | Denial of Service | Cancel button (D-30). Consider reusing `MAX_SCAN_FILE_SIZE` from bulk scan for practical limits. |
| Event flooding | Denial of Service | Throttle event emission to 50ms intervals (existing pattern). |

## Sources

### Primary (HIGH confidence)
- Codebase: `src-tauri/src/commands/explorer.rs` -- `bulk_scan_cmd` pattern for directory walking, file reading, event streaming, cancellation
- Codebase: `src-tauri/src/validation/encoding.rs` -- `detect_and_decode` pipeline
- Codebase: `src/services/events.ts` -- `createEventHub` pattern
- Codebase: `src/features/explorer/hooks/use-validation-decorations.ts` -- Monaco decoration pattern
- Codebase: `src/features/explorer/store.ts` -- Zustand store extension pattern
- Codebase: `src/features/explorer/utils/tree-filter.ts` -- existing filename filter function

### Secondary (MEDIUM confidence)
- [Monaco Editor API - FindMatch](https://microsoft.github.io/monaco-editor/typedoc/classes/editor.FindMatch.html) -- `findMatches()` method signature
- [Monaco Editor API - ITextModel](https://blutorange.github.io/primefaces-monaco/typedoc/interfaces/monaco.editor.itextmodel.html) -- `findMatches()` parameters
- [aho-corasick crate docs](https://docs.rs/aho-corasick) -- confirmed as transitive dependency, not needed as direct

### Tertiary (LOW confidence)
- None -- all findings verified against codebase or official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- zero new dependencies, all patterns already implemented in codebase
- Architecture: HIGH -- direct mirror of Phase 5 `bulk_scan_cmd` pattern with known integration points
- Pitfalls: HIGH -- based on actual codebase patterns and documented issues (tokio#5473, event throttling)

**Research date:** 2026-05-28
**Valid until:** 2026-06-28 (stable -- no external dependency changes expected)
