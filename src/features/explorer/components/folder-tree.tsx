import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/shallow";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useExplorerStore } from "../store";
import { flattenTree, type TreeNodeRow } from "../store/selectors";
import { useFileActions } from "../hooks/use-file-actions";
import { FolderTreeRow, treeRowDomId } from "./folder-tree-node";

/** Milliseconds before an idle type-ahead buffer resets. */
const TYPEAHEAD_RESET_MS = 500;

/** Rows loading for at least this long show elapsed time and a cancel button. */
const LOADING_INFO_DELAY_S = 3;

export function FolderTree() {
  const {
    folderSources,
    treeNodes,
    expandedIds,
    activeOperations,
    filterText,
    loadedFileIndex,
    dateSortOrder,
    dateRange,
    folderBadgeCache,
    validationCache,
    searchMode,
    searchCheckedPaths,
    selectedPath,
  } = useExplorerStore(
    useShallow((state) => ({
      folderSources: state.folderSources,
      treeNodes: state.treeNodes,
      expandedIds: state.expandedIds,
      activeOperations: state.activeOperations,
      filterText: state.filterText,
      loadedFileIndex: state.loadedFileIndex,
      dateSortOrder: state.dateSortOrder,
      dateRange: state.dateRange,
      folderBadgeCache: state.folderBadgeCache,
      validationCache: state.validationCache,
      searchMode: state.searchMode,
      searchCheckedPaths: state.searchCheckedPaths,
      selectedPath: state.selectedPath,
    }))
  );

  const { copyPath, copyContent, openExternal, saveCopy } = useFileActions();

  const [favoritesCollapsed, setFavoritesCollapsed] = useState<Set<string>>(
    new Set()
  );
  const [menuTarget, setMenuTarget] = useState<TreeNodeRow | null>(null);
  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const typeaheadRef = useRef<{ buffer: string; timer: number | null }>({
    buffer: "",
    timer: null,
  });

  const rows = useMemo(
    () =>
      flattenTree({
        treeNodes,
        folderSources,
        expandedIds,
        filterText,
        loadedFileIndex,
        dateSortOrder,
        dateRange,
        favoritesCollapsed,
        folderBadgeCache,
        validationCache,
      }),
    [
      treeNodes,
      folderSources,
      expandedIds,
      filterText,
      loadedFileIndex,
      dateSortOrder,
      dateRange,
      favoritesCollapsed,
      folderBadgeCache,
      validationCache,
    ]
  );

  const rowsByKey = useMemo(() => {
    const map = new Map<string, TreeNodeRow>();
    for (const row of rows) {
      if (row.kind === "node") map.set(row.key, row);
    }
    return map;
  }, [rows]);

  const scrollParentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => 28,
    overscan: 10,
    getItemKey: (index) => rows[index]?.key ?? index,
  });

  // One shared ticker for loading elapsed times, active only while
  // something is loading (replaces the old per-row setInterval).
  const loadingStartRef = useRef(new Map<string, number>());
  const [, setNowTick] = useState(0);
  const hasLoading = activeOperations.size > 0;
  useEffect(() => {
    const starts = loadingStartRef.current;
    for (const nodeId of activeOperations.keys()) {
      if (!starts.has(nodeId)) starts.set(nodeId, Date.now());
    }
    for (const nodeId of starts.keys()) {
      if (!activeOperations.has(nodeId)) starts.delete(nodeId);
    }
  }, [activeOperations]);
  useEffect(() => {
    if (!hasLoading) return;
    const interval = setInterval(() => setNowTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, [hasLoading]);

  const elapsedFor = (row: TreeNodeRow): number | null => {
    if (row.loadState !== "loading") return null;
    const start = loadingStartRef.current.get(row.id);
    if (!start) return null;
    const seconds = Math.floor((Date.now() - start) / 1000);
    return seconds >= LOADING_INFO_DELAY_S ? seconds : null;
  };

  const showCheckboxes = searchMode === "content";
  const isPathChecked = useCallback(
    (path: string) => {
      if (searchCheckedPaths.has(path)) return true;
      for (const checked of searchCheckedPaths) {
        if (path.startsWith(checked + "/") || path.startsWith(checked + "\\"))
          return true;
      }
      return false;
    },
    [searchCheckedPaths]
  );

  // Stable row callbacks (rows re-render only when their data changes)
  const handleToggle = useCallback((row: TreeNodeRow) => {
    const store = useExplorerStore.getState();
    if (row.type !== "source") store.setLastInteractedFolder(row.path);
    store.setSelectedPath(row.path);
    setFocusedKey(row.key);
    if (row.isExpanded) {
      store.collapseNode(row.id);
    } else {
      store.expandNode(row.id);
    }
  }, []);
  const handleOpenFile = useCallback((row: TreeNodeRow) => {
    const store = useExplorerStore.getState();
    store.setSelectedPath(row.path);
    setFocusedKey(row.key);
    store.openFile(row.path);
  }, []);
  const handleCancelLoad = useCallback((row: TreeNodeRow) => {
    useExplorerStore.getState().cancelLoad(row.id);
  }, []);
  const handleRetry = useCallback((row: TreeNodeRow) => {
    useExplorerStore.getState().expandNode(row.id);
  }, []);
  const handleToggleCheck = useCallback((path: string) => {
    useExplorerStore.getState().toggleSearchCheck(path);
  }, []);
  const handleFavoritesToggle = useCallback((sourceId: string) => {
    setFavoritesCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(sourceId)) next.delete(sourceId);
      else next.add(sourceId);
      return next;
    });
  }, []);

  // Keyboard navigation: the scroll container is the single tab stop and
  // routes arrows/Enter/type-ahead over node rows via aria-activedescendant.
  const focusRowAt = useCallback(
    (index: number) => {
      const row = rows[index];
      if (!row || row.kind !== "node") return;
      setFocusedKey(row.key);
      rowVirtualizer.scrollToIndex(index);
    },
    [rows, rowVirtualizer]
  );

  const findFocusedIndex = useCallback(() => {
    if (focusedKey === null) return -1;
    return rows.findIndex((r) => r.key === focusedKey);
  }, [rows, focusedKey]);

  const moveFocus = useCallback(
    (delta: 1 | -1) => {
      const current = findFocusedIndex();
      let index = current === -1 ? (delta === 1 ? -1 : rows.length) : current;
      do {
        index += delta;
      } while (index >= 0 && index < rows.length && rows[index].kind !== "node");
      if (index >= 0 && index < rows.length) focusRowAt(index);
    },
    [rows, findFocusedIndex, focusRowAt]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const store = useExplorerStore.getState();
      const currentIndex = findFocusedIndex();
      const current =
        currentIndex >= 0 && rows[currentIndex].kind === "node"
          ? (rows[currentIndex] as TreeNodeRow)
          : null;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          moveFocus(1);
          break;
        case "ArrowUp":
          e.preventDefault();
          moveFocus(-1);
          break;
        case "ArrowRight":
          e.preventDefault();
          if (!current || !current.isDir) break;
          if (!current.isExpanded) {
            store.expandNode(current.id);
          } else {
            moveFocus(1);
          }
          break;
        case "ArrowLeft": {
          e.preventDefault();
          if (!current) break;
          if (current.isDir && current.isExpanded) {
            store.collapseNode(current.id);
            break;
          }
          // Walk back to the nearest shallower node row (the parent).
          for (let i = currentIndex - 1; i >= 0; i--) {
            const row = rows[i];
            if (row.kind === "node" && row.depth < current.depth) {
              focusRowAt(i);
              break;
            }
          }
          break;
        }
        case "Enter":
        case " ":
          e.preventDefault();
          if (!current) break;
          if (current.isDir) {
            handleToggle(current);
          } else {
            handleOpenFile(current);
          }
          break;
        case "Home":
          e.preventDefault();
          for (let i = 0; i < rows.length; i++) {
            if (rows[i].kind === "node") {
              focusRowAt(i);
              break;
            }
          }
          break;
        case "End":
          e.preventDefault();
          for (let i = rows.length - 1; i >= 0; i--) {
            if (rows[i].kind === "node") {
              focusRowAt(i);
              break;
            }
          }
          break;
        default: {
          if (e.key.length !== 1 || e.metaKey || e.ctrlKey || e.altKey) return;
          const state = typeaheadRef.current;
          if (state.timer !== null) window.clearTimeout(state.timer);
          state.buffer += e.key.toLowerCase();
          state.timer = window.setTimeout(() => {
            state.buffer = "";
            state.timer = null;
          }, TYPEAHEAD_RESET_MS);
          const start = currentIndex + 1;
          for (let step = 0; step < rows.length; step++) {
            const i = (start + step) % rows.length;
            const row = rows[i];
            if (
              row.kind === "node" &&
              row.name.toLowerCase().startsWith(state.buffer)
            ) {
              focusRowAt(i);
              break;
            }
          }
        }
      }
    },
    [rows, findFocusedIndex, moveFocus, focusRowAt, handleToggle, handleOpenFile]
  );

  // One context menu for the whole tree. Right-clicks resolve to a row via
  // data-row-key; source rows and empty space open nothing.
  const handleContainerContextMenu = useCallback(
    (e: React.MouseEvent) => {
      const rowEl = (e.target as HTMLElement).closest("[data-row-key]");
      const key = rowEl?.getAttribute("data-row-key");
      const row = key ? rowsByKey.get(key) : undefined;
      if (!row || row.type === "source") {
        e.preventDefault();
        e.stopPropagation();
        setMenuTarget(null);
        return;
      }
      setMenuTarget(row);
    },
    [rowsByKey]
  );

  const menuOpenTab = useExplorerStore((state) =>
    menuTarget && !menuTarget.isDir
      ? state.tabs.find((t) => t.id === menuTarget.path)
      : undefined
  );

  if (folderSources.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-muted-foreground text-center px-4">
          No folder sources configured
        </p>
      </div>
    );
  }

  if (rows.length === 0 && filterText.trim()) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-muted-foreground text-center px-4">
          No matches found
        </p>
      </div>
    );
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={scrollParentRef}
          className="flex-1 overflow-auto outline-none"
          role="tree"
          aria-label="Folder tree"
          tabIndex={0}
          aria-activedescendant={
            focusedKey !== null ? treeRowDomId(focusedKey) : undefined
          }
          onKeyDown={handleKeyDown}
          onContextMenu={handleContainerContextMenu}
        >
          <div
            className="relative mx-2 my-2"
            style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              if (!row) return null;

              return (
                <div
                  key={virtualRow.key}
                  ref={rowVirtualizer.measureElement}
                  data-index={virtualRow.index}
                  className="absolute left-0 top-0 w-full"
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                  <FolderTreeRow
                    row={row}
                    showCheckbox={showCheckboxes && row.kind === "node"}
                    isChecked={
                      row.kind === "node" ? isPathChecked(row.path) : false
                    }
                    isSelected={
                      row.kind === "node" && row.path === selectedPath
                    }
                    isFocused={row.key === focusedKey}
                    elapsedSeconds={
                      row.kind === "node" ? elapsedFor(row) : null
                    }
                    onToggle={handleToggle}
                    onOpenFile={handleOpenFile}
                    onCancelLoad={handleCancelLoad}
                    onRetry={handleRetry}
                    onToggleCheck={handleToggleCheck}
                    onFavoritesToggle={handleFavoritesToggle}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        {menuTarget && !menuTarget.isDir && (
          <>
            <ContextMenuItem onClick={() => copyPath(menuTarget.path)}>
              Copy Path
            </ContextMenuItem>
            <ContextMenuItem onClick={() => openExternal(menuTarget.path)}>
              Open in External Editor
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={() => menuOpenTab && copyContent(menuOpenTab.content)}
              disabled={!menuOpenTab}
            >
              Copy Content
            </ContextMenuItem>
            <ContextMenuItem
              onClick={() =>
                menuOpenTab && saveCopy(menuTarget.name, menuOpenTab.content)
              }
              disabled={!menuOpenTab}
            >
              Save Copy...
            </ContextMenuItem>
          </>
        )}
        {menuTarget && menuTarget.isDir && (
          <>
            <ContextMenuItem
              onClick={() =>
                useExplorerStore
                  .getState()
                  .toggleFavorite(menuTarget.sourceId, menuTarget.path)
              }
            >
              {menuTarget.isFavorite
                ? "Remove from Favorites"
                : "Add to Favorites"}
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={() => {
                const store = useExplorerStore.getState();
                store.requestScan(menuTarget.path, store.scanFilePattern);
              }}
            >
              Scan for Issues...
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
