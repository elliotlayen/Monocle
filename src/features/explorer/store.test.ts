// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useExplorerStore } from "./store";

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

vi.mock("@/features/settings/services/settings-service", () => ({
  settingsService: {
    saveSettings: vi.fn().mockResolvedValue({}),
    getSettings: vi.fn().mockResolvedValue({ folderSources: [] }),
  },
}));

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
      const { showToast } = await import(
        "@/features/notifications/store"
      );
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
