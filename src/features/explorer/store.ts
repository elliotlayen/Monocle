import { create } from "zustand";
import type {
  FolderSource,
  TreeNode,
  DirEntry,
  FileTab,
  ViewMode,
  ValidationProblem,
  ValidationStatus,
  ScanStatus,
  ScanProgressPayload,
  ScanSummary,
  SearchMode,
  SearchStatus,
  SearchResultFile,
  SearchErrorFile,
  SearchProgressPayload as SearchProgressPayloadType,
  SearchSummary,
} from "./types";
import { explorerService } from "./services/explorer-service";
import { settingsService } from "@/features/settings/services/settings-service";
import { showToast } from "@/features/notifications/store";
import { disambiguateTabNames } from "./utils/tab-disambiguator";
import { parseXml } from "./utils/xml-parser";
import { computeAggregateBadges } from "./utils/badge-aggregation";

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
  validationCache: Map<
    string,
    { problems: ValidationProblem[]; encoding: string; hasBom: boolean }
  >;
  problemsPanelOpen: boolean;
  problemsPanelHeight: number;
  pendingJump: { tabId: string; line: number; column: number } | null;

  // Scan state
  scanStatus: ScanStatus;
  scanOperationId: string | null;
  scanFolderPath: string | null;
  scanFolderName: string | null;
  scanFilePattern: string;
  scanProgress: ScanProgressPayload | null;
  scanResult: ScanSummary | null;
  folderBadgeCache: Map<string, ValidationStatus>;
  lastInteractedFolderPath: string | null;
  pendingScanRequest: {
    folderPath: string;
    filePattern: string;
  } | null;

  // Search state
  searchMode: SearchMode;
  searchQuery: string;
  searchCheckedPaths: Set<string>;
  searchFilePattern: string;
  searchStatus: SearchStatus;
  searchProgress: SearchProgressPayloadType | null;
  searchResults: SearchResultFile[];
  searchErrors: SearchErrorFile[];
  searchSummary: SearchSummary | null;
  searchOperationId: string | null;
  activeSearchTerms: string[] | null;

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
  toggleProblemsPanel: () => void;
  setProblemsPanelHeight: (height: number) => void;
  jumpToProblem: (tabId: string, line: number, column: number) => void;
  clearPendingJump: () => void;
  getValidationStatus: (filePath: string) => ValidationStatus | undefined;

  // Scan actions
  requestScan: (folderPath: string, filePattern: string) => void;
  startScan: (folderPath: string, filePattern: string) => Promise<void>;
  updateScanProgress: (payload: ScanProgressPayload) => void;
  cancelScan: () => Promise<void>;
  clearScanResult: () => void;
  setScanFilePattern: (pattern: string) => void;
  setLastInteractedFolder: (path: string) => void;
  getFolderBadge: (folderPath: string) => ValidationStatus | undefined;
  confirmPendingScan: () => void;
  dismissPendingScan: () => void;

  // Search actions
  setSearchMode: (mode: SearchMode) => void;
  setSearchQuery: (text: string) => void;
  toggleSearchCheck: (path: string) => void;
  setSearchFilePattern: (pattern: string) => void;
  startContentSearch: (folderPaths: string[], scopeLabel: string) => Promise<void>;
  updateSearchProgress: (payload: SearchProgressPayloadType) => void;
  appendSearchResult: (payload: SearchResultFile) => void;
  cancelContentSearch: () => Promise<void>;
  clearSearchResults: () => void;
  setActiveSearchTerms: (terms: string[] | null) => void;
}

