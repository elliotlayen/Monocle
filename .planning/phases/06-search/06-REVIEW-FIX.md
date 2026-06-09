---
phase: 06-search
fixed_at: 2026-05-28T15:12:00Z
review_path: .planning/phases/06-search/06-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 06: Code Review Fix Report

**Fixed at:** 2026-05-28T15:12:00Z
**Source review:** .planning/phases/06-search/06-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7 (CR-01, CR-02, WR-01, WR-02, WR-03, WR-04, WR-05)
- Fixed: 7
- Skipped: 0

## Fixed Issues

### CR-01: cancelContentSearch sends the wrong Tauri command

**Files modified:** `src/features/explorer/services/explorer-service.ts`, `src/features/explorer/store.ts`
**Commit:** 8b9e2cb
**Applied fix:** Added a `cancelContentSearch` method to `explorerService` that delegates to `tauri.cancelScan` with a comment documenting the shared `active_listings` contract. Updated `cancelContentSearch` in the store to call `explorerService.cancelContentSearch` instead of reaching into `explorerService.cancelScan` directly, enforcing the scan/search service boundary.

---

### CR-02: path.startsWith(s.path) without separator suffix allows false source matching

**Files modified:** `src/features/explorer/store.ts`
**Commit:** b22d2e2
**Applied fix:** Fixed both occurrences. In `buildChildNodes` (line 137): changed to `entry.path === s.path || entry.path.startsWith(s.path + "/") || entry.path.startsWith(s.path + "\\")`. In `toggleFavorite` (line 410): same three-condition check for `id` against `source.path`. Both now match the correct separator pattern already used in `toggleSearchCheck`.

---

### WR-01: SearchResultFile type lacks operationId, causing stale-result guard to be skipped

**Files modified:** `src/features/explorer/types.ts`, `src/features/explorer/hooks/use-search.ts`
**Commit:** 65d319e
**Applied fix:** Added `operationId: string` field to `SearchResultFile` interface in `types.ts`. Updated `handleResult` in `use-search.ts` to use an unconditional `if (payload.operationId !== currentOpId) return;` check (removing the `&&` short-circuit). Simplified `appendSearchResult` call to pass the full payload directly.

---

### WR-02: ensureListening in createEventHub has a TOCTOU race that can leak duplicate listeners

**Files modified:** `src/services/events.ts`
**Commits:** 3ea79e8, 18dc1c5
**Applied fix:** Wrapped the `await listen(...)` call in a try/catch that resets `listening = false` on failure and re-throws. This prevents `listening` being permanently stuck at `true` when the listen call fails, which would have silently prevented any future listener from registering. Initial attempt used bare `throw;` (not valid in TypeScript); corrected to `catch (err) { listening = false; throw err; }`.

---

### WR-03: confirmPendingScan uses an arbitrary 100ms delay to sequence cancel then start

**Files modified:** `src-tauri/src/commands/explorer.rs`, `src/features/explorer/types.ts`, `src/features/explorer/store.ts`
**Commit:** 46fb789
**Applied fix:** Added `operationId` field to `ScanProgressPayload` in both the Rust struct (with `operation_id: String`) and the TypeScript interface. Updated the Rust payload construction to include `operation_id: op_id.clone()` and introduced `op_id_cleanup` to preserve the value for post-closure cleanup. Added an operationId guard to `updateScanProgress` in the store that matches the existing pattern in `updateSearchProgress`, preventing interleaved progress events from concurrent scans from corrupting the displayed progress state.

---

### WR-04: SearchResultGroup sorts files twice — once in the store, once in the component

**Files modified:** `src/features/explorer/components/search-result-group.tsx`
**Commit:** 242613d
**Applied fix:** Removed the `sortedFiles` variable and its `.sort()` call. Changed the JSX render to use `files` directly since `appendSearchResult` in the store already sorts `searchResults` alphabetically by `fileName` on each append. The `sortedErrors` sort for error files is preserved since `searchErrors` is not sorted in the store.

---

### WR-05: Interactive div elements in search results lack keyboard accessibility

**Files modified:** `src/features/explorer/components/search-result-group.tsx`
**Commit:** 242613d
**Applied fix:** Added `role="button"`, `tabIndex={0}`, and `onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpanded(!expanded); }}` to the group header div in `SearchResultGroup`. The result rows in `SearchResultRow` already had `role="button"` applied.

---

_Fixed: 2026-05-28T15:12:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
