# Relova

A desktop application for visualizing SQL Server database schemas. Connect to any SQL Server database and explore tables, views, relationships, triggers, stored procedures, and functions in an interactive graph.

## Features

- Interactive schema visualization with pan, zoom, and minimap
- Custom nodes for tables, views, triggers, stored procedures, and scalar functions
- Foreign key relationships displayed as edges
- Search and filter by object name, schema, or type
- Focus mode to highlight a table and its related objects
- Detail modal with SQL definitions and syntax highlighting
- Dark/light theme support
- Edge color customization

## Getting Started

### Prerequisites

- Node.js 18+
- Rust (install via [rustup](https://rustup.rs/))
- [ODBC Driver 18 for SQL Server](https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server)

### Installation

```bash
# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build for production
npm run tauri build
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop Framework | Tauri 2.0 |
| Backend | Rust |
| Database | ODBC API (SQL Server) |
| Frontend | React 19 + TypeScript |
| Graph Visualization | React Flow |
| State Management | Zustand |
| Styling | Tailwind CSS + Shadcn/ui |

## IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