function buildChildNodes(
  entries: DirEntry[],
  parentNode: TreeNode,
  folderSources: FolderSource[]
): TreeNode[] {
  return entries.map((entry) => {
    const nodeType: TreeNode["type"] = entry.isDir ? "folder" : "file";

    let isFavorite: boolean | undefined;
    if (entry.isDir && parentNode.type === "source") {
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

/**
 * Parse search query into individual terms (frontend port of Rust parse_search_terms).
 * Splits on spaces, handles quoted phrases, lowercases all terms.
 */
export function parseSearchTermsFrontend(query: string): string[] {
  const terms: string[] = [];
  const trimmed = query.trim();
  if (!trimmed) return terms;

  let current = "";
  let inQuotes = false;

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === '"') {
      if (inQuotes) {
        // End of quoted phrase
        if (current) terms.push(current.toLowerCase());
        current = "";
        inQuotes = false;
      } else {
        // Start of quoted phrase -- push anything accumulated so far
        if (current) terms.push(current.toLowerCase());
        current = "";
        inQuotes = true;
      }
    } else if (ch === " " && !inQuotes) {
      if (current) terms.push(current.toLowerCase());
      current = "";
    } else {
      current += ch;
    }
  }

  if (current) terms.push(current.toLowerCase());
  return terms;
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
  validationCache: new Map(),
  problemsPanelOpen: false,
  problemsPanelHeight: 200,
  pendingJump: null,

  // Scan initial state
  scanStatus: "idle",
  scanOperationId: null,
  scanFolderPath: null,
  scanFolderName: null,
  scanFilePattern: "*.xml",
  scanProgress: null,
  scanResult: null,
  folderBadgeCache: new Map(),
  lastInteractedFolderPath: null,
  pendingScanRequest: null,

  // Search initial state
  searchMode: "filename",
  searchQuery: "",
  searchCheckedPaths: new Set<string>(),
  searchFilePattern: "*.xml",
  searchStatus: "idle",
  searchProgress: null,
  searchResults: [],
  searchErrors: [],
  searchSummary: null,
  searchOperationId: null,
  activeSearchTerms: null,

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
        const sourceNode = nextNodes.get(sourceId);
        if (sourceNode?.children) {
          for (const child of sourceNode.children) {
            if (child.isDir) {
              const updatedChild = {
                ...child,
                isFavorite: source.favorites.includes(child.name),
              };
              nextNodes.set(child.id, updatedChild);
            }
          }
          nextNodes.set(sourceId, {
            ...sourceNode,
            children: sourceNode.children.map((child) =>
              child.isDir
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
      // Auto-show problems panel if cached validation has problems (D-02)
      const cached = get().validationCache.get(filePath);
      if (cached && cached.problems.length > 0) {
        set({ activeTabId: existing.id, problemsPanelOpen: true });
      } else {
        set({ activeTabId: existing.id });
      }
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
      problems: [],
      encoding: "",
      hasBom: false,
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
        problems: result.problems,
        encoding: result.encoding,
        hasBom: result.hasBom,
        ...(parseError ? { viewMode: "source" as const } : {}),
      };

      // Update validation cache with new Map instance
      const nextCache = new Map(get().validationCache);
      nextCache.set(filePath, {
        problems: result.problems,
        encoding: result.encoding,
        hasBom: result.hasBom,
      });

      // Auto-show problems panel if issues found (D-02)
      const hasProblems = result.problems.length > 0;
      set({
        tabs: recomputeTabNames(updated),
        validationCache: nextCache,
        ...(hasProblems ? { problemsPanelOpen: true } : {}),
      });
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

    // Clear scan result when closing scan results tab
    if (tabId === "scan:results") {
      set({
        tabs: recomputeTabNames(filtered),
        activeTabId: newActiveTabId,
        scanStatus: "idle",
        scanResult: null,
        scanProgress: null,
      });
      return;
    }

    set({ tabs: recomputeTabNames(filtered), activeTabId: newActiveTabId });
  },

  closeOtherTabs: (tabId: string) => {
    const { tabs } = get();
    const kept = tabs.filter((t) => t.id === tabId);
    set({ tabs: recomputeTabNames(kept), activeTabId: tabId });
  },

  closeAllTabs: () => {
    set({
      tabs: [],
      activeTabId: null,
      scanStatus: "idle",
      scanResult: null,
      scanProgress: null,
    });
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

  toggleProblemsPanel: () => {
    set((state) => ({ problemsPanelOpen: !state.problemsPanelOpen }));
  },

  setProblemsPanelHeight: (height: number) => {
    set({ problemsPanelHeight: Math.max(100, height) });
  },

  jumpToProblem: (tabId: string, line: number, column: number) => {
    const { tabs } = get();
    const tab = tabs.find((t) => t.id === tabId);
    if (!tab) return;

    if (tab.viewMode === "tree") {
      const updated = tabs.map((t) =>
        t.id === tabId ? { ...t, viewMode: "source" as const } : t
      );
      set({ tabs: updated, pendingJump: { tabId, line, column } });
    } else {
      set({ pendingJump: { tabId, line, column } });
    }
  },

  clearPendingJump: () => {
    set({ pendingJump: null });
  },

  getValidationStatus: (
    filePath: string
  ): ValidationStatus | undefined => {
    const cached = get().validationCache.get(filePath);
    if (!cached) return undefined;
    if (cached.problems.some((p) => p.severity === "error")) return "error";
    if (cached.problems.some((p) => p.severity === "warning")) return "warning";
    return "clean";
  },

  // Scan actions

  requestScan: (folderPath: string, filePattern: string) => {
    const { scanStatus } = get();
    if (scanStatus === "scanning") {
      // Store pending request for confirmation dialog (D-04)
      set({ pendingScanRequest: { folderPath, filePattern } });
    } else {
      get().startScan(folderPath, filePattern);
    }
  },

  startScan: async (folderPath: string, filePattern: string) => {
    const operationId = crypto.randomUUID();
    const folderName = folderPath.split(/[/\\]/).pop() ?? folderPath;

    // Remove existing scan:results tab before starting new scan (Open Q2)
    const existingTabs = get().tabs.filter((t) => t.id !== "scan:results");

    set({
      scanStatus: "scanning",
      scanOperationId: operationId,
      scanFolderPath: folderPath,
      scanFolderName: folderName,
      scanProgress: null,
      scanResult: null,
      pendingScanRequest: null,
      tabs: recomputeTabNames(existingTabs),
      ...(get().activeTabId === "scan:results"
        ? {
            activeTabId:
              existingTabs.length > 0
                ? existingTabs[existingTabs.length - 1].id
                : null,
          }
        : {}),
    });

    try {
      const result = await explorerService.bulkScan(
        folderPath,
        filePattern,
        operationId
      );

      // Update validation cache with all file results
      const nextCache = new Map(get().validationCache);
      for (const file of result.files) {
        nextCache.set(file.filePath, {
          problems: file.problems,
          encoding: file.encoding,
          hasBom: file.hasBom,
        });
      }

      // Compute folder badge cache
      const folderBadges = computeAggregateBadges(result.files, folderPath);

      // Create synthetic scan results tab (D-12)
      const scanTab: FileTab = {
        id: "scan:results",
        filePath: "scan:results",
        fileName: `Scan Results - ${folderName}`,
        content: "",
        fileSize: 0,
        viewMode: "source",
        scrollPosition: { source: 0, tree: 0 },
        treeExpandedIds: [],
        monacoViewState: null,
        isXml: false,
        parseError: false,
        isLoading: false,
        problems: [],
        encoding: "",
        hasBom: false,
        isScanResult: true,
      };

      const currentTabs = get().tabs.filter((t) => t.id !== "scan:results");
      const updatedTabs = recomputeTabNames([...currentTabs, scanTab]);

      set({
        scanStatus: result.cancelled ? "cancelled" : "completed",
        scanResult: result,
        scanOperationId: null,
        validationCache: nextCache,
        folderBadgeCache: folderBadges,
        tabs: updatedTabs,
        activeTabId: "scan:results",
      });
    } catch {
      set({
        scanStatus: "idle",
        scanOperationId: null,
      });
      showToast({
        type: "error",
        title: "Scan failed",
        message: "An error occurred while scanning the folder",
        duration: 5000,
      });
    }
  },

  updateScanProgress: (payload: ScanProgressPayload) => {
    // Update validation cache entry for the scanned file
    const nextCache = new Map(get().validationCache);
    nextCache.set(payload.filePath, {
      problems: [], // Minimal entry; full problems come with ScanSummary
      encoding: "",
      hasBom: false,
    });

    // Set a synthetic problem entry based on status so getValidationStatus works
    if (payload.status === "error") {
      nextCache.set(payload.filePath, {
        problems: [
          {
            line: 0,
            column: 0,
            endColumn: 0,
            message: "Has errors (details available after scan completes)",
            severity: "error",
            code: "scan-preview",
          },
        ],
        encoding: "",
        hasBom: false,
      });
    } else if (payload.status === "warning") {
      nextCache.set(payload.filePath, {
        problems: [
          {
            line: 0,
            column: 0,
            endColumn: 0,
            message: "Has warnings (details available after scan completes)",
            severity: "warning",
            code: "scan-preview",
          },
        ],
        encoding: "",
        hasBom: false,
      });
    }

    set({ scanProgress: payload, validationCache: nextCache });
  },

  cancelScan: async () => {
    const { scanOperationId } = get();
    if (scanOperationId) {
      try {
        await explorerService.cancelScan(scanOperationId);
      } catch {
        // Best-effort cancel
      }
    }
  },

  clearScanResult: () => {
    set({
      scanStatus: "idle",
      scanResult: null,
      scanProgress: null,
    });
  },

  setScanFilePattern: (pattern: string) => {
    set({ scanFilePattern: pattern });
  },

  setLastInteractedFolder: (path: string) => {
    set({ lastInteractedFolderPath: path });
  },

  getFolderBadge: (folderPath: string): ValidationStatus | undefined => {
    return get().folderBadgeCache.get(folderPath);
  },

  confirmPendingScan: () => {
    const { pendingScanRequest } = get();
    if (!pendingScanRequest) return;

    const { folderPath, filePattern } = pendingScanRequest;
    // Cancel current scan, then start new one
    const doIt = async () => {
      await get().cancelScan();
      // Small delay to allow cancellation to propagate
      await new Promise((resolve) => setTimeout(resolve, 100));
      get().startScan(folderPath, filePattern);
    };
    doIt().catch(() => {
      showToast({
        type: "error",
        title: "Failed to start scan",
        message: "An error occurred while restarting the scan",
        duration: 5000,
      });
    });
  },

  dismissPendingScan: () => {
    set({ pendingScanRequest: null });
  },

  // Search actions

  setSearchMode: (mode: SearchMode) => {
    const { searchMode: currentMode, searchResults, searchQuery } = get();
    if (currentMode === "content" && mode === "filename" && searchResults.length > 0) {
      // Switching from content to filename with results: clear search state, sync query to filterText
      set({
        searchMode: mode,
        searchResults: [],
        searchErrors: [],
        searchSummary: null,
        searchStatus: "idle",
        activeSearchTerms: null,
        filterText: searchQuery,
      });
    } else if (mode === "filename") {
      // Switching to filename: sync query to filterText
      set({ searchMode: mode, filterText: searchQuery });
    } else {
      set({ searchMode: mode });
    }
  },

  setSearchQuery: (text: string) => {
    const { searchMode } = get();
    if (searchMode === "filename") {
      set({ searchQuery: text, filterText: text });
    } else {
      set({ searchQuery: text });
      if (!text) {
        get().clearSearchResults();
      }
    }
  },

  toggleSearchCheck: (path: string) => {
    const prev = get().searchCheckedPaths;
    const next = new Set(prev);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
      // Remove any descendant paths — parent already covers them
      for (const p of next) {
        if (p !== path && p.startsWith(path + "/")) next.delete(p);
        if (p !== path && p.startsWith(path + "\\")) next.delete(p);
      }
    }
    set({ searchCheckedPaths: next });
  },

  setSearchFilePattern: (pattern: string) => {
    set({ searchFilePattern: pattern });
  },

  startContentSearch: async (folderPaths: string[], scopeLabel: string) => {
    const { searchQuery, searchFilePattern } = get();
    const operationId = crypto.randomUUID();

    set({
      searchStatus: "searching",
      searchOperationId: operationId,
      searchResults: [],
      searchErrors: [],
      searchProgress: null,
      searchSummary: null,
    });

    try {
      const result = await explorerService.contentSearch(
        searchQuery,
        JSON.stringify(folderPaths),
        searchFilePattern,
        scopeLabel,
        operationId
      );

      set({
        searchStatus: result.cancelled ? "cancelled" : "completed",
        searchSummary: result,
        searchOperationId: null,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const isNetworkError =
        message.toLowerCase().includes("unreachable") ||
        message.toLowerCase().includes("network");

      set({
        searchStatus: "idle",
        searchOperationId: null,
      });

      if (isNetworkError) {
        const filesScanned = get().searchProgress?.filesScanned ?? 0;
        showToast({
          type: "error",
          title: "Network share unreachable",
          message: `Search stopped after ${filesScanned} files.`,
          duration: 5000,
        });
      } else {
        showToast({
          type: "error",
          title: "Search failed",
          message: "An error occurred while searching",
          duration: 5000,
        });
      }
    }
  },

  updateSearchProgress: (payload: SearchProgressPayloadType) => {
    const { searchOperationId } = get();
    if (payload.operationId !== searchOperationId) return;
    set({ searchProgress: payload });
  },

  appendSearchResult: (payload: SearchResultFile) => {
    if (payload.fileName.startsWith("ERROR:")) {
      // Parse as error file
      const errorFile: SearchErrorFile = {
        filePath: payload.filePath,
        fileName: payload.fileName,
        parentFolder: payload.parentFolder,
        errorMessage: payload.fileName.substring("ERROR:".length).trim(),
      };
      set((state) => ({
        searchErrors: [...state.searchErrors, errorFile],
      }));
    } else {
      set((state) => {
        if (state.searchResults.some((r) => r.filePath === payload.filePath)) return state;
        const updated = [...state.searchResults, payload];
        updated.sort((a, b) => a.fileName.localeCompare(b.fileName));
        return { searchResults: updated };
      });
    }
  },

  cancelContentSearch: async () => {
    const { searchOperationId } = get();
    if (searchOperationId) {
      try {
        await explorerService.cancelScan(searchOperationId);
      } catch {
        // Best-effort cancel
      }
    }
  },

  clearSearchResults: () => {
    set({
      searchResults: [],
      searchErrors: [],
      searchSummary: null,
      searchProgress: null,
      searchStatus: "idle",
      activeSearchTerms: null,
      searchCheckedPaths: new Set<string>(),
    });
  },

  setActiveSearchTerms: (terms: string[] | null) => {
    set({ activeSearchTerms: terms });
  },
}));
