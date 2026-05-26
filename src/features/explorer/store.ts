import { create } from "zustand";
import type { FolderSource, TreeNode, DirEntry, FileTab, ViewMode } from "./types";
import { explorerService } from "./services/explorer-service";
import { settingsService } from "@/features/settings/services/settings-service";
import { showToast } from "@/features/notifications/store";
import { disambiguateTabNames } from "./utils/tab-disambiguator";
import { parseXml } from "./utils/xml-parser";

interface ExplorerStore {
  // State
  folderSources: FolderSource[];
  treeNodes: Map<string, TreeNode>;
  expandedIds: Set<string>;
  activeOperations: Map<string, string>;
  filterText: string;
  dateSortOrder: "newest" | "oldest";
  sidebarOpen: boolean;
  sidebarWidth: number;
  tabs: FileTab[];
  activeTabId: string | null;

  // Actions
  loadSources: () => Promise<void>;
  expandNode: (nodeId: string) => Promise<void>;
  collapseNode: (nodeId: string) => void;
  cancelLoad: (nodeId: string) => Promise<void>;
  setFilterText: (text: string) => void;
  toggleDateSort: () => void;
  toggleFavorite: (sourceId: string, clientName: string) => Promise<void>;
  setSidebarOpen: (open: boolean) => void;
  setSidebarWidth: (width: number) => void;
  reorderSources: (newSources: FolderSource[]) => void;
  saveSources: () => Promise<void>;
  openFile: (filePath: string) => Promise<void>;
  closeTab: (tabId: string) => void;
  closeOtherTabs: (tabId: string) => void;
  closeAllTabs: () => void;
  setActiveTab: (tabId: string) => void;
  setViewMode: (tabId: string, mode: ViewMode) => void;
  setScrollPosition: (tabId: string, view: ViewMode, position: number) => void;
  setTreeExpandedIds: (tabId: string, ids: string[]) => void;
  setMonacoViewState: (tabId: string, state: unknown | null) => void;
}

