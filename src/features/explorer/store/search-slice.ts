import type {
  SearchMode,
  SearchStatus,
  SearchResultFile,
  SearchErrorFile,
  SearchProgressPayload,
  SearchSummary,
} from "../types";
import { explorerService } from "../services/explorer-service";
import { showToast } from "@/features/notifications/store";
import type { SliceCreator } from "./store-types";

export interface SearchSlice {
  searchMode: SearchMode;
  searchQuery: string;
  searchCheckedPaths: Set<string>;
  searchFilePattern: string;
  searchStatus: SearchStatus;
  searchProgress: SearchProgressPayload | null;
  searchResults: SearchResultFile[];
  searchErrors: SearchErrorFile[];
  searchResultPathSet: Set<string>;
  searchErrorPathSet: Set<string>;
  searchSummary: SearchSummary | null;
  searchOperationId: string | null;
  activeSearchTerms: string[] | null;

  setSearchMode: (mode: SearchMode) => void;
  setSearchQuery: (text: string) => void;
  toggleSearchCheck: (path: string) => void;
  setSearchFilePattern: (pattern: string) => void;
  startContentSearch: (
    folderPaths: string[],
    scopeLabel: string
  ) => Promise<void>;
  updateSearchProgress: (payload: SearchProgressPayload) => void;
  appendSearchResults: (
    results: SearchResultFile[],
    errors: SearchErrorFile[]
  ) => void;
  cancelContentSearch: () => Promise<void>;
  clearSearchResults: () => void;
  setActiveSearchTerms: (terms: string[] | null) => void;
}

function sortSearchResults(results: SearchResultFile[]): SearchResultFile[] {
  return [...results].sort((a, b) => {
    const folderCompare = a.parentFolder.localeCompare(b.parentFolder);
    if (folderCompare !== 0) return folderCompare;
    return a.fileName.localeCompare(b.fileName);
  });
}

function sortSearchErrors(errors: SearchErrorFile[]): SearchErrorFile[] {
  return [...errors].sort((a, b) => {
    const folderCompare = a.parentFolder.localeCompare(b.parentFolder);
    if (folderCompare !== 0) return folderCompare;
    return a.fileName.localeCompare(b.fileName);
  });
}

/**
 * Parse search query into individual terms (frontend port of Rust parse_search_terms).
 * Splits on spaces, handles quoted phrases, lowercases all terms.
 */
export function parseSearchTermsFrontend(query: string): string[] {
  const terms: string[] = [];
  const trimmed = query.trim();
  if (!trimmed) return terms;

  let current = "";
  let inQuotes = false;

  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (ch === '"') {
      if (inQuotes) {
        // End of quoted phrase
        if (current) terms.push(current.toLowerCase());
        current = "";
        inQuotes = false;
      } else {
        // Start of quoted phrase -- push anything accumulated so far
        if (current) terms.push(current.toLowerCase());
        current = "";
        inQuotes = true;
      }
    } else if (ch === " " && !inQuotes) {
      if (current) terms.push(current.toLowerCase());
      current = "";
    } else {
      current += ch;
    }
  }

  if (current) terms.push(current.toLowerCase());
  return terms;
}

