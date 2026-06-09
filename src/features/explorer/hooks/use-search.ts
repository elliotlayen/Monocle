import { useCallback } from "react";
import { useShallow } from "zustand/shallow";
import {
  useTauriEvent,
  searchResultsBatchHub,
  searchProgressHub,
} from "@/services/events";
import { useExplorerStore } from "../store";
import type { SearchProgressPayload, SearchResultsBatchPayload } from "../types";

export function useSearch() {
  const {
    cancelContentSearch,
    clearSearchResults,
    updateSearchProgress,
    appendSearchResults,
  } = useExplorerStore(
    useShallow((state) => ({
      cancelContentSearch: state.cancelContentSearch,
      clearSearchResults: state.clearSearchResults,
      updateSearchProgress: state.updateSearchProgress,
      appendSearchResults: state.appendSearchResults,
    }))
  );

  const handleProgress = useCallback(
    (payload: SearchProgressPayload) => {
      const currentOpId = useExplorerStore.getState().searchOperationId;
      if (payload.operationId !== currentOpId) return;
      updateSearchProgress(payload);
    },
    [updateSearchProgress]
  );

  const handleResultsBatch = useCallback(
    (payload: SearchResultsBatchPayload) => {
      const currentOpId = useExplorerStore.getState().searchOperationId;
      if (payload.operationId !== currentOpId) return;

      appendSearchResults(payload.results, payload.errors);
    },
    [appendSearchResults]
  );

  useTauriEvent(searchProgressHub.subscribe, handleProgress);
  useTauriEvent(searchResultsBatchHub.subscribe, handleResultsBatch);

  return {
    cancelContentSearch,
    clearSearchResults,
  };
}
