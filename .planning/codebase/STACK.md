# Technology Stack

**Analysis Date:** 2026-05-22

## Languages

**Primary:**
- TypeScript 5.8.3 - Frontend (React UI, services, hooks, store)
- Rust 1.91 (2021 edition) - Backend (Tauri commands, database queries, state)

**Secondary:**
- CSS (Tailwind CSS v4) - Styling

## Runtime

**Environment:**
- Node.js 24.x (detected v24.11.0) - Frontend development and build
- Rust/Cargo 1.91.1 - Backend compilation

**Package Manager:**
- npm - Frontend dependencies
- Lockfile: `package-lock.json` present (lockfileVersion 3)
- Cargo - Rust dependencies
- Lockfile: `src-tauri/Cargo.lock` present

## Frameworks

**Core:**
- React 19.1.0 - UI framework (`src/`)
- Tauri 2.x - Desktop app shell (`src-tauri/`)
- React Flow (`@xyflow/react`) 12.10.0 - Interactive graph canvas (`src/features/schema-graph/`)

**State Management:**
- Zustand 5.0.9 - Frontend state (`src/features/schema-graph/store.ts`, `src/features/notifications/store.ts`)

**UI Components:**
- shadcn/ui (new-york style) - Component library (`src/components/ui/`)
- Radix UI primitives - Checkbox, Dialog, DropdownMenu, Label, Popover, ScrollArea, Select, Separator, Slot, Tooltip
- Lucide React 0.555.0 - Icons

**Styling:**
- Tailwind CSS 4.1.17 - Utility-first CSS (`tailwind.config.js`, `postcss.config.js`)
- `tailwind-merge` 3.4.0 + `class-variance-authority` 0.7.1 + `clsx` 2.1.1 - Class utilities
- `tailwindcss-animate` 1.0.7 - Animation utilities

**Code Editor:**
- Monaco Editor 0.55.1 + `@monaco-editor/react` 4.7.0 - SQL syntax highlighting and intellisense (`src/lib/monaco-sql-loader.ts`, `src/lib/sql-intellisense.ts`)

**Testing:**
- Vitest 2.1.2 - Test runner (`vitest.config.ts`)

**Build/Dev:**
- Vite 7.0.4 - Frontend bundler and dev server (`vite.config.ts`)
- `@vitejs/plugin-react` 4.6.0 - React plugin for Vite

**Async Runtime (Rust):**
- Tokio 1.x - Async runtime with `sync`, `macros`, `rt-multi-thread`, `time`, `net` features

## Key Dependencies

**Critical:**
- `tiberius` 0.12 (Rust) - SQL Server TDS protocol client; no external driver required (`src-tauri/src/db/connection.rs`)
- `tokio-util` 0.7 with `compat` - Required to bridge Tokio TCP streams with tiberius (`src-tauri/src/db/connection.rs`)
- `@tauri-apps/api` 2.9.1 - Core Tauri IPC bridge (`src/services/tauri.ts`)
- `@xyflow/react` 12.10.0 - Graph visualization engine (`src/features/schema-graph/`)

**Export:**
- `html-to-image` 1.11.13 - PNG export from DOM (`src/features/export/utils/png-export.ts`)
- `jspdf` 4.0.0 - PDF generation (`src/features/export/utils/pdf-export.ts`)

**Tauri Plugins (Frontend + Rust):**
- `@tauri-apps/plugin-dialog` 2.6.0 / `tauri-plugin-dialog` 2 - Native save/open dialogs
- `@tauri-apps/plugin-fs` 2.4.5 / `tauri-plugin-fs` 2 - File system write access
- `@tauri-apps/plugin-opener` 2 / `tauri-plugin-opener` 2 - Open URLs/files
- `@tauri-apps/plugin-process` 2.3.1 / `tauri-plugin-process` 2 - App restart/exit
- `@tauri-apps/plugin-updater` 2.9.0 / `tauri-plugin-updater` 2 - Auto-update mechanism

**Rust Utilities:**
- `serde` 1 + `serde_json` 1 - JSON serialization for Tauri IPC
- `thiserror` 1 - Ergonomic error types (`src-tauri/src/db/connection.rs`, `src-tauri/src/db/ssrp.rs`)
- `regex` 1 - String matching in queries
- `once_cell` 1 - Lazy statics
- `chrono` 0.4 with `serde` feature - Date/time handling
- `futures-util` 0.3 - Async stream utilities

**Search/Utility:**
- `cmdk` 1.1.1 - Command palette component
- `react-markdown` 10.1.0 + `remark-gfm` 4.0.1 - Markdown rendering
- `react-icons` 5.5.0 - Additional icon set

## Configuration

**Environment:**
- No `.env` files required at runtime (no external API keys needed)
- Build-time only: `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (GitHub Actions secrets for release signing)
- Vite dev server runs on port 1420 (fixed, `strictPort: true`)

**Build:**
- `tsconfig.json` - TypeScript compiler config (strict mode, `@/*` path alias)
- `tsconfig.node.json` - TypeScript config for Vite config files
- `vite.config.ts` - Frontend bundler configuration
- `vitest.config.ts` - Test runner configuration
- `eslint.config.js` - Linting (ESLint 9 flat config + typescript-eslint)
- `.prettierrc` - Code formatting (semi: true, singleQuote: false, tabWidth: 2, trailingComma: es5, printWidth: 80)
- `tailwind.config.js` - Tailwind CSS content paths
- `postcss.config.js` - PostCSS with Tailwind plugin
- `components.json` - shadcn/ui configuration (new-york style, neutral base color)
- `src-tauri/tauri.conf.json` - Tauri app configuration (version source of truth)
- `src-tauri/Cargo.toml` - Rust crate manifest

**Path Aliases:**
- `@/*` maps to `./src/*` (both `tsconfig.json` and `vite.config.ts`/`vitest.config.ts`)

## Platform Requirements

**Development:**
- Rust toolchain (stable, 1.91+)
- Node.js (LTS, 24.x detected)
- npm

**Production:**
- macOS 10.13+ (ARM64 and x86_64 builds via `.dmg` and `.tar.gz`)
- Windows x86_64 (NSIS installer `.exe` and MSI `.msi`)
- Targets defined in `src-tauri/tauri.conf.json` bundle section

---

*Stack analysis: 2026-05-22*