export const createSearchSlice: SliceCreator<SearchSlice> = (set, get) => ({
  searchMode: "filename",
  searchQuery: "",
  searchCheckedPaths: new Set<string>(),
  searchFilePattern: "*.xml",
  searchStatus: "idle",
  searchProgress: null,
  searchResults: [],
  searchErrors: [],
  searchResultPathSet: new Set<string>(),
  searchErrorPathSet: new Set<string>(),
  searchSummary: null,
  searchOperationId: null,
  activeSearchTerms: null,

  setSearchMode: (mode: SearchMode) => {
    const { searchMode: currentMode, searchResults, searchQuery } = get();
    if (
      currentMode === "content" &&
      mode === "filename" &&
      searchResults.length > 0
    ) {
      // Switching from content to filename with results: clear search state, sync query to filterText
      set({
        searchMode: mode,
        searchResults: [],
        searchErrors: [],
        searchResultPathSet: new Set<string>(),
        searchErrorPathSet: new Set<string>(),
        searchSummary: null,
        searchStatus: "idle",
        activeSearchTerms: null,
      });
      get().setFilterText(searchQuery);
    } else if (mode === "filename") {
      // Switching to filename: sync query to filterText
      set({ searchMode: mode });
      get().setFilterText(searchQuery);
    } else {
      set({ searchMode: mode });
    }
  },

  setSearchQuery: (text: string) => {
    const { searchMode } = get();
    if (searchMode === "filename") {
      set({ searchQuery: text });
      get().setFilterText(text);
    } else {
      set({ searchQuery: text });
      if (!text) {
        get().clearSearchResults();
      }
    }
  },

  toggleSearchCheck: (path: string) => {
    const prev = get().searchCheckedPaths;
    const next = new Set(prev);
    if (next.has(path)) {
      next.delete(path);
    } else {
      next.add(path);
      // Remove any descendant paths — parent already covers them
      for (const p of next) {
        if (p !== path && p.startsWith(path + "/")) next.delete(p);
        if (p !== path && p.startsWith(path + "\\")) next.delete(p);
      }
    }
    set({ searchCheckedPaths: next });
  },

  setSearchFilePattern: (pattern: string) => {
    set({ searchFilePattern: pattern });
  },

  startContentSearch: async (folderPaths: string[], scopeLabel: string) => {
    const { searchQuery, searchFilePattern } = get();
    const operationId = crypto.randomUUID();

    set({
      searchStatus: "searching",
      searchOperationId: operationId,
      searchResults: [],
      searchErrors: [],
      searchResultPathSet: new Set<string>(),
      searchErrorPathSet: new Set<string>(),
      searchProgress: null,
      searchSummary: null,
    });

    try {
      const result = await explorerService.contentSearch(
        searchQuery,
        JSON.stringify(folderPaths),
        searchFilePattern,
        scopeLabel,
        operationId
      );

      set((state) => ({
        searchStatus: result.cancelled ? "cancelled" : "completed",
        searchSummary: result,
        searchOperationId: null,
        searchResults: sortSearchResults(state.searchResults),
        searchErrors: sortSearchErrors(state.searchErrors),
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const isNetworkError =
        message.toLowerCase().includes("unreachable") ||
        message.toLowerCase().includes("network");

      set({
        searchStatus: "idle",
        searchOperationId: null,
      });

      if (isNetworkError) {
        const filesScanned = get().searchProgress?.filesScanned ?? 0;
        showToast({
          type: "error",
          title: "Network share unreachable",
          message: `Search stopped after ${filesScanned} files.`,
          duration: 5000,
        });
      } else {
        showToast({
          type: "error",
          title: "Search failed",
          message: "An error occurred while searching",
          duration: 5000,
        });
      }
    }
  },

  updateSearchProgress: (payload: SearchProgressPayload) => {
    const { searchOperationId } = get();
    if (payload.operationId !== searchOperationId) return;
    set({ searchProgress: payload });
  },

  appendSearchResults: (results, errors) => {
    if (results.length === 0 && errors.length === 0) return;

    set((state) => {
      const seenResultPaths = new Set(state.searchResultPathSet);
      const nextResults = [...state.searchResults];
      for (const result of results) {
        if (seenResultPaths.has(result.filePath)) continue;
        seenResultPaths.add(result.filePath);
        nextResults.push(result);
      }

      const seenErrorPaths = new Set(state.searchErrorPathSet);
      const nextErrors = [...state.searchErrors];
      for (const error of errors) {
        if (seenErrorPaths.has(error.filePath)) continue;
        seenErrorPaths.add(error.filePath);
        nextErrors.push(error);
      }

      return {
        searchResults: nextResults,
        searchErrors: nextErrors,
        searchResultPathSet: seenResultPaths,
        searchErrorPathSet: seenErrorPaths,
      };
    });
  },

  cancelContentSearch: async () => {
    const { searchOperationId } = get();
    if (searchOperationId) {
      try {
        await explorerService.cancelContentSearch(searchOperationId);
      } catch {
        // Best-effort cancel
      }
    }
  },

  clearSearchResults: () => {
    set({
      searchResults: [],
      searchErrors: [],
      searchResultPathSet: new Set<string>(),
      searchErrorPathSet: new Set<string>(),
      searchSummary: null,
      searchProgress: null,
      searchStatus: "idle",
      activeSearchTerms: null,
      searchCheckedPaths: new Set<string>(),
    });
  },

  setActiveSearchTerms: (terms: string[] | null) => {
    set({ activeSearchTerms: terms });
  },
});
