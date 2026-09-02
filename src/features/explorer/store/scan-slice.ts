import type {
  FileTab,
  ValidationStatus,
  ScanStatus,
  ScanProgressPayload,
  ScanFileResult,
  ScanReport,
} from "../types";
import { explorerService } from "../services/explorer-service";
import { showToast } from "@/features/notifications/store";
import { computeAggregateBadges } from "../utils/badge-aggregation";
import { appendBounded, VALIDATION_CACHE_MAX } from "./bounded-cache";
import { recomputeTabNames } from "./tabs-slice";
import { toIsoDate } from "./search-slice";
import type { SliceCreator } from "./store-types";

export interface ScanSlice {
  scanStatus: ScanStatus;
  scanOperationId: string | null;
  scanFolderPath: string | null;
  scanFolderName: string | null;
  scanFilePattern: string;
  scanProgress: ScanProgressPayload | null;
  /** File results streamed so far (live during a scan, final afterwards). */
  scanFiles: ScanFileResult[];
  scanResult: ScanReport | null;
  folderBadgeCache: Map<string, ValidationStatus>;
  pendingScanRequest: {
    folderPath: string;
    filePattern: string;
  } | null;

  requestScan: (folderPath: string, filePattern: string) => void;
  startScan: (folderPath: string, filePattern: string) => Promise<void>;
  updateScanProgress: (payload: ScanProgressPayload) => void;
  appendScanResults: (operationId: string, results: ScanFileResult[]) => void;
  cancelScan: () => Promise<void>;
  clearScanResult: () => void;
  setScanFilePattern: (pattern: string) => void;
  getFolderBadge: (folderPath: string) => ValidationStatus | undefined;
  confirmPendingScan: () => void;
  dismissPendingScan: () => void;
}

/** Client-side cap on retained problems per scanned file. */
const MAX_PROBLEMS_PER_FILE = 50;

const scanFilePaths = new Set<string>();

// Resolves when the currently running bulk scan settles (including its state
// updates), so a restart can wait for the real completion instead of sleeping.
let inFlightScan: Promise<void> | null = null;

export const createScanSlice: SliceCreator<ScanSlice> = (set, get) => {
  const runScan = async (folderPath: string, filePattern: string) => {
    const operationId = crypto.randomUUID();
    const folderName = folderPath.split(/[/\\]/).pop() ?? folderPath;

    // The results tab opens immediately; rows stream into it live (D-12)
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
    const existingTabs = get().tabs.filter((t) => t.id !== "scan:results");

    scanFilePaths.clear();
    set({
      scanStatus: "scanning",
      scanOperationId: operationId,
      scanFolderPath: folderPath,
      scanFolderName: folderName,
      scanProgress: null,
      scanFiles: [],
      scanResult: null,
      pendingScanRequest: null,
      tabs: recomputeTabNames([...existingTabs, scanTab]),
      activeTabId: "scan:results",
    });

    try {
      const { dateRange } = get();
      const summary = await explorerService.bulkScan(
        folderPath,
        filePattern,
        toIsoDate(dateRange?.from),
        toIsoDate(dateRange?.to),
        operationId
      );

      const files = get().scanFiles;
      set({
        scanStatus: summary.cancelled ? "cancelled" : "completed",
        scanResult: { ...summary, files },
        scanOperationId: null,
        folderBadgeCache: computeAggregateBadges(files, folderPath),
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
    scanFiles: [],
    scanResult: null,
    folderBadgeCache: new Map(),
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

    appendScanResults: (operationId: string, results: ScanFileResult[]) => {
      if (results.length === 0) return;
      if (get().scanOperationId !== operationId) return;

      const next = [...get().scanFiles];
      const cacheEntries: Array<
        readonly [
          string,
          { problems: ScanFileResult["problems"]; encoding: string; hasBom: boolean },
        ]
      > = [];
      for (const result of results) {
        if (scanFilePaths.has(result.filePath)) continue;
        scanFilePaths.add(result.filePath);
        const bounded =
          result.problems.length > MAX_PROBLEMS_PER_FILE
            ? { ...result, problems: result.problems.slice(0, MAX_PROBLEMS_PER_FILE) }
            : result;
        next.push(bounded);
        cacheEntries.push([
          bounded.filePath,
          {
            problems: bounded.problems,
            encoding: bounded.encoding,
            hasBom: bounded.hasBom,
          },
        ] as const);
      }

      set({
        scanFiles: next,
        // Tree and tab badges update live as results stream in.
        validationCache: appendBounded(
          get().validationCache,
          cacheEntries,
          VALIDATION_CACHE_MAX
        ),
      });
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
      scanFilePaths.clear();
      set({
        scanStatus: "idle",
        scanFiles: [],
        scanResult: null,
        scanProgress: null,
      });
    },

    setScanFilePattern: (pattern: string) => {
      set({ scanFilePattern: pattern });
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