function buildChildNodes(
  entries: DirEntry[],
  parentNode: TreeNode,
  folderSources: FolderSource[]
): TreeNode[] {
  return entries.map((entry) => {
    let nodeType: TreeNode["type"] = "file";
    if (entry.isDir) {
      if (parentNode.type === "source") {
        nodeType = "client";
      } else if (parentNode.type === "client") {
        nodeType = "date";
      }
    }

    let isFavorite: boolean | undefined;
    if (nodeType === "client") {
      const source = folderSources.find((s) => s.id === parentNode.id);
      if (source) {
        isFavorite = source.favorites.includes(entry.name);
      }
    }

    return {
      id: entry.path,
      path: entry.path,
      name: entry.name,
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

function recomputeTabNames(tabs: FileTab[]): FileTab[] {
  const displayNames = disambiguateTabNames(tabs);
  return tabs.map((tab) => ({
    ...tab,
    fileName: displayNames.get(tab.filePath) ?? tab.fileName,
  }));
}

export const useExplorerStore = create<ExplorerStore>((set, get) => ({
  // Initial state
  folderSources: [],
  treeNodes: new Map(),
  expandedIds: new Set(),
  activeOperations: new Map(),
  filterText: "",
  dateSortOrder: "newest",
  sidebarOpen: true,
  sidebarWidth: 280,
  tabs: [],
  activeTabId: null,

  loadSources: async () => {
    try {
      const settings = await settingsService.getSettings();
      const sources = settings.folderSources ?? [];
      const sidebarWidth = settings.explorerSidebarWidth ?? 280;

      const treeNodes = new Map<string, TreeNode>();
      for (const source of sources) {
        treeNodes.set(source.id, buildSourceNode(source));
      }

      set({
        folderSources: sources,
        treeNodes,
        expandedIds: new Set(),
        activeOperations: new Map(),
        sidebarWidth,
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

      set({ treeNodes: currentNodes, activeOperations: currentOps });
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
      expandedIds: nextExpanded,
      activeOperations: nextOps,
    });
  },

  setFilterText: (text: string) => set({ filterText: text }),

  toggleDateSort: () =>
    set((state) => ({
      dateSortOrder: state.dateSortOrder === "newest" ? "oldest" : "newest",
    })),

  toggleFavorite: async (sourceId: string, clientName: string) => {
    try {
      const updatedSettings =
        await explorerService.toggleFavorite(sourceId, clientName);
      const updatedSources = updatedSettings.folderSources ?? [];

      // Update local folder sources
      const nextNodes = new Map(get().treeNodes);
      const source = updatedSources.find((s) => s.id === sourceId);
      if (source) {
        // Update isFavorite on matching client nodes
        const sourceNode = nextNodes.get(sourceId);
        if (sourceNode?.children) {
          for (const child of sourceNode.children) {
            if (child.type === "client") {
              const updatedChild = {
                ...child,
                isFavorite: source.favorites.includes(child.name),
              };
              nextNodes.set(child.id, updatedChild);
            }
          }
          // Also update the children array on the source node
          nextNodes.set(sourceId, {
            ...sourceNode,
            children: sourceNode.children.map((child) =>
              child.type === "client"
                ? {
                    ...child,
                    isFavorite: source.favorites.includes(child.name),
                  }
                : child
            ),
          });
        }
      }

      set({ folderSources: updatedSources, treeNodes: nextNodes });
    } catch {
      // Silently handle toggle failure
    }
  },

  setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),

  setSidebarWidth: (width: number) => {
    set({ sidebarWidth: width });
    settingsService
      .saveSettings({ explorerSidebarWidth: width })
      .catch(() => {});
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

      set({ treeNodes, expandedIds: new Set(), activeOperations: new Map() });
    } catch {
      // Silently handle save failure
    }
  },

  openFile: async (filePath: string) => {
    const { tabs } = get();

    // Check if tab already exists -- switch to it (D-14)
    const existing = tabs.find((t) => t.filePath === filePath);
    if (existing) {
      set({ activeTabId: existing.id });
      return;
    }

    // Extract filename from path
    const fileName = filePath.split(/[/\\]/).pop() ?? filePath;
    const isXml = /\.xml$/i.test(fileName);

    // Create new tab with loading state
    const newTab: FileTab = {
      id: filePath,
      filePath,
      fileName,
      content: "",
      fileSize: 0,
      viewMode: "source",
      scrollPosition: { source: 0, tree: 0 },
      treeExpandedIds: [],
      monacoViewState: null,
      isXml,
      parseError: false,
      isLoading: true,
    };

    const updatedTabs = recomputeTabNames([...tabs, newTab]);
    set({ tabs: updatedTabs, activeTabId: filePath });

    try {
      const result = await explorerService.readFile(filePath);
      const currentTabs = get().tabs;
      const tabIndex = currentTabs.findIndex((t) => t.id === filePath);
      if (tabIndex === -1) return;

      let parseError = false;
      if (isXml) {
        const parseResult = parseXml(result.content);
        parseError = parseResult.error !== null;
      }

      const updated = [...currentTabs];
      updated[tabIndex] = {
        ...updated[tabIndex],
        content: result.content,
        fileSize: result.size,
        isLoading: false,
        parseError,
        ...(parseError ? { viewMode: "source" as const } : {}),
      };

      set({ tabs: recomputeTabNames(updated) });
    } catch {
      // Remove the failed tab and show error toast
      const currentTabs = get().tabs;
      const filtered = currentTabs.filter((t) => t.id !== filePath);
      const activeTabId =
        filtered.length > 0 ? filtered[filtered.length - 1].id : null;

      set({ tabs: recomputeTabNames(filtered), activeTabId });

      showToast({
        type: "error",
        title: "Failed to read file",
        message: "Check that the file still exists and is accessible",
        duration: 5000,
      });
    }
  },

  closeTab: (tabId: string) => {
    const { tabs, activeTabId } = get();
    const index = tabs.findIndex((t) => t.id === tabId);
    if (index === -1) return;

    const filtered = tabs.filter((t) => t.id !== tabId);

    let newActiveTabId = activeTabId;
    if (activeTabId === tabId) {
      if (filtered.length === 0) {
        newActiveTabId = null;
      } else if (index < filtered.length) {
        // Right neighbor exists
        newActiveTabId = filtered[index].id;
      } else {
        // Was rightmost, go to left neighbor
        newActiveTabId = filtered[filtered.length - 1].id;
      }
    }

    set({ tabs: recomputeTabNames(filtered), activeTabId: newActiveTabId });
  },

  closeOtherTabs: (tabId: string) => {
    const { tabs } = get();
    const kept = tabs.filter((t) => t.id === tabId);
    set({ tabs: recomputeTabNames(kept), activeTabId: tabId });
  },

  closeAllTabs: () => {
    set({ tabs: [], activeTabId: null });
  },

  setActiveTab: (tabId: string) => {
    set({ activeTabId: tabId });
  },

  setViewMode: (tabId: string, mode: ViewMode) => {
    const { tabs } = get();
    const updated = tabs.map((t) =>
      t.id === tabId ? { ...t, viewMode: mode } : t
    );
    set({ tabs: updated });
  },

  setScrollPosition: (tabId: string, view: ViewMode, position: number) => {
    const { tabs } = get();
    const updated = tabs.map((t) =>
      t.id === tabId
        ? { ...t, scrollPosition: { ...t.scrollPosition, [view]: position } }
        : t
    );
    set({ tabs: updated });
  },

  setTreeExpandedIds: (tabId: string, ids: string[]) => {
    const { tabs } = get();
    const updated = tabs.map((t) =>
      t.id === tabId ? { ...t, treeExpandedIds: ids } : t
    );
    set({ tabs: updated });
  },

  setMonacoViewState: (tabId: string, state: unknown | null) => {
    const { tabs } = get();
    const updated = tabs.map((t) =>
      t.id === tabId ? { ...t, monacoViewState: state } : t
    );
    set({ tabs: updated });
  },
}));
