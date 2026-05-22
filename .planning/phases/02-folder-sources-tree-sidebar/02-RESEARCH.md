# Phase 2: Folder Sources & Tree Sidebar - Research

**Researched:** 2026-05-22
**Domain:** Tauri 2 desktop app -- Rust filesystem I/O, React tree sidebar, settings persistence, drag-and-drop reorder
**Confidence:** HIGH

## Summary

Phase 2 adds two major capabilities: (1) a settings section for managing folder source configurations (CRUD, drag-to-reorder, persistence), and (2) a lazy-loading tree sidebar for navigating the Client > Date > File hierarchy on network shares. The implementation spans both the Rust backend (new filesystem listing commands with timeout/cancel) and the React frontend (tree component, settings UI, Zustand store).

The primary architectural decision is to build a **custom tree component** rather than adopting react-arborist. The existing codebase already has a custom tree sidebar (`schema-browser-sidebar.tsx`) that demonstrates the exact patterns needed (expand/collapse, search filter, icon-per-type, scroll area). React-arborist pulls in `react-dnd`, `react-dnd-html5-backend`, `react-window`, and `redux` as dependencies -- a heavy chain for a project that already has its own tree pattern. The custom approach keeps the dependency footprint minimal and gives full control over the async loading/cancel/timeout UX specified in the CONTEXT decisions.

