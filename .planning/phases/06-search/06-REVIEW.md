---
phase: 06-search
reviewed: 2026-05-28T00:00:00Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - src-tauri/src/commands/explorer.rs
  - src-tauri/src/commands/mod.rs
  - src-tauri/src/lib.rs
  - src/components/app-settings-sheet.tsx
  - src/features/explorer/components/explorer-nav-bar.tsx
  - src/features/explorer/components/explorer-sidebar.tsx
  - src/features/explorer/components/file-content-area.tsx
  - src/features/explorer/components/folder-tree-node.tsx
  - src/features/explorer/components/folder-tree.tsx
  - src/features/explorer/components/search-bar.tsx
  - src/features/explorer/components/search-progress.tsx
  - src/features/explorer/components/search-result-group.tsx
  - src/features/explorer/components/search-result-row.tsx
  - src/features/explorer/components/search-results.tsx
  - src/features/explorer/components/xml-source-view.tsx
  - src/features/explorer/hooks/use-search-highlight.ts
  - src/features/explorer/hooks/use-search.ts
  - src/features/explorer/services/explorer-service.ts
  - src/features/explorer/store.ts
  - src/features/explorer/types.ts
  - src/features/settings/components/sections/explorer-settings-section.tsx
  - src/services/events.ts
  - src/services/tauri.ts
findings:
  critical: 2
  warning: 5
  info: 4
  total: 11
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-05-28
**Depth:** standard
**Files Reviewed:** 23
**Status:** issues_found

## Summary

This phase implements content search, folder-tree checkboxes, search result display, and Monaco editor search-term highlighting. The overall architecture is sound and follows established patterns. Two critical bugs were identified: a stale operation-ID check that silently drops search results in multi-search scenarios, and a path-prefix check missing a separator that can misattribute favorite and badge state to a different source. Five warnings cover the search cancel command mismatch, a `setTimeout`-based race, double-sort of result files, missing `aria-role` on interactive divs, and an `eprintln!` left in production Rust code. Four info items cover dead state, a magic number, a `SearchResultFile` type gap, and a minor glob test comment inaccuracy.

---

## Critical Issues

### CR-01: `cancelContentSearch` sends the wrong Tauri command — search cannot be cancelled

**File:** `src/features/explorer/store.ts:1037-1044`

**Issue:** `cancelContentSearch` calls `explorerService.cancelScan(searchOperationId)`, which resolves to the `cancel_scan_cmd` Tauri command. The backend registers `cancel_scan_cmd` to cancel the bulk-scan operation, and `content_search_cmd` stores its token under the same `active_listings` HashMap keyed by `operationId`. In this particular deployment the HashMap is shared, so by coincidence the cancel actually works — but only because both commands use the same `ExplorerState.active_listings` map. This is a fragile, undocumented coupling. If a separate cancel command (`cancel_search_cmd`) is ever added for the content-search path (as the naming suggests it should be), the existing frontend will silently stop working. More importantly, there is no `cancel_search_cmd` in `tauri.ts` or `explorer-service.ts`, meaning the intent of a dedicated cancel path was never completed.

Additionally, the frontend service layer exposes no `cancelSearch` method; `cancelContentSearch` reaches into `cancelScan` by name, violating the single-responsibility boundary between scan and search operations.

**Fix:**
Either document the shared-map contract explicitly and add a `cancelSearch` alias in `explorer-service.ts`:
```ts
// explorer-service.ts
cancelContentSearch: (operationId: string): Promise<void> =>
  tauri.cancelScan(operationId), // shares active_listings with scan
```
And call it from the store:
```ts
cancelContentSearch: async () => {
  const { searchOperationId } = get();
  if (searchOperationId) {
    try {
      await explorerService.cancelContentSearch(searchOperationId);
    } catch { /* best-effort */ }
  }
},
```
Or add a dedicated `cancel_search_cmd` in Rust if search cancellation behaviour needs to diverge from scan cancellation in the future.

---

### CR-02: `path.startsWith(s.path)` without separator suffix allows false source matching

**File:** `src/features/explorer/store.ts:138` and `408`

**Issue:** Two separate locations perform prefix checks without appending a path separator:

```ts
// Line 138 — buildChildNodes
const source = folderSources.find((s) => entry.path.startsWith(s.path));

// Line 408 — toggleFavorite
if (node.isDir && id.startsWith(source.path)) {
```

If two sources share a common prefix (e.g., `/data/clients` and `/data/clientsOld`), an entry under `/data/clientsOld/file.xml` will match the first source (`/data/clients`) and be incorrectly marked as a favorite or have its badge state updated against the wrong source. This results in silently wrong favorite and validation-badge state in the UI.

