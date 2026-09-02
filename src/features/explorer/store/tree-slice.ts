import type { FolderSource, TreeNode, DirEntry } from "../types";
import { explorerService } from "../services/explorer-service";
import { showToast } from "@/features/notifications/store";
import {
  settingsService,
  isExplorerNodeStyle,
  DEFAULT_EXPLORER_NODE_STYLE,
} from "@/features/settings/services/settings-service";
import type { DateRange, SliceCreator } from "./store-types";

export interface TreeSlice {
  folderSources: FolderSource[];
  treeNodes: Map<string, TreeNode>;
  expandedIds: Set<string>;
  activeOperations: Map<string, string>;
  /** Debounced filter the tree derives visibility from. */
  filterText: string;
  /** Immediate mirror of the filter input's value. */
  filterInputText: string;
  dateSortOrder: "newest" | "oldest";
  dateRange: DateRange;
  loadedFileIndex: Map<string, string>;
  selectedPath: string | null;
  focusedPath: string | null;

  loadSources: () => Promise<void>;
  expandNode: (nodeId: string) => Promise<void>;
  collapseNode: (nodeId: string) => void;
  cancelLoad: (nodeId: string) => Promise<void>;
  setFilterText: (text: string) => void;
  toggleDateSort: () => void;
  setDateRange: (range: DateRange) => void;
  toggleFavorite: (sourceId: string, clientName: string) => Promise<void>;
  reorderSources: (newSources: FolderSource[]) => void;
  saveSources: () => Promise<void>;
  setSelectedPath: (path: string | null) => void;
  setFocusedPath: (path: string | null) => void;
  /** Expand every ancestor of a path (loading as needed) and select it. */
  revealPath: (path: string) => Promise<void>;
}

function buildChildNodes(
  entries: DirEntry[],
  parentNode: TreeNode,
  folderSources: FolderSource[]
): TreeNode[] {
  return entries.map((entry) => {
    const nodeType: TreeNode["type"] = entry.isDir ? "folder" : "file";

    let isFavorite: boolean | undefined;
    if (entry.isDir) {
      const source = folderSources.find(
        (s) =>
          entry.path === s.path ||
          entry.path.startsWith(s.path + "/") ||
          entry.path.startsWith(s.path + "\\")
      );
      if (source) {
        isFavorite = source.favorites.includes(entry.path);
      }
    }

    return {
      id: entry.path,
      path: entry.path,
      name: entry.name,
      parentId: parentNode.id,
      type: nodeType,
      children: null,
      loadState: "idle" as const,
      isDir: entry.isDir,
      isFavorite,
    };
  });
}

function buildSourceNode(source: FolderSource): TreeNode {
  return {
    id: source.id,
    path: source.path,
    name: source.label,
    type: "source",
    children: null,
    loadState: "idle",
    isDir: true,
  };
}

function buildLoadedFileIndex(
  treeNodes: Map<string, TreeNode>
): Map<string, string> {
  const index = new Map<string, string>();
  for (const [id, node] of treeNodes) {
    index.set(id, node.name.toLowerCase());
  }
  return index;
}

function belongsToSource(nodeId: string, source: FolderSource): boolean {
  return (
    nodeId === source.path ||
    nodeId.startsWith(source.path + "/") ||
    nodeId.startsWith(source.path + "\\")
  );
}

/**
 * Rebuild the tree for a new source list while keeping the loaded subtrees,
 * expansion state, and in-flight operations of sources that are unchanged
 * (same id and path). Sources that were added or repointed start fresh;
 * nodes of removed sources are dropped.
 */
function reconcileTreeWithSources(
  prev: Pick<TreeSlice, "treeNodes" | "expandedIds" | "activeOperations">,
  sources: FolderSource[]
): Pick<
  TreeSlice,
  "treeNodes" | "expandedIds" | "activeOperations" | "loadedFileIndex"
> {
  const treeNodes = new Map<string, TreeNode>();

  for (const source of sources) {
    // Carry a source's subtree over only when its loaded root still points
    // at the same path; a repointed source must start fresh.
    const existingRoot = prev.treeNodes.get(source.id);
    const prevRoot =
      existingRoot && existingRoot.path === source.path
        ? existingRoot
        : undefined;

    if (prevRoot) {
      treeNodes.set(source.id, { ...prevRoot, name: source.label });
      for (const [id, node] of prev.treeNodes) {
        if (id !== source.id && belongsToSource(id, source)) {
          treeNodes.set(id, node);
        }
      }
    } else {
      treeNodes.set(source.id, buildSourceNode(source));
    }
  }

  const expandedIds = new Set<string>();
  for (const id of prev.expandedIds) {
    if (treeNodes.has(id)) expandedIds.add(id);
  }

  const activeOperations = new Map<string, string>();
  for (const [nodeId, opId] of prev.activeOperations) {
    if (treeNodes.has(nodeId)) activeOperations.set(nodeId, opId);
  }

  return {
    treeNodes,
    expandedIds,
    activeOperations,
    loadedFileIndex: buildLoadedFileIndex(treeNodes),
  };
}

