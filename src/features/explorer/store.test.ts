// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useExplorerStore } from "./store";
import { settingsService } from "@/features/settings/services/settings-service";

vi.mock("./services/explorer-service", () => ({
  explorerService: {
    listDirectory: vi.fn(),
    cancelDirectory: vi.fn(),
    checkPathReachable: vi.fn(),
    toggleFavorite: vi.fn(),
    readFile: vi.fn().mockResolvedValue({
      content: "<root/>",
      size: 7,
      problems: [],
      encoding: "UTF-8",
      hasBom: false,
    }),
    bulkScan: vi.fn(),
    cancelScan: vi.fn(),
    contentSearch: vi.fn(),
  },
}));

vi.mock("@/features/settings/services/settings-service", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/settings/services/settings-service")
  >("@/features/settings/services/settings-service");
  return {
    ...actual,
    settingsService: {
      saveSettings: vi.fn().mockResolvedValue({}),
      getSettings: vi.fn().mockResolvedValue({ folderSources: [] }),
    },
  };
});

vi.mock("@/features/notifications/store", () => ({
  showToast: vi.fn(),
}));

describe("explorer store - tab management", () => {
  beforeEach(async () => {
    useExplorerStore.setState({
      tabs: [],
      activeTabId: null,
      validationCache: new Map(),
      problemsPanelOpen: false,
      pendingJump: null,
    });
    vi.clearAllMocks();
    // Re-establish default readFile mock after clearAllMocks
    const { explorerService } = await import("./services/explorer-service");
    vi.mocked(explorerService.readFile).mockResolvedValue({
      content: "<root/>",
      size: 7,
      problems: [],
      encoding: "UTF-8",
      hasBom: false,
    });
  });

  describe("openFile", () => {
    it("creates a new tab with viewMode 'source' and isLoading transitions to false", async () => {
      await useExplorerStore.getState().openFile("/path/to/file1.xml");

      const state = useExplorerStore.getState();
      expect(state.tabs).toHaveLength(1);
      expect(state.tabs[0].viewMode).toBe("source");
      expect(state.tabs[0].isLoading).toBe(false);
      expect(state.tabs[0].filePath).toBe("/path/to/file1.xml");
      expect(state.tabs[0].content).toBe("<root/>");
      expect(state.tabs[0].fileSize).toBe(7);
      expect(state.activeTabId).toBe("/path/to/file1.xml");
    });

    it("switches to existing tab instead of creating a duplicate", async () => {
      await useExplorerStore.getState().openFile("/path/to/file1.xml");
      await useExplorerStore.getState().openFile("/path/to/file2.xml");

      expect(useExplorerStore.getState().tabs).toHaveLength(2);
      expect(useExplorerStore.getState().activeTabId).toBe(
        "/path/to/file2.xml"
      );

      // Open file1 again -- should switch, not create duplicate
      await useExplorerStore.getState().openFile("/path/to/file1.xml");

      expect(useExplorerStore.getState().tabs).toHaveLength(2);
      expect(useExplorerStore.getState().activeTabId).toBe(
        "/path/to/file1.xml"
      );
    });

    it("removes tab and shows error toast on readFile failure", async () => {
      const { explorerService } = await import("./services/explorer-service");
      const { showToast } = await import("@/features/notifications/store");
      vi.mocked(explorerService.readFile).mockRejectedValueOnce(
        new Error("File not found")
      );

      await useExplorerStore.getState().openFile("/path/to/missing.xml");

      expect(useExplorerStore.getState().tabs).toHaveLength(0);
      expect(useExplorerStore.getState().activeTabId).toBeNull();
      expect(showToast).toHaveBeenCalledWith(
        expect.objectContaining({ type: "error" })
      );
    });

    it("detects XML files by extension", async () => {
      await useExplorerStore.getState().openFile("/path/to/data.xml");
      expect(useExplorerStore.getState().tabs[0].isXml).toBe(true);

      await useExplorerStore.getState().openFile("/path/to/readme.txt");
      const txtTab = useExplorerStore
        .getState()
        .tabs.find((t) => t.filePath === "/path/to/readme.txt");
      expect(txtTab?.isXml).toBe(false);
    });
  });

  describe("closeTab", () => {
    beforeEach(async () => {
      await useExplorerStore.getState().openFile("/path/file1.xml");
      await useExplorerStore.getState().openFile("/path/file2.xml");
      await useExplorerStore.getState().openFile("/path/file3.xml");
    });

    it("removes the tab and switches to right neighbor", () => {
      // Active is file3 (last opened). Switch to file2 first.
      useExplorerStore.getState().setActiveTab("/path/file2.xml");
      useExplorerStore.getState().closeTab("/path/file2.xml");

      const state = useExplorerStore.getState();
      expect(state.tabs).toHaveLength(2);
      expect(state.activeTabId).toBe("/path/file3.xml");
    });

    it("switches to left neighbor when closing the rightmost tab", () => {
      useExplorerStore.getState().setActiveTab("/path/file3.xml");
      useExplorerStore.getState().closeTab("/path/file3.xml");

      const state = useExplorerStore.getState();
      expect(state.tabs).toHaveLength(2);
      expect(state.activeTabId).toBe("/path/file2.xml");
    });

    it("sets activeTabId to null when closing the last tab", async () => {
      useExplorerStore.setState({ tabs: [], activeTabId: null });
      await useExplorerStore.getState().openFile("/path/only.xml");

      useExplorerStore.getState().closeTab("/path/only.xml");

      const state = useExplorerStore.getState();
      expect(state.tabs).toHaveLength(0);
      expect(state.activeTabId).toBeNull();
    });
  });

  describe("closeOtherTabs", () => {
    it("removes all tabs except the specified one", async () => {
      await useExplorerStore.getState().openFile("/path/file1.xml");
      await useExplorerStore.getState().openFile("/path/file2.xml");
      await useExplorerStore.getState().openFile("/path/file3.xml");

      useExplorerStore.getState().closeOtherTabs("/path/file2.xml");

      const state = useExplorerStore.getState();
      expect(state.tabs).toHaveLength(1);
      expect(state.tabs[0].filePath).toBe("/path/file2.xml");
      expect(state.activeTabId).toBe("/path/file2.xml");
    });
  });

  describe("closeAllTabs", () => {
    it("sets tabs to empty array and activeTabId to null", async () => {
      await useExplorerStore.getState().openFile("/path/file1.xml");
      await useExplorerStore.getState().openFile("/path/file2.xml");

      useExplorerStore.getState().closeAllTabs();

      const state = useExplorerStore.getState();
      expect(state.tabs).toHaveLength(0);
      expect(state.activeTabId).toBeNull();
    });
  });

  describe("setViewMode", () => {
    it("updates the specified tab's viewMode", async () => {
      await useExplorerStore.getState().openFile("/path/file1.xml");

      useExplorerStore.getState().setViewMode("/path/file1.xml", "tree");

      const tab = useExplorerStore
        .getState()
        .tabs.find((t) => t.filePath === "/path/file1.xml");
      expect(tab?.viewMode).toBe("tree");
    });
  });

  describe("setScrollPosition", () => {
    it("updates the specified tab's scrollPosition for the given view", async () => {
      await useExplorerStore.getState().openFile("/path/file1.xml");

      useExplorerStore
        .getState()
        .setScrollPosition("/path/file1.xml", "source", 150);

      const tab = useExplorerStore
        .getState()
        .tabs.find((t) => t.filePath === "/path/file1.xml");
      expect(tab?.scrollPosition.source).toBe(150);
      expect(tab?.scrollPosition.tree).toBe(0);
    });
  });

  describe("parseError", () => {
    it("sets parseError to true and forces source view for malformed XML", async () => {
      const { explorerService } = await import("./services/explorer-service");
      vi.mocked(explorerService.readFile).mockResolvedValueOnce({
        content: "<root><unclosed>",
        size: 16,
        problems: [],
        encoding: "UTF-8",
        hasBom: false,
      });

      await useExplorerStore.getState().openFile("/path/to/bad.xml");

      const state = useExplorerStore.getState();
      expect(state.tabs[0].parseError).toBe(true);
      expect(state.tabs[0].viewMode).toBe("source");
    });

    it("sets parseError to false for valid XML", async () => {
      const { explorerService } = await import("./services/explorer-service");
      vi.mocked(explorerService.readFile).mockResolvedValueOnce({
        content: "<root/>",
        size: 7,
        problems: [],
        encoding: "UTF-8",
        hasBom: false,
      });

      await useExplorerStore.getState().openFile("/path/to/good.xml");

      const state = useExplorerStore.getState();
      expect(state.tabs[0].parseError).toBe(false);
    });

    it("does not attempt to parse non-XML files (parseError stays false)", async () => {
      const { explorerService } = await import("./services/explorer-service");
      vi.mocked(explorerService.readFile).mockResolvedValueOnce({
        content: "plain text",
        size: 10,
        problems: [],
        encoding: "UTF-8",
        hasBom: false,
      });

      await useExplorerStore.getState().openFile("/path/to/readme.txt");

      const state = useExplorerStore.getState();
      expect(state.tabs[0].parseError).toBe(false);
    });
  });
});

