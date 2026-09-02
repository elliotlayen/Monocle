import { confirm } from "@tauri-apps/plugin-dialog";
import type {
  FileTab,
  ViewMode,
  ValidationProblem,
  ValidationStatus,
} from "../types";
import { explorerService } from "../services/explorer-service";
import { showToast } from "@/features/notifications/store";
import { formatFileSize } from "../utils/file-size-format";
import { disambiguateTabNames } from "../utils/tab-disambiguator";
import { parseXml } from "../utils/xml-parser";
import { appendBounded, VALIDATION_CACHE_MAX } from "./bounded-cache";
import type { SliceCreator } from "./store-types";

/** Most-recently-opened file paths kept for quick-open. */
const RECENT_FILES_MAX = 50;

/** Files above this open in source view only, after confirmation. */
const LARGE_FILE_CONFIRM_BYTES = 5 * 1024 * 1024;
/** Files above this are refused (matches the backend scan cap). */
const MAX_OPEN_FILE_BYTES = 50 * 1024 * 1024;

export interface TabsSlice {
  tabs: FileTab[];
  activeTabId: string | null;
  recentFilePaths: string[];
  validationCache: Map<
    string,
    { problems: ValidationProblem[]; encoding: string; hasBom: boolean }
  >;
  problemsPanelOpen: boolean;
  problemsPanelHeight: number;
  pendingJump: { tabId: string; line: number; column: number } | null;

  openFile: (filePath: string) => Promise<void>;
  closeTab: (tabId: string) => void;
  closeOtherTabs: (tabId: string) => void;
  closeAllTabs: () => void;
  setActiveTab: (tabId: string) => void;
  setViewMode: (tabId: string, mode: ViewMode) => void;
  setScrollPosition: (tabId: string, view: ViewMode, position: number) => void;
  setTreeExpandedIds: (tabId: string, ids: string[]) => void;
  setTreeViewport: (
    tabId: string,
    viewport: { x: number; y: number; zoom: number } | null
  ) => void;
  setMonacoViewState: (tabId: string, state: unknown | null) => void;
  toggleProblemsPanel: () => void;
  setProblemsPanelHeight: (height: number) => void;
  jumpToProblem: (tabId: string, line: number, column: number) => void;
  clearPendingJump: () => void;
  getValidationStatus: (filePath: string) => ValidationStatus | undefined;
}

export function recomputeTabNames(tabs: FileTab[]): FileTab[] {
  const displayNames = disambiguateTabNames(tabs);
  return tabs.map((tab) => ({
    ...tab,
    fileName: displayNames.get(tab.filePath) ?? tab.fileName,
  }));
}

export const createTabsSlice: SliceCreator<TabsSlice> = (set, get) => ({
  tabs: [],
  activeTabId: null,
  recentFilePaths: [],
  validationCache: new Map(),
  problemsPanelOpen: false,
  problemsPanelHeight: 200,
  pendingJump: null,

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

    // Size-gate before pulling content over the wire. A failed stat falls
    // through; read_file_cmd will surface any real error.
    let sourceOnly = false;
    try {
      const stat = await explorerService.fileStat(filePath);
      if (stat.size > MAX_OPEN_FILE_BYTES) {
        showToast({
          type: "error",
          title: "File too large to open",
          message: `${fileName} is ${formatFileSize(stat.size)}; the limit is ${formatFileSize(MAX_OPEN_FILE_BYTES)}`,
          duration: 5000,
        });
        return;
      }
      if (stat.size > LARGE_FILE_CONFIRM_BYTES) {
        const proceed = await confirm(
          `${fileName} is ${formatFileSize(stat.size)}. Open it in source view only? The XML tree and formatting are disabled for large files.`,
          { title: "Large file", kind: "warning" }
        );
        if (!proceed) return;
        sourceOnly = true;
      }
    } catch {
      // Stat is a best-effort optimization; proceed without it.
    }

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
      sourceOnly,
    };

    const updatedTabs = recomputeTabNames([...tabs, newTab]);
    const recent = [
      filePath,
      ...get().recentFilePaths.filter((p) => p !== filePath),
    ].slice(0, RECENT_FILES_MAX);
    set({ tabs: updatedTabs, activeTabId: filePath, recentFilePaths: recent });

    try {
      const result = await explorerService.readFile(filePath);
      const currentTabs = get().tabs;
      const tabIndex = currentTabs.findIndex((t) => t.id === filePath);
      if (tabIndex === -1) return;

      let parseError = false;
      if (isXml && !sourceOnly) {
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

      // Update validation cache (bounded, oldest entries evicted)
      const nextCache = appendBounded(
        get().validationCache,
        [
          [
            filePath,
            {
              problems: result.problems,
              encoding: result.encoding,
              hasBom: result.hasBom,
            },
          ] as const,
        ],
        VALIDATION_CACHE_MAX
      );

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
        scanFiles: [],
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
      scanFiles: [],
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

  setTreeViewport: (
    tabId: string,
    viewport: { x: number; y: number; zoom: number } | null
  ) => {
    const { tabs } = get();
    const updated = tabs.map((t) =>
      t.id === tabId ? { ...t, treeViewport: viewport } : t
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

  getValidationStatus: (filePath: string): ValidationStatus | undefined => {
    const cached = get().validationCache.get(filePath);
    if (!cached) return undefined;
    if (cached.problems.some((p) => p.severity === "error")) return "error";
    if (cached.problems.some((p) => p.severity === "warning")) return "warning";
    return "clean";
  },
});
