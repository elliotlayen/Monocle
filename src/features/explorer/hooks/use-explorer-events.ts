import { useEffect } from "react";
import {
  filenameResultsBatchHub,
  scanProgressHub,
  scanResultsBatchHub,
  searchProgressHub,
  searchResultsBatchHub,
} from "@/services/events";
import { useExplorerStore } from "../store";

/**
 * Shell-level subscriptions to every streamed explorer event (search, scan,
 * filename batches) so nothing is lost regardless of which panels are
 * mounted.
 */
export function useExplorerEvents() {
  useEffect(() => {
    const subscriptions = [
      scanProgressHub.subscribe((payload) => {
        useExplorerStore.getState().updateScanProgress(payload);
      }),
      scanResultsBatchHub.subscribe((payload) => {
        useExplorerStore
          .getState()
          .appendScanResults(payload.operationId, payload.results);
      }),
      searchProgressHub.subscribe((payload) => {
        useExplorerStore.getState().updateSearchProgress(payload);
      }),
      searchResultsBatchHub.subscribe((payload) => {
        const store = useExplorerStore.getState();
        if (payload.operationId !== store.searchOperationId) return;
        store.appendSearchResults(payload.results, payload.errors);
      }),
      filenameResultsBatchHub.subscribe((payload) => {
        useExplorerStore
          .getState()
          .appendFilenameResults(payload.operationId, payload.results);
      }),
    ];
    return () => {
      for (const unsubscribe of subscriptions) unsubscribe();
    };
  }, []);
}