The fix in `toggleSearchCheck` (lines 941-942) correctly appends `/` and `\\` before checking; these two locations do not.

**Fix:**
```ts
// Line 138
const source = folderSources.find((s) =>
  entry.path === s.path ||
  entry.path.startsWith(s.path + "/") ||
  entry.path.startsWith(s.path + "\\")
);

// Line 408
if (
  node.isDir &&
  (id === source.path ||
    id.startsWith(source.path + "/") ||
    id.startsWith(source.path + "\\"))
) {
```

---

## Warnings

### WR-01: `SearchResultFile` type lacks `operationId`, causing stale-result guard to be skipped

**File:** `src/features/explorer/hooks/use-search.ts:36-38` and `src/features/explorer/types.ts:117-122`

**Issue:** The `SearchResultFile` interface has no `operationId` field. The `handleResult` callback in `use-search.ts` extends the type with `& { operationId?: string }` and treats the field as optional. The Rust `SearchResultPayload` struct **does** carry `operation_id` (serialised as `operationId`), so the field is present at runtime. However, the TypeScript type does not declare it, and the guard condition `if (payload.operationId && payload.operationId !== currentOpId) return;` is qualified with `&&` — meaning if `operationId` is ever absent (undefined), the result is accepted unconditionally. Because the hub fires for any `search-result` event on the channel, a result from a completed prior search that arrives late (e.g., from a slow file system) will be appended to the current results set if `operationId` is missing.

**Fix:** Add `operationId` to `SearchResultFile` in `types.ts`:
```ts
export interface SearchResultFile {
  filePath: string;
  fileName: string;
  parentFolder: string;
  matchCount: number;
  operationId: string;
}
```
And in the hook, make the check unconditional:
```ts
if (payload.operationId !== currentOpId) return;
```

---

### WR-02: `ensureListening` in `createEventHub` has a TOCTOU race that can leak duplicate listeners

**File:** `src/services/events.ts:12-16`

**Issue:** `ensureListening` sets `listening = true` synchronously before `await listen(...)` completes. A second concurrent call to `subscribe` between the `listening = true` assignment and the `unlisten =` assignment will see `listening = true` and skip starting its own listener — so far so good. But if the first `listen` call fails (rejected promise), `unlisten` stays `null` and `listening` stays `true`, permanently preventing any listener from ever being registered. Subsequent calls to `subscribe` will silently lose events.

```ts
const ensureListening = async () => {
  if (unlisten || listening) return;
  listening = true;                        // set before await
  unlisten = await listen<T>(...);         // if this throws, listening stays true
};
```

**Fix:** Reset `listening` on failure:
```ts
const ensureListening = async () => {
  if (unlisten || listening) return;
  listening = true;
  try {
    unlisten = await listen<T>(eventName, (event) => {
      subscribers.forEach((cb) => cb(event.payload));
    });
  } catch {
    listening = false;
    throw;
  }
};
```

---

### WR-03: `confirmPendingScan` uses an arbitrary 100 ms delay to sequence cancel then start

**File:** `src/features/explorer/store.ts:877-881`

**Issue:** After cancelling the current scan, the code waits `100 ms` before starting the new scan to "allow cancellation to propagate." This is a fragile timing assumption. `cancelScan` sends a cancellation token signal over Tauri IPC; if the backend is under load or the IPC round-trip exceeds 100 ms, `startScan` begins before the previous scan has terminated, and both scans compete to write the same `active_listings` slot and emit `scan-progress` events with different `operationId` values. Because `updateScanProgress` does not filter by operationId (unlike `updateSearchProgress`), interleaved progress events from the two scans will corrupt the displayed progress state.

**Fix:** Either await the scan completion by having the cancel command return only after the task is cancelled (preferred), or wait for the existing `bulkScan` promise to settle before starting the new scan. At minimum, `updateScanProgress` should filter by the current `scanOperationId` the same way `updateSearchProgress` does.

---

### WR-04: `SearchResultGroup` sorts files twice — once in the store, once in the component

**File:** `src/features/explorer/components/search-result-group.tsx:39-43` and `src/features/explorer/store.ts:1030-1031`