let filterDebounce: ReturnType<typeof setTimeout> | null = null;

export const createTreeSlice: SliceCreator<TreeSlice> = (set, get) => ({
  folderSources: [],
  treeNodes: new Map(),
  expandedIds: new Set(),
  activeOperations: new Map(),
  filterText: "",
  filterInputText: "",
  dateSortOrder: "newest",
  dateRange: null,
  loadedFileIndex: new Map<string, string>(),
  selectedPath: null,
  focusedPath: null,

  loadSources: async () => {
    try {
      const settings = await settingsService.getSettings();
      const sources = settings.folderSources ?? [];
      const sidebarWidth = settings.explorerSidebarWidth ?? 280;
      const explorerNodeStyle = isExplorerNodeStyle(settings.explorerNodeStyle)
        ? settings.explorerNodeStyle
        : DEFAULT_EXPLORER_NODE_STYLE;

      // Idempotent: loaded subtrees, expansion, and open state survive
      // remounts (mode switches). Only changed sources start fresh.
      set({
        folderSources: sources,
        ...reconcileTreeWithSources(get(), sources),
        sidebarWidth,
        explorerNodeStyle,
      });
    } catch {
      showToast({
        type: "error",
        title: "Failed to load explorer settings",
        message: "Folder sources could not be loaded",
        duration: 5000,
      });
    }
  },

  expandNode: async (nodeId: string) => {
    const { treeNodes, activeOperations, folderSources } = get();
    const node = treeNodes.get(nodeId);
    if (!node) return;
    if (node.loadState === "loading") return;

    // Set loading state
    const updatedNode = { ...node, loadState: "loading" as const };
    const nextNodes = new Map(treeNodes);
    nextNodes.set(nodeId, updatedNode);

    const operationId = crypto.randomUUID();
    const nextOps = new Map(activeOperations);
    nextOps.set(nodeId, operationId);

    set({ treeNodes: nextNodes, activeOperations: nextOps });

    try {
      const entries = await explorerService.listDirectory(
        node.path,
        operationId
      );
      const children = buildChildNodes(entries, node, folderSources);

      const currentNodes = new Map(get().treeNodes);
      const currentNode = currentNodes.get(nodeId);
      if (!currentNode) return;

      currentNodes.set(nodeId, {
        ...currentNode,
        children,
        childCount: children.length,
        loadState: "loaded",
      });

      const currentExpanded = new Set(get().expandedIds);
      currentExpanded.add(nodeId);

      // Also register child nodes in the map for future expansion
      for (const child of children) {
        currentNodes.set(child.id, child);
      }

      const currentOps = new Map(get().activeOperations);
      currentOps.delete(nodeId);

      // Incremental index update: only the new children gained names.
      const nextIndex = new Map(get().loadedFileIndex);
      for (const child of children) {
        nextIndex.set(child.id, child.name.toLowerCase());
      }

      set({
        treeNodes: currentNodes,
        loadedFileIndex: nextIndex,
        expandedIds: currentExpanded,
        activeOperations: currentOps,
      });
    } catch {
      const currentNodes = new Map(get().treeNodes);
      const currentNode = currentNodes.get(nodeId);
      if (currentNode) {
        currentNodes.set(nodeId, {
          ...currentNode,
          loadState: "error",
        });
      }

      const currentOps = new Map(get().activeOperations);
      currentOps.delete(nodeId);

      // No index update: only loadState changed, no names were added.
      set({
        treeNodes: currentNodes,
        activeOperations: currentOps,
      });
    }
  },

  collapseNode: (nodeId: string) => {
    const nextExpanded = new Set(get().expandedIds);
    nextExpanded.delete(nodeId);
    set({ expandedIds: nextExpanded });
  },

  cancelLoad: async (nodeId: string) => {
    const { activeOperations, treeNodes } = get();
    const operationId = activeOperations.get(nodeId);

    if (operationId) {
      try {
        await explorerService.cancelDirectory(operationId);
      } catch {
        // Best-effort cancel
      }
    }

    const nextNodes = new Map(treeNodes);
    const node = nextNodes.get(nodeId);
    if (node) {
      nextNodes.set(nodeId, {
        ...node,
        loadState: "idle",
        children: null,
      });
    }

    const nextExpanded = new Set(get().expandedIds);
    nextExpanded.delete(nodeId);

    const nextOps = new Map(activeOperations);
    nextOps.delete(nodeId);

    // No index update: cancelled nodes keep their names; stale entries are
    // harmless (index only widens filename-filter coverage).
    set({
      treeNodes: nextNodes,
      expandedIds: nextExpanded,
      activeOperations: nextOps,
    });
  },

  setFilterText: (text: string) => {
    // Debounce the filter the tree derives visibility from; clearing is
    // instant so escape/clear feels immediate.
    set({ filterInputText: text });
    if (filterDebounce) clearTimeout(filterDebounce);
    if (!text.trim()) {
      filterDebounce = null;
      set({ filterText: text });
      return;
    }
    filterDebounce = setTimeout(() => {
      filterDebounce = null;
      set({ filterText: text });
    }, 150);
  },

  toggleDateSort: () =>
    set((state) => ({
      dateSortOrder: state.dateSortOrder === "newest" ? "oldest" : "newest",
    })),

  setDateRange: (range: DateRange) => set({ dateRange: range }),

  toggleFavorite: async (sourceId: string, folderPath: string) => {
    try {
      const updatedSettings = await explorerService.toggleFavorite(
        sourceId,
        folderPath
      );
      const updatedSources = updatedSettings.folderSources ?? [];

      const nextNodes = new Map(get().treeNodes);
      const source = updatedSources.find((s) => s.id === sourceId);
      if (source) {
        // Update isFavorite on all directory nodes belonging to this source
        for (const [id, node] of nextNodes) {
          if (
            node.isDir &&
            (id === source.path ||
              id.startsWith(source.path + "/") ||
              id.startsWith(source.path + "\\"))
          ) {
            const shouldBeFav = source.favorites.includes(node.path);
            if (node.isFavorite !== shouldBeFav) {
              const updated = { ...node, isFavorite: shouldBeFav };
              nextNodes.set(id, updated);
              // Also update in parent's children array
              for (const [, parent] of nextNodes) {
                if (parent.children?.some((c) => c.id === id)) {
                  nextNodes.set(parent.id, {
                    ...parent,
                    children: parent.children.map((c) =>
                      c.id === id ? updated : c
                    ),
                  });
                  break;
                }
              }
            }
          }
        }
      }

      // No index update: favorites don't change names.
      set({
        folderSources: updatedSources,
        treeNodes: nextNodes,
      });
    } catch {
      showToast({
        type: "error",
        title: "Failed to update favorite",
        message: "The favorite could not be saved",
        duration: 5000,
      });
    }
  },

  reorderSources: (newSources: FolderSource[]) =>
    set({ folderSources: newSources }),

  saveSources: async () => {
    const { folderSources } = get();
    try {
      await settingsService.saveSettings({ folderSources });

      // Reconcile instead of resetting: reorders and label edits keep
      // loaded subtrees; added or repointed sources start fresh.
      set(reconcileTreeWithSources(get(), folderSources));
    } catch {
      showToast({
        type: "error",
        title: "Failed to save sources",
        message: "Folder source changes could not be persisted",
        duration: 5000,
      });
    }
  },

  setSelectedPath: (path: string | null) => set({ selectedPath: path }),

  setFocusedPath: (path: string | null) => set({ focusedPath: path }),

  revealPath: async (path: string) => {
    const { folderSources } = get();
    const source = folderSources.find((s) => belongsToSource(path, s));
    if (!source) return;

    const sep = source.path.includes("\\") ? "\\" : "/";
    // Ancestor chain: source root id, then each intermediate folder path.
    const chain: string[] = [source.id];
    if (path !== source.path) {
      const parts = path.slice(source.path.length + 1).split(/[/\\]/);
      let current = source.path;
      for (let i = 0; i < parts.length - 1; i++) {
        current = current + sep + parts[i];
        chain.push(current);
      }
    }

    for (const id of chain) {
      const node = get().treeNodes.get(id);
      if (!node || !node.isDir) return;
      if (node.loadState === "loaded" && node.children) {
        if (!get().expandedIds.has(id)) {
          const next = new Set(get().expandedIds);
          next.add(id);
          set({ expandedIds: next });
        }
      } else {
        await get().expandNode(id);
        if (get().treeNodes.get(id)?.loadState !== "loaded") return;
      }
    }

    set({ selectedPath: path });
  },
});
