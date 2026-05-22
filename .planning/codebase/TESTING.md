# Testing

> Last mapped: 2026-05-22

## Framework

- **Test runner:** Vitest
- **Environment:** Node (not jsdom)
- **Config:** `vitest.config.ts` at project root
- **Path alias:** `@/` maps to `./src/`
- **Mocking:** `vi.fn()`, `vi.mock()` (Vitest built-in)
- **Run command:** `npm run test`

## Test File Conventions

- Co-located with source: `*.test.ts` / `*.test.tsx` next to the file under test
- No dedicated `__tests__/` directories
- No Rust-side tests found in `src-tauri/`

## Test Files (18 files)

### Schema Graph (10 files)
| File | Lines | Focus |
|------|-------|-------|
| `src/features/schema-graph/store.test.ts` | 497 | Store actions, state transitions (17 tests) |
| `src/features/schema-graph/utils/object-filtering.test.ts` | 225 | Filter logic for schema objects |
| `src/features/schema-graph/components/edge-visibility.test.ts` | 68 | Edge show/hide logic |
| `src/features/schema-graph/components/edge-state.test.ts` | — | Edge state transitions |
| `src/features/schema-graph/components/edge-hover-card.test.ts` | — | Hover card behavior |
| `src/features/schema-graph/components/focus-transition.test.ts` | — | Focus mode transitions |
| `src/features/schema-graph/components/node-width.test.ts` | — | Node width calculations |
| `src/features/schema-graph/components/node-render-update.test.ts` | — | Render diff optimization |
| `src/features/schema-graph/components/zoom-band.test.ts` | 32 | Zoom band thresholds |
| `src/features/schema-graph/components/layout.test.ts` | — | Layout calculations |
| `src/features/schema-graph/hooks/useFilteredCounts.test.tsx` | — | Filter count hook |

### Canvas (2 files)
| File | Lines | Focus |
|------|-------|-------|
| `src/features/canvas/utils/sql-definition.test.ts` | 184 | SQL DDL generation |
| `src/features/canvas/components/import-from-database-dialog.test.ts` | — | Import dialog logic |

### Services (2 files)
| File | Lines | Focus |
|------|-------|-------|
| `src/features/connection/services/connection-settings.test.ts` | 89 | localStorage persistence |
| `src/features/settings/services/settings-service.test.ts` | 25 | Settings service |

### Toolbar (1 file)
| File | Lines | Focus |
|------|-------|-------|
| `src/features/toolbar/components/toolbar-objects-filter.test.ts` | — | Object type filter logic |

### Library (2 files)
| File | Lines | Focus |
|------|-------|-------|
| `src/lib/schema-index.test.ts` | 55 | Schema search index |
| `src/lib/sql-intellisense.test.ts` | — | SQL autocomplete |

## Mocking Patterns

- **Tauri IPC:** Mocked via `vi.mock()` on `@tauri-apps/api` — tests don't call real Tauri commands
- **localStorage:** Mocked for connection-settings tests
- **No database mocking:** No integration tests against real SQL Server
- **Store tests:** Direct state manipulation via Zustand store actions

## Coverage Gaps

- **`schema-graph.tsx`** (2418 lines) — zero test coverage, largest component
- **`App.tsx`** (434 lines) — zero test coverage, root component
- **`store.ts`** canvas CRUD actions (`addTable`, `updateTable`, `addRelationship`) — not covered
- **Rust backend** — no unit tests in `src-tauri/src/`
- **No coverage threshold** configured in `vitest.config.ts`
- **No CI test gate** — tests not enforced in GitHub Actions workflow

## Test Running

```bash
npm run test          # Run all tests
npx vitest run        # Single run (no watch)
npx vitest <pattern>  # Run matching tests
```
