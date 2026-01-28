# Monocle

<div>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1500 500" xmlns:bx="https://boxy-svg.com">
  <rect width="1500" height="500" style="stroke-width: 0; stroke: rgb(78, 194, 255); fill-rule: nonzero; fill: rgb(10, 135, 84);" ry="0" rx="0"/>
  <g transform="matrix(0.772766, 0, 0, 0.772766, 13.243204, 62.31638)" style="">
    <g>
      <path style="fill: none; stroke-width: 15; transform-origin: 277.078px 186.547px; stroke: rgb(255, 255, 255);" d="M 190.479 130.633 L 363.669 242.457" transform="matrix(-1, 0, 0, -1, -0.000027, 0.00001)"/>
      <path style="fill: none; stroke-width: 15; transform-origin: 315.891px 331.709px; stroke: rgb(255, 255, 255);" d="M 266.174 428.077 L 365.603 235.34"/>
      <path style="fill: none; stroke-width: 15; transform-origin: 339.918px 398.182px; stroke: rgb(255, 255, 255);" d="M 262.125 424.483 L 417.704 371.881"/>
      <path style="fill: none; stroke-width: 15px; transform-box: fill-box; transform-origin: 50% 50%; stroke: rgb(255, 255, 255);" d="M 361.648 239.273 L 416.538 380.261" transform="matrix(-1, 0, 0, -1, 0.000013, -0.000032)"/>
    </g>
    <g transform="matrix(1, 0, 0, 1, 12.608, -13.388)">
      <ellipse style="fill: rgba(216, 216, 216, 0); stroke-width: 42px; stroke: rgb(8, 135, 85);" cx="179.625" cy="145.696" rx="100" ry="100"/>
      <ellipse style="stroke-width: 30px; stroke: rgb(255, 255, 255); fill: rgb(8, 135, 85);" cx="179.625" cy="145.696" rx="100" ry="100"/>
    </g>
    <g>
      <ellipse style="fill: rgb(255, 255, 255); stroke-width: 25px; stroke: rgb(8, 135, 85);" cx="413.505" cy="371.368" rx="30" ry="30"/>
      <ellipse style="stroke-width: 15px; stroke: rgb(255, 255, 255); fill: rgb(8, 135, 85);" cx="413.505" cy="371.368" rx="30" ry="30"/>
    </g>
    <g>
      <ellipse style="fill: rgb(255, 255, 255); paint-order: fill; stroke-width: 25px; stroke: rgb(8, 135, 85);" cx="362.453" cy="240.748" rx="30" ry="30"/>
      <ellipse style="stroke-width: 15px; paint-order: fill; stroke: rgb(255, 255, 255); fill: rgb(8, 135, 85);" cx="362.453" cy="240.748" rx="30" ry="30"/>
    </g>
    <g>
      <ellipse style="fill: rgba(216, 216, 216, 0); stroke-width: 25px; stroke: rgb(8, 135, 85);" cx="267.236" cy="423.437" rx="30" ry="30"/>
      <ellipse style="stroke-width: 15px; stroke: rgb(255, 255, 255); fill: rgb(8, 135, 85);" cx="267.236" cy="423.437" rx="30" ry="30"/>
    </g>
  </g>
  <text style="fill: rgb(255, 255, 255); font-family: &quot;JetBrains Mono&quot;; font-size: 250px; white-space: pre;" x="400" y="340.179">Monocle</text>
  <defs>
    <style bx:fonts="JetBrains Mono">@import url(https://fonts.googleapis.com/css2?family=JetBrains+Mono%3Aital%2Cwght%400%2C100..800%3B1%2C100..800&amp;display=swap);</style>
  </defs>
</svg>
</div><br/>
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