describe("explorer store - scan and search performance state", () => {
  beforeEach(() => {
    useExplorerStore.setState({
      searchResults: [],
      searchErrors: [],
      searchResultPathSet: new Set<string>(),
      searchErrorPathSet: new Set<string>(),
      searchProgress: null,
      searchOperationId: "search-op",
      scanProgress: null,
      scanOperationId: "scan-op",
      validationCache: new Map([
        [
          "/existing.xml",
          {
            problems: [],
            encoding: "UTF-8",
            hasBom: false,
          },
        ],
      ]),
    });
  });

  it("appends search result batches with incremental dedupe", () => {
    useExplorerStore.getState().appendSearchResults(
      [
        {
          filePath: "/b/z.xml",
          fileName: "z.xml",
          parentFolder: "/b",
          matchCount: 1,
          operationId: "search-op",
        },
        {
          filePath: "/a/m.xml",
          fileName: "m.xml",
          parentFolder: "/a",
          matchCount: 2,
          operationId: "search-op",
        },
      ],
      [
        {
          filePath: "/errors/bad.xml",
          fileName: "bad.xml",
          parentFolder: "/errors",
          errorMessage: "Failed to read file",
        },
      ]
    );

    useExplorerStore.getState().appendSearchResults(
      [
        {
          filePath: "/a/m.xml",
          fileName: "m.xml",
          parentFolder: "/a",
          matchCount: 2,
          operationId: "search-op",
        },
      ],
      []
    );

    const state = useExplorerStore.getState();
    expect(state.searchResults.map((r) => r.filePath)).toEqual([
      "/b/z.xml",
      "/a/m.xml",
    ]);
    expect(state.searchResultPathSet).toEqual(
      new Set(["/b/z.xml", "/a/m.xml"])
    );
    expect(state.searchErrors).toHaveLength(1);
    expect(state.searchErrorPathSet).toEqual(new Set(["/errors/bad.xml"]));
  });

  it("sorts search results once the content search completes", async () => {
    const { explorerService } = await import("./services/explorer-service");
    vi.mocked(explorerService.contentSearch).mockImplementationOnce(
      async () => {
        useExplorerStore.getState().appendSearchResults(
          [
            {
              filePath: "/b/z.xml",
              fileName: "z.xml",
              parentFolder: "/b",
              matchCount: 1,
              operationId: "search-op",
            },
            {
              filePath: "/a/m.xml",
              fileName: "m.xml",
              parentFolder: "/a",
              matchCount: 2,
              operationId: "search-op",
            },
          ],
          []
        );

        return {
          query: "alpha",
          scopeLabel: "scope",
          filePattern: "*.xml",
          totalFilesScanned: 2,
          totalFilesMatched: 2,
          totalMatches: 3,
          cancelled: false,
        };
      }
    );

    await useExplorerStore.getState().startContentSearch(["/root"], "scope");

    const state = useExplorerStore.getState();
    expect(state.searchResults.map((r) => r.filePath)).toEqual([
      "/a/m.xml",
      "/b/z.xml",
    ]);
    expect(state.searchStatus).toBe("completed");
  });

  it("clears search result dedupe state", () => {
    useExplorerStore.getState().appendSearchResults(
      [
        {
          filePath: "/a/m.xml",
          fileName: "m.xml",
          parentFolder: "/a",
          matchCount: 1,
          operationId: "search-op",
        },
      ],
      [
        {
          filePath: "/errors/bad.xml",
          fileName: "bad.xml",
          parentFolder: "/errors",
          errorMessage: "Failed to read file",
        },
      ]
    );

    useExplorerStore.getState().clearSearchResults();

    const state = useExplorerStore.getState();
    expect(state.searchResults).toEqual([]);
    expect(state.searchErrors).toEqual([]);
    expect(state.searchResultPathSet.size).toBe(0);
    expect(state.searchErrorPathSet.size).toBe(0);
  });

  it("updates scan progress without mutating validation cache", () => {
    const before = useExplorerStore.getState().validationCache;

    useExplorerStore.getState().updateScanProgress({
      operationId: "scan-op",
      filePath: "/new.xml",
      fileName: "new.xml",
      status: "error",
      errorCount: 1,
      warningCount: 0,
      filesProcessed: 10,
      totalFiles: null,
      totalErrors: 1,
      totalWarnings: 0,
      totalClean: 9,
    });

    const state = useExplorerStore.getState();
    expect(state.scanProgress?.filesProcessed).toBe(10);
    expect(state.validationCache).toBe(before);
    expect(state.validationCache.has("/new.xml")).toBe(false);
  });

  it("indexes loaded filenames with parent ids when expanding folders", async () => {
    const { explorerService } = await import("./services/explorer-service");
    vi.mocked(explorerService.listDirectory).mockResolvedValueOnce([
      { name: "Config.xml", isDir: false, path: "/root/Config.xml" },
      { name: "Nested", isDir: true, path: "/root/Nested" },
    ]);

    useExplorerStore.setState({
      folderSources: [
        {
          id: "source-1",
          path: "/root",
          label: "Root",
          tag: "local",
          favorites: [],
        },
      ],
      treeNodes: new Map([
        [
          "source-1",
          {
            id: "source-1",
            path: "/root",
            name: "Root",
            type: "source",
            children: null,
            loadState: "idle",
            isDir: true,
          },
        ],
      ]),
      loadedFileIndex: new Map([["source-1", "root"]]),
      expandedIds: new Set(),
      activeOperations: new Map(),
    });

    await useExplorerStore.getState().expandNode("source-1");

    const state = useExplorerStore.getState();
    expect(state.treeNodes.get("/root/Config.xml")?.parentId).toBe("source-1");
    expect(state.treeNodes.get("/root/Nested")?.parentId).toBe("source-1");
    expect(state.loadedFileIndex.get("/root/Config.xml")).toBe(
      "config.xml"
    );
    expect(state.loadedFileIndex.get("/root/Nested")).toBe("nested");
  });
});

