# Plan: Tauri SQL Server Schema Visualizer App

This is a complete implementation plan for building a Tauri desktop app that visualizes a SQL Server database schema, similar to Supabase’s visualizer UI.

Claude: Implement each phase sequentially. Ensure the project remains buildable after every change.

---

## Goal

A tool that:
- Connects to SQL Server
- Loads tables, columns, primary keys, and foreign keys
- Renders a visual relationship graph
- Allows zooming, searching, filtering, table focusing

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop Application | Tauri |
| UI | React + TypeScript |
| Graph Visualization | React Flow |
| Backend | Rust |
| SQL Server Connection | ODBC API (initially) |

---

## Project Structure

```
src-tauri/
  src/
    main.rs
    commands/
    db/
src/
  App.tsx
  main.tsx
  components/
  types/
```

---

## Phase 1 — Initialize Project

- Create new Tauri project with React + TS template
- Display placeholder UI confirming frontend ↔ backend communication
- Ensure hot reload works

---

## Phase 2 — Define Shared SchemaGraph Types

Create TypeScript types:
```ts
export type Column = {
  name: string;
  type: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
};

export type TableNode = {
  id: string; // “schema.table”
  name: string;
  schema: string;
  columns: Column[];
};

export type RelationshipEdge = {
  id: string;
  from: string;
  to: string;
  fromColumn: string;
  toColumn: string;
};

export type SchemaGraph = {
  tables: TableNode[];
  relationships: RelationshipEdge[];
};
```

Mirror types in Rust with `serde::{Serialize, Deserialize}`.

✔ Output: JSON-safe data model

---

## Phase 3 — Mock Backend Command

Implement a Tauri command:
- `load_schema_mock() -> SchemaGraph`
- Hardcode:
  - Tables: `dbo.Customers`, `dbo.Orders`
  - One FK: `Orders.CustomerId → Customers.Id`

Frontend:
- Add button: Load Schema
- Log returned mock data

✔ Output: Verified backend command + frontend call

---

## Phase 4 — Visual Graph Rendering

Using React Flow:
- Convert `SchemaGraph` → `FlowNode[]` + `FlowEdge[]`
- Support:
  - Pan
  - Zoom
  - Fit to screen

Render mock data initially.

✔ Output: Visual relationship graph

---

## Phase 5 — Custom Table Nodes

Create custom React Flow node component:
- Header: `schema.table`
- Body: column list
- Highlight PK columns visually

✔ Output: Clean table node UIs similar to Supabase

---

## Phase 6 — SQL Server Integration

Backend: Use ODBC API crate.

Create function:
`load_schema_graph(connection_string: &str) -> Result<SchemaGraph, DbError>`

Two SQL queries:

**A. Tables + Columns**
```sql
SELECT
    s.name AS schema_name,
    t.name AS table_name,
    c.name AS column_name,
    ty.name AS data_type,
    c.is_nullable,
    CASE WHEN pk.column_id IS NOT NULL THEN 1 ELSE 0 END AS is_primary_key
FROM sys.tables t
JOIN sys.schemas s ON t.schema_id = s.schema_id
JOIN sys.columns c ON t.object_id = c.object_id
JOIN sys.types ty ON c.user_type_id = ty.user_type_id
LEFT JOIN (
    SELECT ic.object_id, ic.column_id
    FROM sys.indexes i
    JOIN sys.index_columns ic
      ON i.object_id = ic.object_id AND i.index_id = ic.index_id
    WHERE i.is_primary_key = 1
) pk ON pk.object_id = c.object_id AND pk.column_id = c.column_id
WHERE t.is_ms_shipped = 0
ORDER BY s.name, t.name, c.column_id;
```

**B. Foreign Keys**
```sql
SELECT
    fk.name AS fk_name,
    sch_src.name AS src_schema,
    t_src.name AS src_table,
    c_src.name AS src_column,
    sch_ref.name AS ref_schema,
    t_ref.name AS ref_table,
    c_ref.name AS ref_column
FROM sys.foreign_keys fk
JOIN sys.foreign_key_columns fkc
  ON fk.object_id = fkc.constraint_object_id
JOIN sys.tables t_src
  ON fkc.parent_object_id = t_src.object_id
JOIN sys.schemas sch_src
  ON t_src.schema_id = sch_src.schema_id
JOIN sys.columns c_src
  ON fkc.parent_object_id = c_src.object_id
 AND fkc.parent_column_id = c_src.column_id
JOIN sys.tables t_ref
  ON fkc.referenced_object_id = t_ref.object_id
JOIN sys.schemas sch_ref
  ON t_ref.schema_id = sch_ref.schema_id
JOIN sys.columns c_ref
  ON fkc.referenced_object_id = c_ref.object_id
 AND fkc.referenced_column_id = c_ref.column_id;
```

✔ Output: Real schema loaded visually

---

## Phase 7 — Connection UI

Add a database connection form:
- Input: connection string
- Button: “Connect & Load Schema”
- Loading indicator + error messages

✔ Output: User can choose database at runtime

---

## Phase 8 — Filters + Search + Focus Mode

- Search box (filter table nodes by name)
- Dropdown filter by schema
- Focus mode:
  - Highlight a table + immediate neighbors
  - Dim all others

✔ Output: Better navigation for large DBs

---

## Phase 9 — Packaging & Windows Build

- Configure Tauri for bundling release EXE
- Ensure runtime prerequisites documented (e.g., ODBC driver)

✔ Output: Installable Windows binary

---

## Phase 10 — Optional Enhancements

- Export diagram (PNG/SVG)
- Show:
  - Views
  - Triggers
  - Index badges
- Persist recent connections (encrypted or obfuscated)
- Dagre auto-layout for tidy organization
- CLI export support (headless Rust mode)

---

## Implementation Checklist

- [ ] Phase 1 — Init Project
- [ ] Phase 2 — SchemaGraph shared types
- [ ] Phase 3 — Mock load command
- [ ] Phase 4 — Graph rendering with mock data
- [ ] Phase 5 — Custom styled nodes
- [ ] Phase 6 — SQL Server ODBC integration
- [ ] Phase 7 — UX for connecting DB
- [ ] Phase 8 — Filters & focusing
- [ ] Phase 9 — Build release version
- [ ] Phase 10 — Optionals for power users

---

## General Guidelines

- Small incremental commits
- Separate database logic from UI rendering
- Do not block UI — use async commands
- Maintain type safety Rust → TS
- Keep metadata queries read-only

---

**End of Plan**
