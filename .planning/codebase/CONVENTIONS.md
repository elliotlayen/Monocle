# Coding Conventions

**Analysis Date:** 2026-05-22

## Naming Patterns

**Files:**
- React components: `kebab-case.tsx` (e.g., `schema-graph.tsx`, `table-node.tsx`, `home-screen.tsx`)
- Hooks: `kebab-case.ts` with `use-` prefix for multi-word (e.g., `use-resolved-theme.ts`, `use-detail-popover.ts`); single-word hooks may use camelCase (`useFilteredCounts.ts`, `useExport.ts`)
- Services: `kebab-case-service.ts` (e.g., `schema-service.ts`, `settings-service.ts`, `connection-service.ts`)
- Stores: `store.ts` per feature (e.g., `src/features/schema-graph/store.ts`, `src/features/notifications/store.ts`)
- Types: `types.ts` per feature (e.g., `src/features/schema-graph/types.ts`, `src/features/toolbar/types.ts`)
- Test files: co-located with implementation, same name + `.test.ts` or `.test.tsx`
- Utilities: `kebab-case.ts` (e.g., `object-filtering.ts`, `sql-definition.ts`, `formatting.ts`)

**Functions:**
- React components: PascalCase named exports (e.g., `export function HomeScreen(...)`, `export function SchemaGraph(...)`)
- Hooks: camelCase with `use` prefix (e.g., `useFilteredCounts`, `useDetailPopover`, `useExport`)
- Service objects: camelCase singleton objects with method properties (e.g., `settingsService.getSettings()`, `schemaService.loadSchema()`)
- Utility functions: camelCase named exports (e.g., `formatBytes`, `truncate`, `formatIdentifier`, `buildSchemaIndex`)
- Store actions: camelCase (e.g., `loadSchema`, `connectToServer`, `setFocusedTable`, `clearFocus`)

**Variables:**
- Regular variables: camelCase throughout
- Constants: camelCase or UPPER_SNAKE_CASE for module-level numeric/string constants (e.g., `MIN_COLUMNS`, `MAX_COLUMNS`, `ROUTINE_MIN_WIDTH`)
- Type-level constants: camelCase arrays (e.g., `ALL_EDGE_TYPES`, `ALL_OBJECT_TYPES`)

**Types:**
- Interfaces: PascalCase (e.g., `SchemaGraph`, `TableNode`, `ConnectionParams`, `FilteredCounts`)
- Type aliases: PascalCase (e.g., `ObjectType`, `EdgeType`, `AuthType`, `EdgeLabelMode`)
- Union string literals: camelCase values (e.g., `"sqlServer" | "windows"`, `"auto" | "never" | "always"`)
- Type imports: `import type { ... }` used consistently for type-only imports

**Rust:**
- Structs: PascalCase (e.g., `SchemaGraph`, `TableNode`, `ConnectionError`)
- Functions: snake_case (e.g., `load_schema`, `create_client`, `parse_server`)
- All public struct fields: snake_case with `#[serde(rename_all = "camelCase")]` to match frontend
- Error enums: PascalCase with `thiserror::Error` derive (e.g., `ConnectionError`, `SchemaError`)

## Code Style

**Formatting:**
- Tool: Prettier 3.x (`prettier --write .`)
- Config: no `.prettierrc` file detected — Prettier defaults apply
- Check command: `npm run format:check`
- Write command: `npm run format`

**Linting:**
- Tool: ESLint 9.x with flat config at `eslint.config.js`
- Extends: `@eslint/js` recommended + `typescript-eslint` recommended + `eslint-config-prettier`
- Key rule: `@typescript-eslint/no-unused-vars: ["error", { argsIgnorePattern: "^_" }]`
- Unused parameters prefixed with `_` to suppress lint errors
- TypeScript target: `~5.8.3`

## Import Organization

