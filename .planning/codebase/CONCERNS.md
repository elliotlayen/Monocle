# Concerns

> Last mapped: 2026-05-22

## Technical Debt

### High Priority

| Issue | Location | Impact |
|-------|----------|--------|
| `schema-graph.tsx` is 2418 lines with ~50 hooks | `src/features/schema-graph/components/schema-graph.tsx` | Hard to maintain, test, or extend |
| `store.ts` is 2181 lines with all state logic | `src/features/schema-graph/store.ts` | Monolithic store mixing connection, canvas, filter, settings |
| `createdAt` ternary has identical branches | `src/App.tsx` lines 178-180 | Original creation timestamp always overwritten on re-save |
| `generateProcedureDefinition` emits literal `-- TODO: implement` | `src/features/canvas/utils/sql-definition.ts` line 1378 | User-visible placeholder in generated SQL |

### Medium Priority

| Issue | Location | Impact |
|-------|----------|--------|
| Connection history documented but not implemented | `CLAUDE.md` references `connection-service.ts` "last 10 saved" | Feature referenced in docs doesn't exist in code |
| Deprecated `navigator.platform` for Mac detection | `src/features/connection/components/home-screen.tsx` line 22 | Browser deprecation warning, unreliable detection |
| `HashMap::into_values().collect()` produces non-deterministic ordering | `src-tauri/src/db/schema_loader.rs` lines 118, 169, 373, 421 | Node order varies between loads |
| Dual debounce in search | `search-bar.tsx` has own `debounceTimerRef`, store tracks separate `debouncedSearchFilter` | Redundant debounce logic, potential timing inconsistency |

## Known Bugs

| Bug | Location | Severity |
|-----|----------|----------|
| `trustServerCertificate` defaults to `true` silently | `connection-modal.tsx` line 56, `import-from-database-dialog.tsx` line 140 | Medium — every new connection trusts any certificate without user awareness |

## Security Concerns

| Concern | Location | Risk |
|---------|----------|------|
| Password held in JS heap for full session | `store.ts` lines 70, 748, 786, 842 — `ServerConnectionParams` in Zustand | Low — not persisted to disk, but accessible via devtools/memory dump |
| No input length bounds on regex against `OBJECT_DEFINITION()` SQL text | `src-tauri/src/db/schema_loader.rs` lines 424-436 | Low — input comes from trusted SQL Server, not user |
| `.expect()` panics on startup if OS fails to provide app data directory | `src-tauri/src/lib.rs` line 26 | Low — rare but crashes app instead of showing error |

## Performance Concerns

| Concern | Location | Impact |
|---------|----------|--------|
| Full dagre layout recalculates synchronously on every filter change | `schema-graph.tsx` | UI freezes on large schemas during filter toggle |
| 6 sequential SQL queries, all rows fetched into memory | `src-tauri/src/db/queries.rs` | Large databases produce ~10MB IPC payloads |
| React Flow degrades around 500+ nodes | `schema-graph.tsx` | Large schemas with all object types visible will lag |

## Fragile Areas

| Area | Location | Why |
|------|----------|-----|
| SQL table reference extraction via regex | `src-tauri/src/db/schema_loader.rs` lines 439-484 | Misses CTEs, multi-part names, bracketed identifiers |
| Node dimensions from DOM `ResizeObserver` | `schema-graph.tsx` | Layout jumps on first render while dimension maps are unpopulated |
| Canvas dirty state | Canvas feature | No autosave, no crash recovery, no `beforeunload` protection |
| Type sync between Rust and TypeScript | `src-tauri/src/types/schema.rs` ↔ `src/features/schema-graph/types.ts` | Manual sync — drift causes silent runtime failures |

## Scaling Limits

| Limit | Threshold | Mitigation |
|-------|-----------|------------|
| React Flow node count | ~500 nodes | Filter by object type, use focus mode |
| IPC payload size | ~10MB for large schemas | None — full schema loaded in single call |
| Schema load time | Grows linearly with table/view count | Sequential queries, no pagination |

## Test Coverage Gaps

- `schema-graph.tsx` (2418 lines) — zero test coverage
- `App.tsx` (434 lines) — zero test coverage
- Rust backend — no unit tests in `src-tauri/src/`
- Canvas CRUD store actions — not covered in `store.test.ts`
- No coverage threshold configured
- No CI test gate in GitHub Actions
