import { useCallback } from "react";
import { useShallow } from "zustand/shallow";
import {
  useTauriEvent,
  searchResultHub,
  searchProgressHub,
} from "@/services/events";
import { useExplorerStore } from "../store";
import type { SearchResultFile, SearchProgressPayload } from "../types";

export function useSearch() {
  const {
    cancelContentSearch,
    clearSearchResults,
    updateSearchProgress,
    appendSearchResult,
  } = useExplorerStore(
    useShallow((state) => ({
      cancelContentSearch: state.cancelContentSearch,
      clearSearchResults: state.clearSearchResults,
      updateSearchProgress: state.updateSearchProgress,
      appendSearchResult: state.appendSearchResult,
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

  const handleResult = useCallback(
    (payload: SearchResultFile) => {
      const currentOpId = useExplorerStore.getState().searchOperationId;
      if (payload.operationId !== currentOpId) return;

      appendSearchResult(payload);
    },
    [appendSearchResult]
  );

  useTauriEvent(searchProgressHub.subscribe, handleProgress);
  useTauriEvent(searchResultHub.subscribe, handleResult);

  return {
    cancelContentSearch,
    clearSearchResults,
  };
}