**Order (observed pattern):**
1. External library imports (React hooks, third-party packages: `zustand`, `@xyflow/react`, `lucide-react`)
2. Internal absolute imports using `@/` alias (e.g., `@/features/...`, `@/services/...`, `@/lib/...`, `@/components/...`)
3. Relative imports (e.g., `./store`, `./services/schema-service`, `../types`)

**Path Aliases:**
- `@/` resolves to `./src/` (configured in `vite.config.ts` and `vitest.config.ts`)
- Use `@/` for cross-feature imports; use relative paths only for within-feature imports

**Type Imports:**
- Use `import type { ... }` for type-only imports throughout (enforced by TypeScript strict mode)
- Example: `import type { SchemaGraph } from "@/features/schema-graph/types"`

## Error Handling

**Frontend Store Pattern:**
```typescript
// All async store actions follow this pattern
set({ isLoading: true, error: null });
try {
  const result = await someService.doWork(params);
  set({ data: result, isLoading: false });
  return true;
} catch (err) {
  set({ error: String(err), isLoading: false });
  return false;
}
```

**Tauri IPC Wrapper:**
- All Tauri invocations go through `src/services/tauri.ts` which catches and logs errors then re-throws
- Services wrap `tauri.*` calls and let errors propagate to the store's catch blocks
- `console.error()` used at the IPC boundary for diagnostics

**Fire-and-forget Settings Saves:**
```typescript
// Settings saves are non-critical — errors silently ignored
settingsService.saveSettings({ schemaFilter: schema }).catch(() => {
  // non-critical
});
```

**Rust Error Handling:**
- Custom error enums with `thiserror::Error` derive for typed errors
- `Result<T, E>` return types throughout `db/` and `commands/`
- Tauri commands return `Result<T, SchemaError>` — the error is serialized to the frontend as a string

## Logging

**Framework:** `console` (no logging library)

**Patterns:**
- `console.error()` used at the Tauri IPC boundary in `src/services/tauri.ts` and for non-fatal async failures
- No `console.log()` or `console.warn()` in production paths — logging is minimal and error-only
- Rust errors surface as thrown exceptions in the frontend (stringified via `String(err)`)

## Comments

**When to Comment:**
- Interface fields are documented inline with `//` comments explaining format (e.g., `// Format: "schema.table"`)
- Complex business logic gets brief explanatory comments (e.g., `// Reset filters on new connection`)
- Rust test helpers use `///` doc comments sparingly

**JSDoc/TSDoc:**
- Not used — the codebase relies on TypeScript types for self-documentation

## Function Design

**Size:** Large components (`schema-graph.tsx` at 2,418 lines, `store.ts` at 2,181 lines) exist but utility modules are kept focused and small
**Parameters:** Prefer named object parameters for complex inputs (e.g., `getFilteredObjectBuckets({ schema, searchFilter, schemaFilter, ... })`)
**Return Values:** Async store actions return `Promise<boolean>` to signal success/failure to the caller

## Module Design

**Exports:**
- Components: named exports only — no default exports
- Services: named singleton objects (e.g., `export const settingsService = { ... }`)
- Stores: named hook export (`export const useSchemaStore = create<...>(...)`)
- Types: all exported from `types.ts` per feature

**Barrel Files:**
- Used selectively: `src/features/export/index.ts` re-exports the entire export feature
- Most features do NOT use barrel files — components/hooks/services are imported directly

## Component Architecture

**Strict layering enforced:**
- Components are presentational only: props in, UI out, no direct Tauri IPC
- Hooks own state and side effects
- Services contain all Tauri IPC via `src/services/tauri.ts`
- Store (`src/features/schema-graph/store.ts`) manages all schema and connection state via Zustand

**UI Components:**
- All UI primitives come from shadcn/ui at `src/components/ui/`
- Tailwind CSS classes via `cn()` helper from `src/lib/utils.ts`

**No emojis:** Emojis are banned in code, comments, commits, and documentation.

---

*Convention analysis: 2026-05-22*