describe("explorer store - loadSources reconciliation", () => {
  const source = {
    id: "source-1",
    path: "/root",
    label: "Root",
    tag: "local",
    favorites: [],
  };

  const loadedTree = () =>
    new Map([
      [
        "source-1",
        {
          id: "source-1",
          path: "/root",
          name: "Root",
          type: "source" as const,
          children: null,
          loadState: "loaded" as const,
          isDir: true,
        },
      ],
      [
        "/root/Nested",
        {
          id: "/root/Nested",
          path: "/root/Nested",
          name: "Nested",
          parentId: "source-1",
          type: "folder" as const,
          children: null,
          loadState: "idle" as const,
          isDir: true,
        },
      ],
    ]);

  beforeEach(() => {
    vi.clearAllMocks();
    useExplorerStore.setState({
      folderSources: [source],
      treeNodes: loadedTree(),
      expandedIds: new Set(["source-1"]),
      activeOperations: new Map(),
    });
  });

  it("preserves loaded subtrees and expansion across repeated loads", async () => {
    vi.mocked(settingsService.getSettings).mockResolvedValueOnce({
      folderSources: [source],
    });

    await useExplorerStore.getState().loadSources();

    const state = useExplorerStore.getState();
    expect(state.treeNodes.get("/root/Nested")).toBeDefined();
    expect(state.treeNodes.get("source-1")?.loadState).toBe("loaded");
    expect(state.expandedIds.has("source-1")).toBe(true);
    expect(state.loadedFileIndex.get("/root/Nested")).toBe("nested");
  });

  it("drops nodes of removed sources and adds new sources fresh", async () => {
    const added = {
      id: "source-2",
      path: "/other",
      label: "Other",
      tag: "",
      favorites: [],
    };
    vi.mocked(settingsService.getSettings).mockResolvedValueOnce({
      folderSources: [added],
    });

    await useExplorerStore.getState().loadSources();

    const state = useExplorerStore.getState();
    expect(state.treeNodes.has("source-1")).toBe(false);
    expect(state.treeNodes.has("/root/Nested")).toBe(false);
    expect(state.treeNodes.get("source-2")?.loadState).toBe("idle");
    expect(state.expandedIds.size).toBe(0);
  });

  it("starts a repointed source fresh even when the id is unchanged", async () => {
    vi.mocked(settingsService.getSettings).mockResolvedValueOnce({
      folderSources: [{ ...source, path: "/moved" }],
    });

    await useExplorerStore.getState().loadSources();

    const state = useExplorerStore.getState();
    expect(state.treeNodes.get("source-1")?.path).toBe("/moved");
    expect(state.treeNodes.get("source-1")?.loadState).toBe("idle");
    expect(state.treeNodes.has("/root/Nested")).toBe(false);
  });

  it("applies a renamed label without resetting the subtree", async () => {
    vi.mocked(settingsService.getSettings).mockResolvedValueOnce({
      folderSources: [{ ...source, label: "Renamed" }],
    });

    await useExplorerStore.getState().loadSources();

    const state = useExplorerStore.getState();
    expect(state.treeNodes.get("source-1")?.name).toBe("Renamed");
    expect(state.treeNodes.get("/root/Nested")).toBeDefined();
  });
});

