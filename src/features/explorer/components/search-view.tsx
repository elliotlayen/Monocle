import { useCallback, useEffect, useRef } from "react";
import { useShallow } from "zustand/shallow";
import { FileCode, Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useExplorerStore } from "../store";
import { useSearch } from "../hooks/use-search";
import { filenameResultsBatchHub } from "@/services/events";
import { SearchResults } from "./search-results";
import {
  loadedFilenameMatches,
} from "../store/selectors";
import type { FilenameResultFile } from "../types";

const FILENAME_DEBOUNCE_MS = 250;

// Transitional Search view for the dual-field model; the full search panel
// replaces this in the search-first shell.
export function SearchView() {
  const {
    filenameQuery,
    setFilenameQuery,
    contentQuery,
    setContentQuery,
    lastRun,
    scopePaths,
    clearScope,
    searchStatus,
    searchResults,
    searchErrors,
    searchSummary,
    searchProgress,
    filenameStatus,
    filenameResults,
    loadedFileIndex,
    treeNodes,
    searchRegex,
    searchCaseSensitive,
    openFile,
  } = useExplorerStore(
    useShallow((state) => ({
      filenameQuery: state.filenameQuery,
      setFilenameQuery: state.setFilenameQuery,
      contentQuery: state.contentQuery,
      setContentQuery: state.setContentQuery,
      lastRun: state.lastRun,
      scopePaths: state.scopePaths,
      clearScope: state.clearScope,
      searchStatus: state.searchStatus,
      searchResults: state.searchResults,
      searchErrors: state.searchErrors,
      searchSummary: state.searchSummary,
      searchProgress: state.searchProgress,
      filenameStatus: state.filenameStatus,
      filenameResults: state.filenameResults,
      loadedFileIndex: state.loadedFileIndex,
      treeNodes: state.treeNodes,
      searchRegex: state.searchRegex,
      searchCaseSensitive: state.searchCaseSensitive,
      openFile: state.openFile,
    }))
  );

  const { cancelContentSearch, clearSearchResults } = useSearch();

  useEffect(() => {
    return filenameResultsBatchHub.subscribe((payload) => {
      useExplorerStore
        .getState()
        .appendFilenameResults(payload.operationId, payload.results);
    });
  }, []);

  // Debounced live filename search
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!filenameQuery.trim()) return;
    debounceRef.current = setTimeout(() => {
      void useExplorerStore.getState().startFilenameSearch();
    }, FILENAME_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [filenameQuery, scopePaths]);

  const loadedMatches = loadedFilenameMatches({
    loadedFileIndex,
    treeNodes,
    scopePaths,
    query: filenameQuery,
    options: { regex: searchRegex, caseSensitive: searchCaseSensitive },
  });
  const streamed = filenameResults.filter(
    (r) => !loadedMatches.some((m) => m.path === r.path)
  );

  const handleFileClick = useCallback(
    (filePath: string) => {
      useExplorerStore.getState().setSelectedPath(filePath);
      openFile(filePath);
    },
    [openFile]
  );

  const handleSnippetClick = useCallback(
    (filePath: string, line: number) => {
      void openFile(filePath).then(() => {
        useExplorerStore.getState().jumpToProblem(filePath, line, 1);
      });
    },
    [openFile]
  );

  const getGroupLabel = useCallback((folderPath: string) => {
    const { folderSources: sources } = useExplorerStore.getState();
    const source = sources.find(
      (s) =>
        folderPath === s.path ||
        folderPath.startsWith(s.path + "/") ||
        folderPath.startsWith(s.path + "\\")
    );
    if (!source) return folderPath.split(/[/\\]/).pop() ?? folderPath;
    if (folderPath === source.path) return source.label;
    const rel = folderPath.slice(source.path.length + 1).replace(/\\/g, "/");
    return `${source.label} / ${rel}`;
  }, []);

  const renderFilenameRow = (result: FilenameResultFile) => (
    <button
      key={result.path}
      type="button"
      className="flex w-full items-center gap-2 px-4 py-1 text-left hover:bg-muted"
      onClick={() => handleFileClick(result.path)}
      title={result.path}
    >
      <FileCode className="h-3.5 w-3.5 flex-shrink-0" />
      <span className="truncate text-sm">{result.name}</span>
      <span className="ml-auto truncate pl-3 text-xs text-muted-foreground">
        {getGroupLabel(result.parentFolder)}
      </span>
    </button>
  );

  return (
    <>
      <div className="flex flex-col gap-2 border-b p-3 pt-0 flex-shrink-0">
        <div className="relative">
          <FileCode className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="explorer-filename-input"
            aria-label="Filename search"
            placeholder="Filter file names - live"
            value={filenameQuery}
            onChange={(e) => setFilenameQuery(e.target.value)}
            className="h-8 text-sm pl-8"
          />
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="explorer-content-search-input"
            aria-label="Content search"
            placeholder="Search file contents - press Enter"
            value={contentQuery}
            onChange={(e) => setContentQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                void useExplorerStore.getState().startContentSearch();
              }
            }}
            className="h-8 text-sm pl-8"
          />
        </div>
        {scopePaths.size > 0 && (
          <button
            type="button"
            className="self-start text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            onClick={clearScope}
          >
            <X className="h-3 w-3" /> Clear scope ({scopePaths.size})
          </button>
        )}
      </div>

      {lastRun === "content" ? (
        <SearchResults
          results={searchResults}
          errors={searchErrors}
          summary={searchSummary}
          progress={searchProgress}
          status={searchStatus}
          scopeLabel={searchSummary?.scopeLabel ?? ""}
          searchQuery={contentQuery}
          onCancel={cancelContentSearch}
          onClear={clearSearchResults}
          onFileClick={handleFileClick}
          onSnippetClick={handleSnippetClick}
          getGroupLabel={getGroupLabel}
        />
      ) : lastRun === "filename" ? (
        <div className="flex-1 overflow-y-auto pb-2">
          {filenameStatus === "searching" && (
            <div className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Searching on disk...
            </div>
          )}
          {loadedMatches.map(renderFilenameRow)}
          {streamed.map(renderFilenameRow)}
          {filenameStatus === "completed" &&
            loadedMatches.length === 0 &&
            streamed.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                No file names match &quot;{filenameQuery}&quot;
              </p>
            )}
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center px-6">
          <p className="text-center text-sm text-muted-foreground">
            Filename filters live; content search runs on Enter.
          </p>
        </div>
      )}
    </>
  );
}
