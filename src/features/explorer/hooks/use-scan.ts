import { useCallback } from "react";
import { useShallow } from "zustand/shallow";
import { useTauriEvent, scanProgressHub } from "@/services/events";
import { useExplorerStore } from "../store";
import type { ScanProgressPayload } from "../types";

export function useScan() {
  const {
    requestScan,
    cancelScan,
    scanStatus,
    scanProgress,
    scanResult,
    scanFilePattern,
    setScanFilePattern,
    scanFolderName,
    updateScanProgress,
  } = useExplorerStore(
    useShallow((state) => ({
      requestScan: state.requestScan,
      cancelScan: state.cancelScan,
      scanStatus: state.scanStatus,
      scanProgress: state.scanProgress,
      scanResult: state.scanResult,
      scanFilePattern: state.scanFilePattern,
      setScanFilePattern: state.setScanFilePattern,
      scanFolderName: state.scanFolderName,
      updateScanProgress: state.updateScanProgress,
    }))
  );

  const handleProgress = useCallback(
    (payload: ScanProgressPayload) => {
      updateScanProgress(payload);
    },
    [updateScanProgress]
  );

  // Subscribe to scan progress events from Rust
  useTauriEvent(scanProgressHub.subscribe, handleProgress);

  return {
    requestScan,
    cancelScan,
    scanStatus,
    scanProgress,
    scanResult,
    scanFilePattern,
    setScanFilePattern,
    scanFolderName,
  };
}
