# Monocle

![Monocle](boxlogo.png)

A desktop application for visualizing SQL Server database schemas. Connect to any SQL Server database and explore tables, views, relationships, triggers, stored procedures, and functions in an interactive graph.

## Features

### Schema Visualization
- Interactive graph with pan, zoom, and minimap navigation
- Automatic dagre layout for optimal positioning
- Custom nodes for tables, views, triggers, stored procedures, and scalar functions
- Performance-optimized rendering for large schemas
- Foreign key relationships displayed as colored edges
- Edge color customization in settings

### Search & Filter
- Fuzzy search across all schema objects
- Filter by object type (tables, views, triggers, procedures, functions)
- Filter by schema name
- Real-time filter counts in toolbar

### Focus Mode
- Highlight a table and all its related objects
- Configurable expansion threshold for related objects
- Isolate complex relationships for clarity

### Object Details
- Detail popover with full SQL definitions
- Syntax-highlighted code blocks
- Column information with data types and constraints
- Foreign key relationship details

### Export Options
- Export schema as PNG image
- Export schema as PDF document
- Export schema data as JSON

### Connectivity
- Windows Authentication support
- SQL Server Authentication support
- Saved connection settings (server, auth type) across sessions
- Multiple database selection per server
- Auto-update notifications for new versions

### Themes
- Light and dark mode support
- System theme detection
- Persistent theme preference

## Getting Started

### Prerequisites

- Node.js 18+
- Rust (install via [rustup](https://rustup.rs/))

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
| Database | Tiberius (SQL Server TDS) |
| Frontend | React 19 + TypeScript |
| Graph Visualization | React Flow |
| State Management | Zustand |
| Styling | Tailwind CSS + Shadcn/ui |

## IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
