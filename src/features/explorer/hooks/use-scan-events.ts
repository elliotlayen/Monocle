import { useEffect } from "react";
import { scanProgressHub, scanResultsBatchHub } from "@/services/events";
import { useExplorerStore } from "../store";

/**
 * Shell-level subscription to scan events so streamed results and progress
 * are captured for the whole explorer session, independent of which panels
 * happen to be mounted.
 */
export function useScanEvents() {
  useEffect(() => {
    const unsubProgress = scanProgressHub.subscribe((payload) => {
      useExplorerStore.getState().updateScanProgress(payload);
    });
    const unsubResults = scanResultsBatchHub.subscribe((payload) => {
      useExplorerStore
        .getState()
        .appendScanResults(payload.operationId, payload.results);
    });
    return () => {
      unsubProgress();
      unsubResults();
    };
  }, []);
}
