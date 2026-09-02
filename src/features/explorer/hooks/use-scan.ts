import { useShallow } from "zustand/shallow";
import { useExplorerStore } from "../store";

// Scan events are subscribed at the shell level (use-scan-events); this
// hook only exposes scan state and actions to panels.
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
    }))
  );

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