**Primary recommendation:** Build the tree sidebar as a custom component following the `schema-browser-sidebar.tsx` pattern, using `@tanstack/react-virtual` for virtual scrolling only if directories exceed ~500 entries (defer to phase implementation testing). Use `@dnd-kit/core` + `@dnd-kit/sortable` for the settings drag-to-reorder feature. Use `spawn_blocking` + `tokio::time::timeout` + `CancellationToken` for the Rust directory listing command.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Folder sources are configured in a dedicated "Folder Sources" section of the existing settings sheet. No inline sidebar controls for source CRUD.
- **D-02:** Each source has three fields: path (string), label (display name), and tag (freeform text, e.g., "Inbound", "Outbound", "Test Data").
- **D-03:** Adding a source uses a text input for path entry (supports UNC paths like `\\server\share`) with an optional native Browse button (via tauri-plugin-dialog) for local paths.
- **D-04:** On save, the app validates path reachability. If unreachable, save succeeds but a yellow warning is shown ("Path unreachable -- check VPN connection"). Does not block saving.
- **D-05:** Sources support drag-to-reorder in the settings sheet. Display order in the sidebar matches the user's configured order.
- **D-06:** No limit on the number of sources. Sidebar handles many sources with scrolling.
- **D-07:** Full edit capability -- users can change path, label, and tag on existing sources in-place.
- **D-08:** First-time experience: the Phase 1 empty state is updated to say "Add a folder source in Settings to get started" with the existing "Open Settings" button. No guided wizard.
- **D-09:** Tree hierarchy is flat roots. Each configured source is a root node. Expand source -> client folders. Expand client -> date folders. Expand date -> files. Three levels of nesting below the source.
- **D-10:** Nodes display name + child count badge. Counts are fetched on expand only (lazy) -- parent nodes show no count until expanded.
- **D-11:** Date folders are sorted with a user-togglable control: newest-first (default) or oldest-first. Sort preference is session-only, resets to newest-first on app restart.
- **D-12:** Loading indicator is a small spinner replacing the expand chevron while children load. Children appear below when ready.
- **D-13:** Clicking a file does nothing in Phase 2. File viewing is deferred to Phase 3. Content area keeps the getting-started empty state.
- **D-14:** All files are shown in date folders (not just XML). XML files are visually highlighted with distinct icon/styling compared to non-XML files.
- **D-15:** Sidebar follows Phase 1 decisions: resizable via drag handle (width persists), collapsible via toggle button matching schema-browser-sidebar pattern.
- **D-16:** Favorite clients appear in a "Favorites" pinned section at the top of each source's client list. Pinned clients also remain in their normal alphabetical position below.
- **D-17:** Users favorite a client via star icon on hover (quick toggle) AND right-click context menu entry (discoverability). Both paths available.
- **D-18:** Favorites persist in Rust AppSettings (settings.json), scoped per-source. Each source maintains its own favorites list.
- **D-19:** The pinned Favorites section only appears for sources that have favorites. No favorites = no section header.
- **D-20:** Client filter is a permanently visible filter bar above the tree (matching schema-browser-sidebar's search input pattern). Typing narrows the visible node list in real time.
- **D-21:** Filter matches against all visible (already-loaded) nodes -- client names, date folders, and filenames. Does not trigger new network fetches for unloaded nodes.
- **D-22:** Unreachable sources show as greyed-out with a warning icon and tooltip ("Unreachable -- check VPN connection"). User can try expanding to retry.
- **D-23:** Timeout for folder listing is 15 seconds. After 3 seconds, a cancel button appears alongside the spinner. Elapsed time is shown ("Loading... 8s").
- **D-24:** No caching -- every expand re-fetches the directory listing from the filesystem. Always fresh, simple implementation.
- **D-25:** Cancel actually aborts the directory read operation on the Rust side (drops the task). Node collapses back to unexpanded state.
- **D-26:** No automatic retries. After a failed load, user manually re-clicks the expand chevron to retry.
- **D-27:** No proactive network health checking. The app only reacts to failures when they occur during user-initiated operations.
- **D-28:** Load all children in one call (no pagination). Virtual scrolling handles rendering performance for directories with many entries.

### Claude's Discretion
- **D-29:** UNC path hang workaround -- researcher should investigate the best approach for handling `tokio::fs::read_dir` issues on Windows UNC paths (spawn_blocking + timeout vs dedicated std::fs thread pool vs other).

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BRWS-01 | User can configure multiple root folder sources (add, remove, edit paths) with settings persisted across sessions | Settings section architecture (D-01 through D-08), `AppSettings` struct extension, `@dnd-kit/sortable` for reorder |
| BRWS-02 | User can navigate a tree sidebar organized as Root > Client > Date > Files with lazy-loading on expand | Custom tree component, Rust `list_directory` command with `spawn_blocking` + timeout, Zustand store for tree state |
| BRWS-03 | Date folders display both raw format and human-readable date | `chrono` crate (already installed) for date parsing, formatting pattern `"20251223 (Dec 23, 2025)"` |
| BRWS-08 | User can filter the client list by typing and pin favorite clients to the top of the tree | Filter bar on already-loaded nodes (D-20/D-21), favorites persisted in AppSettings (D-18), `@radix-ui/react-context-menu` for right-click |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Directory listing (network shares) | Rust Backend | -- | Filesystem I/O must go through Tauri commands for security sandbox compliance; blocking I/O on network shares requires `spawn_blocking` with timeout/cancel |
| Path reachability validation | Rust Backend | -- | `std::fs::metadata` check on save, runs in blocking context |
| Folder source persistence | Rust Backend | Frontend (settings UI) | `AppSettings` struct owns the data; frontend reads/writes via IPC |
| Tree sidebar UI | Frontend (React) | -- | Presentational component with expand/collapse, filter, favorites -- all client-side state |
| Drag-to-reorder sources | Frontend (React) | -- | Pure UI interaction; reordered list sent to backend on save |
| Favorites persistence | Rust Backend | Frontend (context menu + star) | Backend stores per-source favorites list; frontend provides toggle UI |
| Sidebar resize + collapse | Frontend (React) | Rust Backend (width persistence) | Mouse interaction is frontend; width value persists in `AppSettings` |
| Date formatting | Frontend (React) | -- | `YYYYMMDD` string parsing + display formatting is pure presentation logic |

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `tauri` (Rust) | 2.x | App framework, IPC, command registration | Project foundation [VERIFIED: Cargo.toml] |
| `tokio` | 1.48.0 | Async runtime, `spawn_blocking`, `timeout` | Already used for DB connections [VERIFIED: Cargo.lock] |
| `serde` / `serde_json` | 1.x | Serialization for `AppSettings` and IPC types | Already used throughout [VERIFIED: Cargo.toml] |
| `chrono` | 0.4.x | Date parsing and formatting for BRWS-03 | Already installed with serde feature [VERIFIED: Cargo.toml] |
| `tauri-plugin-dialog` | 2.x | Native folder picker for D-03 browse button | Already installed and configured [VERIFIED: Cargo.toml, capabilities] |
| `zustand` | 5.0.9 | Frontend state management | Project standard [VERIFIED: package.json] |
| `lucide-react` | 0.555.0 | Icons (Folder, FileCode, Star, etc.) | Project standard [VERIFIED: package.json] |
| shadcn/ui (Radix) | various | UI primitives (Input, Button, ScrollArea, etc.) | Project standard [VERIFIED: components/ui/] |

### New Dependencies (Phase 2)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@dnd-kit/core` | 6.3.1 | Drag-and-drop foundation for settings reorder (D-05) | Settings folder source list only [ASSUMED] |
| `@dnd-kit/sortable` | 10.0.0 | Sortable preset for vertical list reorder | Settings folder source list only [ASSUMED] |
| `@radix-ui/react-context-menu` | 2.2.16 | Right-click context menu for favorite toggle (D-17) | Tree node context menu [VERIFIED: npm registry + shadcn official component] |
| `tokio-util` | 0.7.x | `CancellationToken` for directory listing abort (D-25) | Already installed [VERIFIED: Cargo.toml] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Custom tree component | `react-arborist` 3.7.0 | react-arborist adds react-dnd, react-window, redux (heavy deps). No built-in async loading. Existing `schema-browser-sidebar.tsx` already proves the custom pattern works in this codebase. |
| `@dnd-kit/core` + `@dnd-kit/sortable` | `@dnd-kit/react` 0.4.0 (new API) | v0.4.0 is pre-1.0, still in development. Legacy core/sortable is stable (released Dec 2024). |
| `@tanstack/react-virtual` | None (plain rendering) | Only needed if directories regularly exceed ~500 entries. Start without it; add if performance testing shows need. |
| `tokio_util::sync::CancellationToken` | `AtomicBool` flag | CancellationToken is more idiomatic for tokio, already available via tokio-util in Cargo.toml. Both work. |

**Installation:**
```bash
npm install @dnd-kit/core @dnd-kit/sortable
npx shadcn@latest add context-menu
```

No new Rust crates needed -- `tokio-util` (for `CancellationToken`) is already in `Cargo.toml`.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@dnd-kit/core` | npm | 5+ yrs (Jan 2021) | ~2M/wk | github.com/clauderic/dnd-kit | [OK] | Approved |
| `@dnd-kit/sortable` | npm | 5+ yrs (Jan 2021) | ~1.5M/wk | github.com/clauderic/dnd-kit | [OK] | Approved |
| `@radix-ui/react-context-menu` | npm | 4+ yrs | ~800K/wk | github.com/radix-ui/primitives | [OK] | Approved (shadcn official) |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
User Action                    Frontend (React)                   Backend (Rust/Tauri)
-----------                    ----------------                   --------------------

[Click expand] -----> ExplorerSidebar                    
                        |                                 
                        v                                 
                    FolderTree                            
                        |                                 
                        v                                 
                  useExplorerStore ----IPC----> list_directory_cmd
                  (Zustand)                         |
                        ^                           v
                        |                    spawn_blocking {
                        |                      std::fs::read_dir(path)
                        |                      // check cancel token each entry
                        |                    }
                        |                           |
                        |                    timeout(15s) wraps spawn
                        |                           |
                  [children loaded] <--IPC---- Vec<DirEntry> response
                        |
                        v
                    FolderTreeNode (render children)


[Settings Save] -----> FolderSourcesSection
                        |
                        v
                  settingsService.saveSettings({
                    folderSources: [...]
                  }) ----IPC----> save_settings
                                      |
                                      v
                                 AppState.update_settings()
                                      |
                                      v
                                 settings.json (disk)


[Cancel click] -----> useExplorerStore.cancelLoad(nodeId)
                        |
                        v
                  abort controller ----IPC----> cancel_directory_cmd
                                                    |
                                                    v
                                              CancellationToken.cancel()
                                                    |
                                              spawn_blocking loop breaks
```

### Recommended Project Structure
```
src/
  features/
    explorer/
      components/
        explorer-shell.tsx              # Updated: adds sidebar alongside content
        explorer-sidebar.tsx            # NEW: sidebar container (filter + tree + controls)
        explorer-empty-state.tsx        # Updated: messaging for D-08
        explorer-nav-bar.tsx            # Existing (no changes)
        folder-tree.tsx                 # NEW: tree rendering with virtual scroll
        folder-tree-node.tsx            # NEW: single tree row (chevron, icon, name, badge)
      hooks/
        use-explorer-sidebar.ts         # NEW: sidebar open/close/resize state
      services/
        explorer-service.ts             # NEW: Tauri IPC for list_directory, cancel
      store.ts                          # NEW: Zustand store for tree state, favorites, filter
      types.ts                          # NEW: FolderSource, TreeNode, DirEntry types
  features/
    settings/
      components/
        sections/
          folder-sources-section.tsx    # NEW: settings CRUD + reorder
          folder-source-row.tsx         # NEW: single source row with drag handle
  components/
    app-settings-sheet.tsx              # Updated: add "Sources" nav item

src-tauri/src/
  commands/
    explorer.rs                         # NEW: list_directory_cmd, cancel_directory_cmd, check_path_cmd
  commands/mod.rs                       # Updated: export new commands
  state.rs                              # Updated: FolderSource struct, favorites in AppSettings
  lib.rs                                # Updated: register new commands
```

### Pattern 1: Lazy-Loading Tree with Async IPC

**What:** Each tree node manages its own loading state. On expand, it calls a Tauri command and renders a spinner until the response arrives. The tree store maintains a map of `nodeId -> LoadState` where LoadState is `idle | loading | loaded | error`.

**When to use:** Every expand interaction in the folder tree.

**Example:**
```typescript
// Source: Derived from existing schema-browser-sidebar.tsx pattern + Tauri IPC pattern
interface TreeNodeState {
  id: string;
  path: string;
  name: string;
  type: 'source' | 'client' | 'date' | 'file';
  children: TreeNodeState[] | null; // null = not loaded
  loadState: 'idle' | 'loading' | 'loaded' | 'error';
  childCount?: number;
  isFavorite?: boolean;
}

// In Zustand store
expandNode: async (nodeId: string) => {
  const node = get().nodes.get(nodeId);
  if (!node || node.loadState === 'loading') return;

  set(state => ({
    nodes: new Map(state.nodes).set(nodeId, { ...node, loadState: 'loading' })
  }));

  try {
    const entries = await explorerService.listDirectory(node.path);
    set(state => ({
      nodes: new Map(state.nodes).set(nodeId, {
        ...node,
        children: entries,
        childCount: entries.length,
        loadState: 'loaded'
      })
    }));
  } catch (error) {
    set(state => ({
      nodes: new Map(state.nodes).set(nodeId, { ...node, loadState: 'error' })
    }));
  }
},
```

### Pattern 2: Rust Directory Listing with Timeout + Cancel

**What:** The Rust command uses `spawn_blocking` to run `std::fs::read_dir` (avoiding any async FS edge cases), wrapped in `tokio::time::timeout` for the 15-second limit, with a `CancellationToken` checked per-entry for user-initiated cancellation.

**When to use:** Every `list_directory_cmd` invocation.

**Example:**
```rust
// Source: Derived from tokio docs + existing ssrp.rs timeout pattern
use tokio::time::{timeout, Duration};
use tokio_util::sync::CancellationToken;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};

// State holds a map of operation_id -> CancellationToken
pub struct ExplorerState {
    pub active_listings: Mutex<HashMap<String, CancellationToken>>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    pub name: String,
    pub is_dir: bool,
    pub path: String,
}

#[tauri::command]
pub async fn list_directory_cmd(
    path: String,
    operation_id: String,
    explorer_state: tauri::State<'_, ExplorerState>,
) -> Result<Vec<DirEntry>, String> {
    let cancel_token = CancellationToken::new();
    {
        let mut listings = explorer_state.active_listings.lock()
            .map_err(|e| e.to_string())?;
        listings.insert(operation_id.clone(), cancel_token.clone());
    }

    let result = timeout(
        Duration::from_secs(15),
        tokio::task::spawn_blocking(move || {
            let mut entries = Vec::new();
            let read_dir = std::fs::read_dir(&path)
                .map_err(|e| format!("Failed to read directory: {}", e))?;
            
            for entry_result in read_dir {
                if cancel_token.is_cancelled() {
                    return Err("Operation cancelled".to_string());
                }
                match entry_result {
                    Ok(entry) => {
                        let metadata = entry.metadata();
                        entries.push(DirEntry {
                            name: entry.file_name().to_string_lossy().to_string(),
                            is_dir: metadata.map(|m| m.is_dir()).unwrap_or(false),
                            path: entry.path().to_string_lossy().to_string(),
                        });
                    }
                    Err(_) => continue, // Skip unreadable entries
                }
            }
            Ok(entries)
        })
    ).await;

    // Clean up operation tracking
    {
        let mut listings = explorer_state.active_listings.lock()
            .map_err(|e| e.to_string())?;
        listings.remove(&operation_id);
    }

    match result {
        Ok(Ok(entries)) => entries,
        Ok(Err(e)) => Err(e.to_string()),  // spawn_blocking panicked
        Err(_) => Err("Folder listing timed out after 15 seconds".to_string()),
    }
}

#[tauri::command]
pub fn cancel_directory_cmd(
    operation_id: String,
    explorer_state: tauri::State<'_, ExplorerState>,
) -> Result<(), String> {
    let listings = explorer_state.active_listings.lock()
        .map_err(|e| e.to_string())?;
    if let Some(token) = listings.get(&operation_id) {
        token.cancel();
    }
    Ok(())
}
```

### Pattern 3: Settings Drag-to-Reorder with @dnd-kit

**What:** The folder sources list in settings uses `@dnd-kit/core` + `@dnd-kit/sortable` for drag-to-reorder. Each source row has a `GripVertical` drag handle.

**When to use:** Settings Folder Sources section only.

**Example:**
```typescript
// Source: dnd-kit docs (https://docs.dndkit.com/presets/sortable) [ASSUMED]
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function FolderSourceRow({ source, id }: { source: FolderSource; id: string }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2">
      <GripVertical className="h-4 w-4 cursor-grab" {...attributes} {...listeners} />
      {/* path, label, tag inputs, browse button, remove button */}
    </div>
  );
}

function FolderSourcesSection() {
  const [sources, setSources] = useState<FolderSource[]>([]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSources(items => {
        const oldIndex = items.findIndex(s => s.id === active.id);
        const newIndex = items.findIndex(s => s.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sources.map(s => s.id)} strategy={verticalListSortingStrategy}>
        {sources.map(source => (
          <FolderSourceRow key={source.id} id={source.id} source={source} />
        ))}
      </SortableContext>
    </DndContext>
  );
}
```

### Pattern 4: Folder Source Persistence in AppSettings

**What:** Folder sources are stored as a `Vec<FolderSource>` in `AppSettings`. Each source has a unique ID (UUID v4), path, label, tag, display order (implicit from Vec position), and a favorites list.

**When to use:** All source CRUD operations.

**Example:**
```rust
// Source: Derived from existing state.rs AppSettings pattern
#[derive(Default, Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FolderSource {
    pub id: String,
    pub path: String,
    pub label: String,
    #[serde(default)]
    pub tag: String,
    #[serde(default)]
    pub favorites: Vec<String>, // Client folder names pinned as favorites
}

#[derive(Default, Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    // ... existing fields ...
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub folder_sources: Vec<FolderSource>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub explorer_sidebar_width: Option<f64>,
}
```

### Anti-Patterns to Avoid
- **Using `tokio::fs::read_dir` directly:** While the infinite-loop bug is fixed in tokio 1.27+, `spawn_blocking` with `std::fs::read_dir` gives explicit control over the blocking threadpool and allows per-entry cancellation checks. [CITED: tokio-rs/tokio#5473, docs.rs/tokio/latest/tokio/fs]
- **Loading all tree levels at once:** Defeats lazy-loading purpose. Only load children of the expanded node.
- **Storing tree state in AppSettings:** Tree expansion state is ephemeral session state -- store in Zustand, not on disk.
- **Using `tokio::fs::read_dir` for UNC path reachability check:** A simple `std::fs::metadata` in `spawn_blocking` is faster for the D-04 reachability validation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Drag-to-reorder list | Custom mouse event tracking with state management | `@dnd-kit/core` + `@dnd-kit/sortable` | Accessibility (keyboard, screen readers), animation, edge cases (scroll during drag, touch) |
| Right-click context menu | Custom div with portal + click-outside | `@radix-ui/react-context-menu` (shadcn) | Accessibility, keyboard nav, nested menus, portal management |
| Native folder picker | Custom file input | `@tauri-apps/plugin-dialog` `open({ directory: true })` | Already installed; OS-native dialog |
| Async task cancellation | Raw `AtomicBool` flag threading | `tokio_util::sync::CancellationToken` | More ergonomic, composable, already in dependency tree |
| Date string parsing | Manual regex on `YYYYMMDD` | `chrono::NaiveDate::parse_from_str` | Edge cases (invalid dates, leap years), already installed |
| ID generation for sources | Counter-based IDs | `uuid` crate or JS `crypto.randomUUID()` | Collision-free, stable across reorder/delete operations |

**Key insight:** The primary complexity in this phase is the async I/O lifecycle (loading -> timeout -> cancel -> retry), not the UI components. The tree rendering is straightforward following existing patterns; the challenging engineering is in the Rust command layer.

## Common Pitfalls

### Pitfall 1: spawn_blocking Cannot Be Aborted Mid-Execution
**What goes wrong:** Calling `abort()` on a `JoinHandle<T>` from `spawn_blocking` has no effect if the task has already started. The blocking thread continues running.
**Why it happens:** `spawn_blocking` runs on a dedicated OS thread, not on the async executor. There is no cooperative cancellation point.
**How to avoid:** Use `CancellationToken` (or `AtomicBool`) checked inside the `read_dir` iteration loop. Each entry iteration checks the token. When cancelled, the loop breaks and the blocking thread returns early.
**Warning signs:** Cancel button appears to work (frontend collapses node) but Rust logs show the directory listing still running to completion.

### Pitfall 2: Settings Partial Update Clobbers Folder Sources
**What goes wrong:** The existing `update_settings` method uses field-by-field `Option<T>` merging. If `folder_sources` is added as `Option<Vec<FolderSource>>`, a `None` value means "don't update" but could be misinterpreted.
**Why it happens:** The `AppSettingsUpdate` struct pattern uses `Option<T>` to distinguish "don't change" from "set to value". But `Vec<FolderSource>` needs a different semantic -- "replace the entire list" vs "don't touch it".
**How to avoid:** Add `folder_sources: Option<Vec<FolderSource>>` to `AppSettingsUpdate`. `None` = don't change, `Some(vec)` = replace entirely. Document clearly. Or use a dedicated `save_folder_sources` command separate from general settings.
**Warning signs:** Saving theme preference wipes out folder sources.

### Pitfall 3: UNC Paths Need Backslash Handling Across Platforms
**What goes wrong:** UNC paths like `\\server\share` use backslashes, which are path separators on Windows but escape characters in most contexts. On macOS, these paths are nonsensical (SMB mounts use `/Volumes/...`).
**Why it happens:** The app must work cross-platform, but the actual deployment target for network shares is Windows.
**How to avoid:** Accept paths as-is (string). On the Rust side, `std::path::PathBuf` handles platform differences. Don't try to normalize separators. For macOS testing, use local directories. The UI text input accepts whatever the user types.
**Warning signs:** Path validation rejects valid UNC paths on Windows, or crashes on macOS when encountering backslashes.

### Pitfall 4: Sidebar Resize State Race with Settings Persistence
**What goes wrong:** Rapid mouse dragging fires many resize events. If each one triggers a settings save IPC call, the system floods with save requests and potentially corrupts the settings file.
**Why it happens:** Mouse move events fire at 60Hz during drag operations.
**How to avoid:** Debounce the width persistence. Store the width in component state during drag, only persist to `AppSettings` on `mouseup` (drag end).
**Warning signs:** Settings file becomes corrupted JSON, or app becomes unresponsive during sidebar resize.

### Pitfall 5: Date Folder Sorting Must Handle Non-Date Folders
**What goes wrong:** Not all folders in a client directory may follow the `YYYYMMDD` naming convention. Strict date parsing crashes or hides valid folders.
**Why it happens:** Real-world data is messy -- there may be folders like "archive", "old", "test", or partial date formats.
**How to avoid:** Try to parse folder name as `YYYYMMDD` date. If parsing fails, treat as a regular folder (sorted alphabetically after date folders). Never skip folders that don't match the date pattern.
**Warning signs:** Folders disappear from the tree, or the app panics on unexpected folder names.

### Pitfall 6: Favorites Scope Must Match Source ID
**What goes wrong:** If favorites are stored globally (not per-source), a client code like "ABC" favorited in the Inbound source also appears favorited in the Outbound source.
**Why it happens:** Client codes are reused across sources. "ABC" exists in both inbound and outbound.
**How to avoid:** Favorites are stored per-source (D-18). Each `FolderSource` has its own `favorites: Vec<String>`. The favorite toggle only affects the source containing that client node.
**Warning signs:** Favoriting in one source affects a different source.

## Code Examples

### Date Folder Formatting (BRWS-03)

```typescript
// Source: chrono docs + CONTEXT D-03 specification
function formatDateFolder(rawName: string): { raw: string; formatted: string | null } {
  // Try to parse YYYYMMDD
  if (rawName.length === 8 && /^\d{8}$/.test(rawName)) {
    const year = parseInt(rawName.slice(0, 4));
    const month = parseInt(rawName.slice(4, 6));
    const day = parseInt(rawName.slice(6, 8));
    
    const date = new Date(year, month - 1, day);
    // Validate the date is real (not Feb 30, etc.)
    if (date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day) {
      const formatted = date.toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric'
      });
      return { raw: rawName, formatted };
    }
  }
  return { raw: rawName, formatted: null };
}

// Display: "20251223 (Dec 23, 2025)" or just "archive" for non-date folders
```

### Path Reachability Check (D-04)

```rust
// Source: Derived from std::fs::metadata docs
#[tauri::command]
pub async fn check_path_reachable(path: String) -> Result<bool, String> {
    let result = tokio::task::spawn_blocking(move || {
        std::fs::metadata(&path).is_ok()
    }).await;
    
    match result {
        Ok(reachable) => Ok(reachable),
        Err(_) => Ok(false), // spawn_blocking panic = unreachable
    }
}
```

### Filter Implementation (D-20, D-21)

```typescript
// Source: Derived from existing schema-browser-sidebar.tsx filterTree pattern
function filterTreeNodes(
  nodes: TreeNodeState[],
  filter: string
): TreeNodeState[] {
  if (!filter.trim()) return nodes;
  const lower = filter.toLowerCase();
  
  return nodes.filter(node => {
    // Match this node's name
    if (node.name.toLowerCase().includes(lower)) return true;
    // If expanded, check children recursively
    if (node.children) {
      return filterTreeNodes(node.children, filter).length > 0;
    }
    return false;
  });
}
```

### Folder Picker from Frontend (D-03)

```typescript
// Source: Tauri plugin-dialog docs (https://v2.tauri.app/plugin/dialog/) [CITED]
import { open } from '@tauri-apps/plugin-dialog';

async function browseForFolder(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: 'Select folder source',
  });
  return selected as string | null;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tokio::fs::read_dir` hangs on UNC (Windows) | Fixed in tokio 1.27.0 (Fuse wrapper) | March 2023 | Project has tokio 1.48.0 -- bug is fixed. Still use `spawn_blocking` for timeout/cancel control. [CITED: github.com/tokio-rs/tokio/pull/5555] |
| `@dnd-kit/core` v5 + `@dnd-kit/sortable` v7 | `@dnd-kit/core` 6.3.1 + `@dnd-kit/sortable` 10.0.0 | Dec 2024 | Major version bumps. New API surface. [VERIFIED: npm registry] |
| `@dnd-kit/react` (new unified API) | v0.4.0 pre-release | Ongoing | Not ready for production. Use legacy core/sortable. [VERIFIED: npm registry] |

**Deprecated/outdated:**
- `react-dnd` + `react-dnd-html5-backend`: react-arborist's dependency chain. Community has moved to @dnd-kit. [ASSUMED]
- `react-window`: react-arborist's virtualization. `@tanstack/react-virtual` is the modern alternative if virtualization is needed. [ASSUMED]

## D-29 Resolution: UNC Path Workaround Strategy

**Recommendation:** Use `tokio::task::spawn_blocking` + `std::fs::read_dir` wrapped in `tokio::time::timeout(Duration::from_secs(15), ...)` with a `CancellationToken` from `tokio_util::sync` for per-entry cancellation.

**Rationale:**

1. **The infinite-loop bug is fixed.** Tokio 1.48.0 includes the Fuse wrapper fix from PR #5555 (merged March 2023). The `tokio::fs::read_dir` function no longer loops infinitely on Windows network locations. [CITED: github.com/tokio-rs/tokio/pull/5555]

2. **`spawn_blocking` gives explicit control.** Even though `tokio::fs::read_dir` internally uses `spawn_blocking`, wrapping `std::fs::read_dir` ourselves lets us:
   - Check a `CancellationToken` between entries (for user cancel per D-25)
   - Avoid any future tokio internal behavior changes
   - Have a clean separation between "our blocking work" and "tokio's internal pool"

3. **`CancellationToken` enables graceful cancel.** Since `spawn_blocking` threads cannot be forcefully aborted, we check `token.is_cancelled()` inside the `read_dir` iteration loop. This means cancel is cooperative -- if the filesystem is hung on a single `next()` call (unreachable network share), the cancel won't take effect until that call returns or the 15-second timeout fires. This is acceptable behavior: the user sees "Loading... 15s" then gets the timeout error.

4. **`tokio::time::timeout` provides the hard deadline.** Wrapping the entire `spawn_blocking` future in `timeout(15s)` ensures the command always returns within 15 seconds, even if the filesystem hangs on the initial `read_dir()` call before entering the loop.

5. **No dedicated thread pool needed.** `spawn_blocking` already uses tokio's blocking thread pool. A custom thread pool adds complexity without benefit for this use case (sequential, user-initiated operations).

**Confidence:** HIGH -- this combines three well-documented patterns (spawn_blocking, timeout, CancellationToken) that are all already used or available in the project's dependency tree.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@dnd-kit/core` 6.3.1 + `@dnd-kit/sortable` 10.0.0 are the correct packages for drag-to-reorder in settings | Standard Stack | Wrong package versions could cause React 19 incompatibility. Mitigated by `react >= 16.8.0` peer dep. |
| A2 | Virtual scrolling can be deferred (most client directories have < 500 entries) | Primary recommendation | If directories regularly have 1000+ entries, rendering performance may suffer. Add `@tanstack/react-virtual` at that point. |
| A3 | `crypto.randomUUID()` is available in Tauri's WebView for source ID generation | Don't Hand-Roll | If not available, use a simple counter-based ID or add the `uuid` npm package. |
| A4 | The `@dnd-kit/sortable` v10 API is compatible with the legacy v7 examples | Code Examples | API may have changed in the major version bump. Verify during implementation. |

## Open Questions

1. **Virtual scrolling threshold**
   - What we know: D-28 says "virtual scrolling handles rendering performance." Client directories likely have tens to low hundreds of entries. Date directories could have thousands of files.
   - What's unclear: At what entry count does performance degrade without virtualization?
   - Recommendation: Start without `@tanstack/react-virtual`. If file-level nodes cause jank in date folders with 500+ files, add it for the file node level only.

2. **Source ID generation strategy**
   - What we know: Sources need stable unique IDs for drag-to-reorder, favorites scoping, and React keys.
   - What's unclear: Whether to generate IDs on the Rust side or JavaScript side. Whether to use UUID v4 or a simpler scheme.
   - Recommendation: Generate on the JavaScript side using `crypto.randomUUID()` when creating a new source. Persist the ID in `AppSettings`. This avoids adding the `uuid` crate to Rust.

3. **Dedicated `save_folder_sources` command vs extending `save_settings`**
   - What we know: The existing pattern uses a single `save_settings` command with `AppSettingsUpdate` fields.
   - What's unclear: Whether folder sources should be saved through the same command or a dedicated one.
   - Recommendation: Extend `AppSettingsUpdate` with `folder_sources: Option<Vec<FolderSource>>` for consistency. Add a separate `toggle_favorite` command for the atomic favorite toggle operation (avoids sending the full settings object just to star a client).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Rust toolchain | Tauri backend commands | Yes | (project builds) | -- |
| Node.js | Frontend build | Yes | (project builds) | -- |
| tokio-util | CancellationToken | Yes | 0.7.x | AtomicBool flag |
| chrono | Date parsing | Yes | 0.4.x | Manual string parsing |
| tauri-plugin-dialog | Folder picker | Yes | 2.x (capabilities configured) | -- |
| tauri-plugin-fs | File operations | Yes | 2.x (capabilities configured) | -- |

**Missing dependencies with no fallback:** none
**Missing dependencies with fallback:** none

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 2.1.2 (frontend), Rust built-in test (backend) |
| Config file | `vitest.config.ts` (frontend), `Cargo.toml [dev-dependencies]` (backend) |
| Quick run command | `npm run test -- --run` |
| Full suite command | `npm run test && cd src-tauri && cargo test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BRWS-01 | Folder sources CRUD + persistence | unit | `npm run test -- --run src/features/explorer/store.test.ts` | No -- Wave 0 |
| BRWS-01 | Settings save/load with folder sources | unit (Rust) | `cd src-tauri && cargo test state::tests` | Partial (existing settings test) |
| BRWS-02 | Tree node expand loads children | unit | `npm run test -- --run src/features/explorer/store.test.ts` | No -- Wave 0 |
| BRWS-03 | Date folder formatting | unit | `npm run test -- --run src/features/explorer/utils/date-format.test.ts` | No -- Wave 0 |
| BRWS-08 | Filter matches loaded nodes | unit | `npm run test -- --run src/features/explorer/utils/tree-filter.test.ts` | No -- Wave 0 |
| BRWS-08 | Favorites toggle per-source | unit | `npm run test -- --run src/features/explorer/store.test.ts` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run test -- --run`
- **Per wave merge:** `npm run test && npm run build && cd src-tauri && cargo test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/features/explorer/store.test.ts` -- covers BRWS-01 (source CRUD), BRWS-02 (expand/collapse/load state), BRWS-08 (favorites)
- [ ] `src/features/explorer/utils/date-format.test.ts` -- covers BRWS-03 (date parsing, invalid dates, non-date folders)
- [ ] `src/features/explorer/utils/tree-filter.test.ts` -- covers BRWS-08 (filter matching on loaded nodes)
- [ ] Rust: extend `src-tauri/src/state.rs` tests for `FolderSource` persistence round-trip

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A -- local filesystem access, no auth |
| V3 Session Management | No | N/A -- desktop app, no sessions |
| V4 Access Control | No | N/A -- reads whatever the OS user has access to |
| V5 Input Validation | Yes | Validate folder paths are strings, not injected commands. `std::fs::read_dir` with `PathBuf` is safe. |
| V6 Cryptography | No | N/A -- no secrets or encryption |

### Known Threat Patterns for Tauri + Filesystem

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via crafted folder path | Tampering | `std::path::PathBuf` canonicalization prevents traversal. Tauri commands run in backend with OS-level permissions. |
| Denial of service via huge directory | DoS | 15-second timeout (D-23) limits resource consumption. Cancel token stops iteration. |
| Sensitive data exposure in settings.json | Information Disclosure | Folder paths stored in `AppSettings` are not secrets. No passwords stored. |

## Sources

### Primary (HIGH confidence)
- Existing codebase: `schema-browser-sidebar.tsx` (tree pattern), `state.rs` (settings persistence), `ssrp.rs` (timeout pattern), `tauri.ts` (IPC pattern)
- [tokio-rs/tokio#5473](https://github.com/tokio-rs/tokio/issues/5473) -- UNC path read_dir issue, fixed in tokio 1.27.0
- [tokio-rs/tokio#5555](https://github.com/tokio-rs/tokio/pull/5555) -- Fix PR (Fuse wrapper), merged March 2023
- [Tauri v2 Dialog Plugin](https://v2.tauri.app/plugin/dialog/) -- folder picker API
- [tokio spawn_blocking docs](https://docs.rs/tokio/latest/tokio/task/fn.spawn_blocking.html) -- blocking task semantics
- npm registry: `@dnd-kit/core` 6.3.1, `@dnd-kit/sortable` 10.0.0, `@radix-ui/react-context-menu` 2.2.16

### Secondary (MEDIUM confidence)
- [dnd-kit documentation](https://docs.dndkit.com/presets/sortable) -- sortable API patterns
- [react-arborist GitHub](https://github.com/jameskerr/react-arborist) -- evaluated and rejected (heavy deps)

### Tertiary (LOW confidence)
- None -- all critical claims verified against primary sources

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all core deps already installed; new deps verified via npm + slopcheck
- Architecture: HIGH -- patterns derived from existing codebase + Tauri/tokio official docs
- Pitfalls: HIGH -- UNC path issue verified resolved; cancel limitations documented in tokio docs
- D-29 resolution: HIGH -- three well-documented patterns combined

**Research date:** 2026-05-22
**Valid until:** 2026-06-22 (stable tech stack, 30-day window)
