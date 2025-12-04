# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Relova is a Tauri desktop application for visualizing SQL Server database schemas. It connects to SQL Server via ODBC, loads table/column/foreign key metadata, and renders an interactive relationship graph similar to Supabase's schema visualizer.

## Common Commands

```bash
# Development (runs Vite dev server + Tauri)
npm run tauri dev

# Build for production
npm run tauri build

# Frontend only (no Tauri)
npm run dev

# Type check and build frontend
npm run build

```

Note: Always lint, test, and typecheck updated files. Use project-wide build sparingly.

## Architecture

### Frontend (React + TypeScript)

- `src/App.tsx` - Root component, conditionally shows ConnectionForm or SchemaGraphView
- `src/stores/schemaStore.ts` - Zustand store managing schema state, filters, and Tauri command invocations
- `src/types/schema.ts` - Shared type definitions (SchemaGraph, TableNode, Column, RelationshipEdge)
- `src/components/schema-graph/` - React Flow visualization components
  - `schema-graph.tsx` - Main graph view with filtering/focus logic
  - `table-node.tsx` - Custom node rendering tables with columns
- `src/components/connection-form.tsx` - Database connection UI
- `src/components/toolbar.tsx` - Search, schema filter, and focus controls

### Backend (Rust + Tauri)

- `src-tauri/src/lib.rs` - Tauri app setup, registers commands
- `src-tauri/src/commands/` - Tauri command handlers
  - `schema.rs` - `load_schema` command (real database)
  - `mock.rs` - `load_schema_mock` command (test data)
- `src-tauri/src/db/` - Database interaction layer
  - `connection.rs` - ODBC connection management, connection string building
  - `queries.rs` - SQL queries for tables/columns and foreign keys
  - `schema_loader.rs` - Parses ODBC results into SchemaGraph
- `src-tauri/src/types/` - Rust type definitions mirroring frontend types

### Key Data Flow

1. Frontend calls `invoke<SchemaGraph>("load_schema", { params })` via Tauri
2. Rust builds ODBC connection string, executes SQL Server metadata queries
3. Results parsed into `SchemaGraph` struct, serialized to JSON
4. Frontend receives data, stores in Zustand, converts to React Flow nodes/edges

## Type Consistency

TypeScript types in `src/types/schema.ts` must stay in sync with Rust types in `src-tauri/src/types/schema.rs`. Both use camelCase field names (Rust uses `#[serde(rename_all = "camelCase")]`).

## Prerequisites

- ODBC Driver 17+ for SQL Server must be installed on the system
- Rust toolchain for Tauri backend
- Node.js for frontend

## Code Style

- **No emojis**: Do not use emojis anywhere in code, comments, commits, or documentation
- **Commit messages**: Do not include "Generated with Claude Code" or "Co-Authored-By" lines
- **Components**: Use shadcn/ui for UI components
