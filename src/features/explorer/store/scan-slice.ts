import type {
  FileTab,
  ValidationStatus,
  ScanStatus,
  ScanProgressPayload,
  ScanSummary,
} from "../types";
import { explorerService } from "../services/explorer-service";
import { showToast } from "@/features/notifications/store";
import { computeAggregateBadges } from "../utils/badge-aggregation";
import { recomputeTabNames } from "./tabs-slice";
import type { SliceCreator } from "./store-types";

export interface ScanSlice {
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
}

// Resolves when the currently running bulk scan settles (including its state
// updates), so a restart can wait for the real completion instead of sleeping.
let inFlightScan: Promise<void> | null = null;

export const createScanSlice: SliceCreator<ScanSlice> = (set, get) => {
  const runScan = async (folderPath: string, filePattern: string) => {
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
  };

  return {
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
      const promise = runScan(folderPath, filePattern);
      inFlightScan = promise;
      try {
        await promise;
      } finally {
        if (inFlightScan === promise) inFlightScan = null;
      }
    },

    updateScanProgress: (payload: ScanProgressPayload) => {
      const { scanOperationId } = get();
      if (payload.operationId !== scanOperationId) return;
      set({ scanProgress: payload });
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
      // Cancel the running scan and wait for it to actually settle (its
      // completion writes scan state) before starting the new one.
      const doIt = async () => {
        const running = inFlightScan;
        await get().cancelScan();
        if (running) await running;
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
  };
};
