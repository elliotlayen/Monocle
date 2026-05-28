import { useCallback } from "react";
import { useShallow } from "zustand/shallow";
import {
  useTauriEvent,
  searchResultHub,
  searchProgressHub,
} from "@/services/events";
import { useExplorerStore } from "../store";
import type {
  SearchResultFile,
  SearchProgressPayload,
  FolderSource,
  SearchScope,
} from "../types";

export function resolveSearchScope(
  searchScope: SearchScope,
  selectedNodePath: string | null,
  selectedSourcePath: string | null,
  folderSources: FolderSource[]
): { paths: string[]; label: string } | null {
  if (searchScope === "folder") {
    if (!selectedNodePath) return null;
    const nodeName = selectedNodePath.split(/[/\\]/).pop() ?? selectedNodePath;
    return { paths: [selectedNodePath], label: `Folder: ${nodeName}` };
  }

  if (searchScope === "source") {
    if (!selectedSourcePath) return null;
    const source = folderSources.find((s) => s.path === selectedSourcePath);
    const sourceLabel = source?.label ?? selectedSourcePath;
    return { paths: [selectedSourcePath], label: `Source: ${sourceLabel}` };
  }

  if (searchScope === "all") {
    return {
      paths: folderSources.map((s) => s.path),
      label: "All sources",
    };
  }

  return null;
}

export function useSearch() {
  const {
    startContentSearch,
    cancelContentSearch,
    clearSearchResults,
    updateSearchProgress,
    appendSearchResult,
    searchStatus,
    searchProgress,
    searchResults,
    searchErrors,
    searchSummary,
    searchQuery,
    searchScope,
    searchFilePattern,
    searchMode,
    searchOperationId,
  } = useExplorerStore(
    useShallow((state) => ({
      startContentSearch: state.startContentSearch,
      cancelContentSearch: state.cancelContentSearch,
      clearSearchResults: state.clearSearchResults,
      updateSearchProgress: state.updateSearchProgress,
      appendSearchResult: state.appendSearchResult,
      searchStatus: state.searchStatus,
      searchProgress: state.searchProgress,
      searchResults: state.searchResults,
      searchErrors: state.searchErrors,
      searchSummary: state.searchSummary,
      searchQuery: state.searchQuery,
      searchScope: state.searchScope,
      searchFilePattern: state.searchFilePattern,
      searchMode: state.searchMode,
      searchOperationId: state.searchOperationId,
    }))
  );

  const handleProgress = useCallback(
    (payload: SearchProgressPayload) => {
      // Validate operationId matches active search (T-06-05)
      const currentOpId = useExplorerStore.getState().searchOperationId;
      if (payload.operationId !== currentOpId) return;
      updateSearchProgress(payload);
    },
    [updateSearchProgress]
  );

  const handleResult = useCallback(
    (payload: SearchResultFile & { operationId?: string }) => {
      // Validate operationId matches active search (T-06-05)
      const currentOpId = useExplorerStore.getState().searchOperationId;
      if (payload.operationId && payload.operationId !== currentOpId) return;

      // Pass result to store (operationId is not part of SearchResultFile)
      appendSearchResult({
        filePath: payload.filePath,
        fileName: payload.fileName,
        parentFolder: payload.parentFolder,
        matchCount: payload.matchCount,
      });
    },
    [appendSearchResult]
  );

  // Subscribe to search events from Rust
  useTauriEvent(searchProgressHub.subscribe, handleProgress);
  useTauriEvent(searchResultHub.subscribe, handleResult);

  return {
    startContentSearch,
    cancelContentSearch,
    clearSearchResults,
    searchStatus,
    searchProgress,
    searchResults,
    searchErrors,
    searchSummary,
    searchQuery,
    searchScope,
    searchFilePattern,
    searchMode,
    searchOperationId,
  };
}