**Issue:** `appendSearchResult` in the store already sorts `searchResults` alphabetically by `fileName` after each append (line 1031). `SearchResultGroup` receives the per-folder `files` slice from that pre-sorted array and then sorts them again (line 39). This double-sort is harmless but wastes CPU proportional to the number of results per folder on each re-render. More importantly, the secondary sort in the component may diverge from the store sort if `localeCompare` behaviour differs (it won't in practice, but the redundancy creates maintenance confusion about where the canonical sort order lives).

**Fix:** Remove the sort in `SearchResultGroup` since the store guarantees arrival order is already alphabetical:
```ts
// Remove:
const sortedFiles = [...files].sort((a, b) => a.fileName.localeCompare(b.fileName));
// Replace all sortedFiles references with files directly
```

---

### WR-05: Interactive `div` elements in search results lack keyboard accessibility

**File:** `src/features/explorer/components/search-result-group.tsx:49-52` and `src/features/explorer/components/search-result-row.tsx:13-16, 34-37`

**Issue:** The group header `div` (toggle expand/collapse) and both result-row `div` elements use `onClick` but are declared with `role="button"` only in `SearchResultRow`. The group header div in `SearchResultGroup` has `aria-expanded` but no `role`, `tabIndex`, or `onKeyDown` handler. Users navigating by keyboard cannot collapse or expand result groups, and there is no `tabIndex` on the result rows in `SearchResultGroup`'s rendered items.

**Fix:** For the group header in `SearchResultGroup`:
```tsx
<div
  className="flex items-center gap-2 px-4 py-1 cursor-pointer hover:bg-accent/50"
  onClick={() => setExpanded(!expanded)}
  role="button"
  tabIndex={0}
  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpanded(!expanded); }}
  aria-expanded={expanded}
>
```

---

## Info

### IN-01: `eprintln!` in production Rust code writes to stderr unconditionally

**File:** `src-tauri/src/commands/explorer.rs:75`

**Issue:** `eprintln!("Skipping unreadable entry: {}", e);` runs in production whenever a directory entry cannot be read (e.g., permission denied on a network share). While not a security issue, it emits noise to stderr in the shipped app, and in Tauri desktop builds stderr is typically not visible to end users — making it useless for debugging while adding I/O overhead in loops over large directories.

**Fix:** Remove the `eprintln!` or gate it behind `#[cfg(debug_assertions)]`:
```rust
#[cfg(debug_assertions)]
eprintln!("Skipping unreadable entry: {}", e);
```

---

### IN-02: `activeSearchTerms` state is never cleared when switching away from a search result file tab

**File:** `src/features/explorer/store.ts:73` (state field), `src/features/explorer/store.ts:1048-1058` (clearSearchResults)

**Issue:** `activeSearchTerms` is set when a user clicks a search result (`handleFileClick` in `explorer-sidebar.tsx`), and cleared only by `clearSearchResults`. If the user clicks a search result, the file opens with highlights; if they then open a different file manually (not from search results), `activeSearchTerms` is still non-null, so the new file will also have search-term highlights applied via `useSearchHighlight`, which may be confusing and unexpected.

**Fix:** Clear `activeSearchTerms` in `openFile` when the file is not being opened from a search result, or in `setActiveTab`:
```ts
setActiveTab: (tabId: string) => {
  set({ activeTabId: tabId, activeSearchTerms: null });
},
```
Or scope `activeSearchTerms` per-tab in `FileTab` to avoid the global state bleed.

---

### IN-03: Magic number `100` ms in `confirmPendingScan` should be a named constant

**File:** `src/features/explorer/store.ts:880`

**Issue:** `await new Promise((resolve) => setTimeout(resolve, 100))` uses a bare magic number. If adjusted for a fix to WR-03, a constant documents the intent:

```ts
const CANCEL_PROPAGATION_DELAY_MS = 100;
await new Promise((resolve) => setTimeout(resolve, CANCEL_PROPAGATION_DELAY_MS));
```

---

### IN-04: Glob test comment is inaccurate about path-separator matching behaviour

**File:** `src-tauri/src/commands/explorer.rs:793-796`

**Issue:** The test comment states "The glob crate's `*` does match path separators by default" and then asserts `xml_pattern.matches("subdir/file.xml")` is true. This assertion is correct and the glob crate does match `/` with `*` by default. However, the comment adds "so path separators in the input are not a concern in practice" which contradicts the actual matching behaviour being tested. The real reason path separators are not a concern is that the calling code passes only the filename component (`e.file_name()`), not the full path. The comment conflates the two.

**Fix:** Update the comment to accurately describe the code path:
```rust
// Pattern matching is applied to filenames only (via e.file_name()), not full paths,
// so embedded separators never appear in the matched string in practice.
```

---

_Reviewed: 2026-05-28_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