describe("explorer store - node style setting", () => {
  beforeEach(() => {
    useExplorerStore.setState({ explorerNodeStyle: "soft" });
    vi.clearAllMocks();
  });

  it("hydrates explorerNodeStyle from settings when valid", async () => {
    vi.mocked(settingsService.getSettings).mockResolvedValueOnce({
      folderSources: [],
      explorerNodeStyle: "capsule",
    });

    await useExplorerStore.getState().loadSources();

    expect(useExplorerStore.getState().explorerNodeStyle).toBe("capsule");
  });

  it("falls back to soft when the persisted value is invalid", async () => {
    useExplorerStore.setState({ explorerNodeStyle: "outline" });
    vi.mocked(settingsService.getSettings).mockResolvedValueOnce({
      folderSources: [],
      explorerNodeStyle: "solid" as never,
    });

    await useExplorerStore.getState().loadSources();

    expect(useExplorerStore.getState().explorerNodeStyle).toBe("soft");
  });

  it("persists explorerNodeStyle through setExplorerNodeStyle", () => {
    useExplorerStore.getState().setExplorerNodeStyle("depth");

    expect(useExplorerStore.getState().explorerNodeStyle).toBe("depth");
    expect(settingsService.saveSettings).toHaveBeenCalledWith({
      explorerNodeStyle: "depth",
    });
  });
});
