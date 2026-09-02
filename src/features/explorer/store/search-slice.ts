import type {
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
import {
  settingsService,
  type SavedSearch,
  type SearchHistoryEntry,
  type SearchFieldMode,
} from "@/features/settings/services/settings-service";
import { togglePathInScope } from "./selectors";
import type { SliceCreator } from "./store-types";

/** History keeps this many entries, most recent first. */
const SEARCH_HISTORY_MAX = 20;

export interface SearchSlice {
  // Dual always-visible query fields; lastRun says which drives the results
  filenameQuery: string;
  contentQuery: string;
  lastRun: SearchFieldMode | null;

  // Scope: absolute folder paths under the active source; empty = whole source
  searchSourceId: string | null;
  scopePaths: Set<string>;

  searchFilePattern: string;
  searchRegex: boolean;
  searchCaseSensitive: boolean;
  savedSearches: SavedSearch[];
  searchHistory: SearchHistoryEntry[];

  // Content search results (streamed)
  searchStatus: SearchStatus;
  searchProgress: SearchProgressPayload | null;
  searchResults: SearchResultFile[];
  searchErrors: SearchErrorFile[];
  searchResultPathSet: Set<string>;
  searchErrorPathSet: Set<string>;
  searchSummary: SearchSummary | null;
  searchOperationId: string | null;
  activeSearchTerms: string[] | null;

  // Filename (on-disk) search results (streamed)
  filenameStatus: SearchStatus;
  filenameResults: FilenameResultFile[];
  filenameResultPathSet: Set<string>;
  filenameSummary: FilenameSearchSummary | null;
  filenameOperationId: string | null;

  setFilenameQuery: (text: string) => void;
  setContentQuery: (text: string) => void;
  setSearchSource: (sourceId: string) => void;
  toggleScopePath: (path: string) => void;
  removeScopePath: (path: string) => void;
  clearScope: () => void;
  setScopeTo: (path: string) => void;
  setSearchFilePattern: (pattern: string) => void;
  setSearchRegex: (regex: boolean) => void;
  setSearchCaseSensitive: (caseSensitive: boolean) => void;
  saveSearch: (entry: SavedSearch) => void;
  deleteSavedSearch: (name: string) => void;
  pushSearchHistory: (query: string, mode: SearchFieldMode) => void;
  applySavedSearch: (name: string) => void;
  applyHistoryEntry: (entry: SearchHistoryEntry) => void;

  startContentSearch: () => Promise<void>;
  updateSearchProgress: (payload: SearchProgressPayload) => void;
  appendSearchResults: (
    results: SearchResultFile[],
    errors: SearchErrorFile[]
  ) => void;
  cancelContentSearch: () => Promise<void>;
  clearSearchResults: () => void;
  setActiveSearchTerms: (terms: string[] | null) => void;

  startFilenameSearch: () => Promise<void>;
  appendFilenameResults: (
    operationId: string,
    results: FilenameResultFile[]
  ) => void;
  clearFilenameSearch: () => void;
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
      if (current) terms.push(current.toLowerCase());
      current = "";
      inQuotes = !inQuotes;
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

export const createSearchSlice: SliceCreator<SearchSlice> = (set, get) => {
  /** Folder paths + label the next search runs over. Null when unusable. */
  const resolveScope = (): { paths: string[]; label: string } | null => {
    const { folderSources, searchSourceId, scopePaths } = get();
    const source =
      folderSources.find((s) => s.id === searchSourceId) ?? folderSources[0];
    if (!source) return null;

    if (scopePaths.size === 0) {
      return { paths: [source.path], label: `all of ${source.label}` };
    }
    const paths = [...scopePaths];
    const names = paths.map((p) => p.split(/[/\\]/).pop() ?? p);
    return {
      paths,
      label: names.length <= 2 ? names.join(", ") : `${names.length} folders`,
    };
  };

  return {
    filenameQuery: "",
    contentQuery: "",
    lastRun: null,
    searchSourceId: null,
    scopePaths: new Set<string>(),
    searchFilePattern: "*.xml",
    searchRegex: false,
    searchCaseSensitive: false,
    savedSearches: [],
    searchHistory: [],

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

    setFilenameQuery: (text: string) => {
      // Typing is explicit search intent, so it may flip the panel to
      // results; a scope change re-running the live search must not (the
      // user is often mid-scoping in the Browse tree).
      set({ filenameQuery: text });
      if (!text.trim()) {
        get().clearFilenameSearch();
        const contentActive =
          get().searchStatus !== "idle" || get().searchResults.length > 0;
        set({ lastRun: contentActive ? "content" : null });
      } else {
        set({ resultsPanelMode: "results" });
      }
    },

    setContentQuery: (text: string) => {
      set({ contentQuery: text });
      if (!text.trim()) {
        get().clearSearchResults();
        set({
          lastRun: get().filenameQuery.trim() ? "filename" : null,
        });
      }
    },

    setSearchSource: (sourceId: string) => {
      if (sourceId === get().searchSourceId) return;
      set({ searchSourceId: sourceId, scopePaths: new Set<string>() });
      get().clearSearchResults();
      get().clearFilenameSearch();
      set({ lastRun: null });
    },

    toggleScopePath: (path: string) => {
      set({ scopePaths: togglePathInScope(get().scopePaths, path) });
    },

    removeScopePath: (path: string) => {
      const next = new Set(get().scopePaths);
      next.delete(path);
      set({ scopePaths: next });
    },

    clearScope: () => {
      set({ scopePaths: new Set<string>() });
    },

    setScopeTo: (path: string) => {
      set({ scopePaths: new Set([path]) });
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

    saveSearch: (entry: SavedSearch) => {
      const next = [
        entry,
        ...get().savedSearches.filter((s) => s.name !== entry.name),
      ];
      set({ savedSearches: next });
      settingsService.saveSettings({ explorerSavedSearches: next }).catch(() => {
        showToast({
          type: "error",
          title: "Failed to save search",
          message: "The saved search could not be persisted",
          duration: 5000,
        });
      });
    },

    deleteSavedSearch: (name: string) => {
      const next = get().savedSearches.filter((s) => s.name !== name);
      set({ savedSearches: next });
      // Deliberately silent: the in-memory list already reflects the delete.
      settingsService
        .saveSettings({ explorerSavedSearches: next })
        .catch(() => {});
    },

    pushSearchHistory: (query: string, mode: SearchFieldMode) => {
      const trimmed = query.trim();
      if (!trimmed) return;
      const next = [
        { query: trimmed, mode },
        ...get().searchHistory.filter(
          (h) => !(h.query === trimmed && h.mode === mode)
        ),
      ].slice(0, SEARCH_HISTORY_MAX);
      set({ searchHistory: next });
      // Deliberately silent: history is a convenience, not critical data.
      settingsService
        .saveSettings({ explorerSearchHistory: next })
        .catch(() => {});
    },

    applySavedSearch: (name: string) => {
      const entry = get().savedSearches.find((s) => s.name === name);
      if (!entry) return;
      set({
        searchRegex: entry.regex,
        searchCaseSensitive: entry.caseSensitive,
        ...(entry.filePattern ? { searchFilePattern: entry.filePattern } : {}),
      });
      if (entry.mode === "content") {
        set({ contentQuery: entry.query });
        void get().startContentSearch();
      } else {
        set({ filenameQuery: entry.query, resultsPanelMode: "results" });
        void get().startFilenameSearch();
      }
    },

    applyHistoryEntry: (entry: SearchHistoryEntry) => {
      if (entry.mode === "content") {
        set({ contentQuery: entry.query });
        void get().startContentSearch();
      } else {
        set({ filenameQuery: entry.query, resultsPanelMode: "results" });
        void get().startFilenameSearch();
      }
    },

    startContentSearch: async () => {
      const query = get().contentQuery.trim();
      if (!query) return;
      const scope = resolveScope();
      if (!scope) return;

      const operationId = crypto.randomUUID();
      get().pushSearchHistory(query, "content");
      set({
        lastRun: "content",
        resultsPanelMode: "results",
        searchStatus: "searching",
        searchOperationId: operationId,
        searchResults: [],
        searchErrors: [],
        searchResultPathSet: new Set<string>(),
        searchErrorPathSet: new Set<string>(),
        searchProgress: null,
        searchSummary: null,
        activeSearchTerms: get().searchRegex
          ? null
          : parseSearchTermsFrontend(query),
      });

      try {
        const { searchRegex, searchCaseSensitive, dateRange, searchFilePattern } =
          get();
        const result = await explorerService.contentSearch(
          query,
          JSON.stringify(scope.paths),
          searchFilePattern,
          scope.label,
          searchRegex,
          searchCaseSensitive,
          toIsoDate(dateRange?.from),
          toIsoDate(dateRange?.to),
          operationId
        );

        if (get().searchOperationId !== operationId) return;
        set((state) => ({
          searchStatus: result.cancelled ? "cancelled" : "completed",
          searchSummary: result,
          searchOperationId: null,
          searchResults: sortSearchResults(state.searchResults),
          searchErrors: sortSearchErrors(state.searchErrors),
        }));
      } catch (err: unknown) {
        if (get().searchOperationId !== operationId) return;
        const message = err instanceof Error ? err.message : String(err);
        const isNetworkError =
          message.toLowerCase().includes("unreachable") ||
          message.toLowerCase().includes("network");

        set({
          searchStatus: "idle",
          searchOperationId: null,
        });

        if (message.toLowerCase().includes("regular expression")) {
          showToast({
            type: "error",
            title: "Invalid regular expression",
            message: "Fix the pattern or turn off the .* toggle",
            duration: 5000,
          });
        } else if (isNetworkError) {
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

    startFilenameSearch: async () => {
      const previousOp = get().filenameOperationId;
      if (previousOp) {
        explorerService.cancelFilenameSearch(previousOp).catch(() => {});
      }

      const query = get().filenameQuery.trim();
      if (!query) {
        get().clearFilenameSearch();
        return;
      }
      const scope = resolveScope();
      if (!scope) return;

      const operationId = crypto.randomUUID();
      set({
        lastRun: "filename",
        filenameStatus: "searching",
        filenameOperationId: operationId,
        filenameResults: [],
        filenameResultPathSet: new Set<string>(),
        filenameSummary: null,
      });

      try {
        const { searchRegex, searchCaseSensitive, dateRange, searchFilePattern } =
          get();
        const summary = await explorerService.filenameSearch(
          query,
          JSON.stringify(scope.paths),
          searchFilePattern,
          searchRegex,
          searchCaseSensitive,
          toIsoDate(dateRange?.from),
          toIsoDate(dateRange?.to),
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
  };
};
