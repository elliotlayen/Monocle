import type {
  SearchMode,
  SearchStatus,
  SearchResultFile,
  SearchErrorFile,
  SearchProgressPayload,
  SearchSummary,
  FilenameResultFile,
  FilenameSearchSummary,
} from "../types";
import { explorerService } from "../services/explorer-service";
import { showToast } from "@/features/notifications/store";
import type { SliceCreator } from "./store-types";

/**
 * Content-search scope: everything, one source (by id), or whatever folder
 * is currently selected in the tree (resolved when the search runs).
 */
export type SearchScope = "all" | "selected" | `source:${string}`;

export interface SearchSlice {
  searchMode: SearchMode;
  searchQuery: string;
  searchScope: SearchScope;
  searchFilePattern: string;
  searchRegex: boolean;
  searchCaseSensitive: boolean;
  searchStatus: SearchStatus;
  searchProgress: SearchProgressPayload | null;
  searchResults: SearchResultFile[];
  searchErrors: SearchErrorFile[];
  searchResultPathSet: Set<string>;
  searchErrorPathSet: Set<string>;
  searchSummary: SearchSummary | null;
  searchOperationId: string | null;
  activeSearchTerms: string[] | null;

  // Filename (on-disk) search state
  filenameStatus: SearchStatus;
  filenameResults: FilenameResultFile[];
  filenameResultPathSet: Set<string>;
  filenameSummary: FilenameSearchSummary | null;
  filenameOperationId: string | null;

  setSearchMode: (mode: SearchMode) => void;
  setSearchQuery: (text: string) => void;
  setSearchScope: (scope: SearchScope) => void;
  setSearchFilePattern: (pattern: string) => void;
  setSearchRegex: (regex: boolean) => void;
  setSearchCaseSensitive: (caseSensitive: boolean) => void;
  startFilenameSearch: (folderPaths: string[]) => Promise<void>;
  appendFilenameResults: (
    operationId: string,
    results: FilenameResultFile[]
  ) => void;
  clearFilenameSearch: () => void;
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

/** Local-date ISO string (YYYY-MM-DD) for the backend date filters. */
export function toIsoDate(date: Date | undefined | null): string | null {
  if (!date) return null;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
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
  searchScope: "all",
  searchFilePattern: "*.xml",
  searchRegex: false,
  searchCaseSensitive: false,
  searchStatus: "idle",
  searchProgress: null,
  searchResults: [],
  searchErrors: [],
  searchResultPathSet: new Set<string>(),
  searchErrorPathSet: new Set<string>(),
  searchSummary: null,
  searchOperationId: null,
  activeSearchTerms: null,

  filenameStatus: "idle",
  filenameResults: [],
  filenameResultPathSet: new Set<string>(),
  filenameSummary: null,
  filenameOperationId: null,

  setSearchMode: (mode: SearchMode) => {
    if (mode === get().searchMode) return;
    set({ searchMode: mode });
    if (mode === "content") {
      get().clearFilenameSearch();
    }
  },

  setSearchQuery: (text: string) => {
    set({ searchQuery: text });
    if (!text) {
      if (get().searchMode === "content") {
        get().clearSearchResults();
      } else {
        get().clearFilenameSearch();
      }
    }
  },

  setSearchScope: (scope: SearchScope) => {
    set({ searchScope: scope });
  },

  setSearchFilePattern: (pattern: string) => {
    set({ searchFilePattern: pattern });
  },

  setSearchRegex: (regex: boolean) => {
    set({ searchRegex: regex });
  },

  setSearchCaseSensitive: (caseSensitive: boolean) => {
    set({ searchCaseSensitive: caseSensitive });
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
      const { searchRegex, searchCaseSensitive, dateRange } = get();
      const result = await explorerService.contentSearch(
        searchQuery,
        JSON.stringify(folderPaths),
        searchFilePattern,
        scopeLabel,
        searchRegex,
        searchCaseSensitive,
        toIsoDate(dateRange?.from),
        toIsoDate(dateRange?.to),
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
    });
  },

  setActiveSearchTerms: (terms: string[] | null) => {
    set({ activeSearchTerms: terms });
  },

  startFilenameSearch: async (folderPaths: string[]) => {
    const previousOp = get().filenameOperationId;
    if (previousOp) {
      explorerService.cancelFilenameSearch(previousOp).catch(() => {});
    }

    const query = get().searchQuery.trim();
    if (!query) {
      get().clearFilenameSearch();
      return;
    }

    const operationId = crypto.randomUUID();
    set({
      filenameStatus: "searching",
      filenameOperationId: operationId,
      filenameResults: [],
      filenameResultPathSet: new Set<string>(),
      filenameSummary: null,
    });

    try {
      const summary = await explorerService.filenameSearch(
        query,
        JSON.stringify(folderPaths),
        get().searchFilePattern,
        operationId
      );
      // Ignore completions from superseded operations
      if (get().filenameOperationId !== operationId) return;
      set({
        filenameStatus: summary.cancelled ? "cancelled" : "completed",
        filenameSummary: summary,
        filenameOperationId: null,
      });
    } catch {
      if (get().filenameOperationId !== operationId) return;
      set({ filenameStatus: "idle", filenameOperationId: null });
      showToast({
        type: "error",
        title: "Filename search failed",
        message: "An error occurred while searching file names",
        duration: 5000,
      });
    }
  },

  appendFilenameResults: (operationId, results) => {
    if (results.length === 0) return;
    if (get().filenameOperationId !== operationId) return;

    set((state) => {
      const seen = new Set(state.filenameResultPathSet);
      const next = [...state.filenameResults];
      for (const result of results) {
        if (seen.has(result.path)) continue;
        seen.add(result.path);
        next.push(result);
      }
      return { filenameResults: next, filenameResultPathSet: seen };
    });
  },

  clearFilenameSearch: () => {
    const previousOp = get().filenameOperationId;
    if (previousOp) {
      explorerService.cancelFilenameSearch(previousOp).catch(() => {});
    }
    set({
      filenameStatus: "idle",
      filenameResults: [],
      filenameResultPathSet: new Set<string>(),
      filenameSummary: null,
      filenameOperationId: null,
    });
  },
});
