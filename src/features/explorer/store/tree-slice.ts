import type { FolderSource, TreeNode, DirEntry } from "../types";
import { explorerService } from "../services/explorer-service";
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
  filterText: string;
  dateSortOrder: "newest" | "oldest";
  dateRange: DateRange;
  filenameSearchIndex: Map<string, string>;
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

function buildFilenameSearchIndex(
  treeNodes: Map<string, TreeNode>
): Map<string, string> {
  const index = new Map<string, string>();
  for (const [id, node] of treeNodes) {
    index.set(id, node.name.toLowerCase());
  }
  return index;
}

export const createTreeSlice: SliceCreator<TreeSlice> = (set, get) => ({
  folderSources: [],
  treeNodes: new Map(),
  expandedIds: new Set(),
  activeOperations: new Map(),
  filterText: "",
  dateSortOrder: "newest",
  dateRange: null,
  filenameSearchIndex: new Map<string, string>(),
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

      const treeNodes = new Map<string, TreeNode>();
      for (const source of sources) {
        treeNodes.set(source.id, buildSourceNode(source));
      }

      set({
        folderSources: sources,
        treeNodes,
        filenameSearchIndex: buildFilenameSearchIndex(treeNodes),
        expandedIds: new Set(),
        activeOperations: new Map(),
        sidebarWidth,
        explorerNodeStyle,
      });
    } catch {
      // Silently handle settings load failure
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

      set({
        treeNodes: currentNodes,
        filenameSearchIndex: buildFilenameSearchIndex(currentNodes),
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

      set({
        treeNodes: currentNodes,
        filenameSearchIndex: buildFilenameSearchIndex(currentNodes),
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

    set({
      treeNodes: nextNodes,
      filenameSearchIndex: buildFilenameSearchIndex(nextNodes),
      expandedIds: nextExpanded,
      activeOperations: nextOps,
    });
  },

  setFilterText: (text: string) => set({ filterText: text }),

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

      set({
        folderSources: updatedSources,
        treeNodes: nextNodes,
        filenameSearchIndex: buildFilenameSearchIndex(nextNodes),
      });
    } catch {
      // Silently handle toggle failure
    }
  },

  reorderSources: (newSources: FolderSource[]) =>
    set({ folderSources: newSources }),

  saveSources: async () => {
    const { folderSources } = get();
    try {
      await settingsService.saveSettings({ folderSources });

      // Rebuild root tree nodes from updated sources
      const treeNodes = new Map<string, TreeNode>();
      for (const source of folderSources) {
        treeNodes.set(source.id, buildSourceNode(source));
      }

      set({
        treeNodes,
        filenameSearchIndex: buildFilenameSearchIndex(treeNodes),
        expandedIds: new Set(),
        activeOperations: new Map(),
      });
    } catch {
      // Silently handle save failure
    }
  },

  setSelectedPath: (path: string | null) => set({ selectedPath: path }),

  setFocusedPath: (path: string | null) => set({ focusedPath: path }),
});
