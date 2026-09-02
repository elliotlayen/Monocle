import { useCallback, useEffect, useMemo, useRef } from "react";
import { useShallow } from "zustand/shallow";
import {
  FileCode,
  FileText,
  Folder,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useExplorerStore, parseSearchTermsFrontend } from "../store";
import { useSearch } from "../hooks/use-search";
import { filenameResultsBatchHub } from "@/services/events";
import { SearchResults } from "./search-results";
import type { FilenameResultFile, TreeNode } from "../types";

const FILENAME_DEBOUNCE_MS = 250;
const MAX_LOADED_RESULTS = 50;

function nearestFolder(
  treeNodes: Map<string, TreeNode>,
  selectedPath: string | null
): TreeNode | null {
  if (!selectedPath) return null;
  const node = treeNodes.get(selectedPath);
  if (!node) return null;
  if (node.isDir) return node;
  return node.parentId ? (treeNodes.get(node.parentId) ?? null) : null;
}

function FilenameRowIcon({ name, isDir }: { name: string; isDir: boolean }) {
  if (isDir)
    return (
      <Folder className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
    );
  if (name.toLowerCase().endsWith(".xml"))
    return <FileCode className="h-3.5 w-3.5 flex-shrink-0" />;
  return (
    <FileText className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
  );
}

/** The Search sidebar view: filename or content search over a scope. */
export function SearchView() {
  const {
    folderSources,
    treeNodes,
    loadedFileIndex,
    selectedPath,
    searchMode,
    setSearchMode,
    searchScope,
    setSearchScope,
    searchFilePattern,
    setSearchFilePattern,
    searchQuery,
    setSearchQuery,
    searchStatus,
    searchResults,
    searchErrors,
    searchSummary,
    searchProgress,
    filenameStatus,
    filenameResults,
    filenameSummary,
    openFile,
    setActiveSearchTerms,
  } = useExplorerStore(
    useShallow((state) => ({
      folderSources: state.folderSources,
      treeNodes: state.treeNodes,
      loadedFileIndex: state.loadedFileIndex,
      selectedPath: state.selectedPath,
      searchMode: state.searchMode,
      setSearchMode: state.setSearchMode,
      searchScope: state.searchScope,
      setSearchScope: state.setSearchScope,
      searchFilePattern: state.searchFilePattern,
      setSearchFilePattern: state.setSearchFilePattern,
      searchQuery: state.searchQuery,
      setSearchQuery: state.setSearchQuery,
      searchStatus: state.searchStatus,
      searchResults: state.searchResults,
      searchErrors: state.searchErrors,
      searchSummary: state.searchSummary,
      searchProgress: state.searchProgress,
      filenameStatus: state.filenameStatus,
      filenameResults: state.filenameResults,
      filenameSummary: state.filenameSummary,
      openFile: state.openFile,
      setActiveSearchTerms: state.setActiveSearchTerms,
    }))
  );

  const inputRef = useRef<HTMLInputElement>(null);

  // Subscribe to content-search events while the view is mounted
  const { cancelContentSearch, clearSearchResults } = useSearch();

  // Subscribe to filename-search result batches
  useEffect(() => {
    return filenameResultsBatchHub.subscribe((payload) => {
      useExplorerStore
        .getState()
        .appendFilenameResults(payload.operationId, payload.results);
    });
  }, []);

  const selectedFolder = useMemo(
    () => nearestFolder(treeNodes, selectedPath),
    [treeNodes, selectedPath]
  );

  const resolveScope = useCallback((): {
    paths: string[];
    label: string;
  } | null => {
    const store = useExplorerStore.getState();
    if (store.searchScope === "all") {
      const paths = store.folderSources.map((s) => s.path);
      return paths.length > 0 ? { paths, label: "all sources" } : null;
    }
    if (store.searchScope === "selected") {
      const folder = nearestFolder(store.treeNodes, store.selectedPath);
      return folder ? { paths: [folder.path], label: folder.name } : null;
    }
    const sourceId = store.searchScope.slice("source:".length);
    const source = store.folderSources.find((s) => s.id === sourceId);
    return source ? { paths: [source.path], label: source.label } : null;
  }, []);

  const handleContentSearch = useCallback(() => {
    const store = useExplorerStore.getState();
    if (!store.searchQuery.trim()) return;
    const scope = resolveScope();
    if (!scope) return;
    store.startContentSearch(scope.paths, scope.label);
  }, [resolveScope]);

  // Filename mode: debounced live search of the scope on disk
  const filenameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  useEffect(() => {
    if (searchMode !== "filename") return;
    if (filenameDebounceRef.current) {
      clearTimeout(filenameDebounceRef.current);
    }
    if (!searchQuery.trim()) return;
    filenameDebounceRef.current = setTimeout(() => {
      const scope = resolveScope();
      if (!scope) return;
      useExplorerStore.getState().startFilenameSearch(scope.paths);
    }, FILENAME_DEBOUNCE_MS);
    return () => {
      if (filenameDebounceRef.current) {
        clearTimeout(filenameDebounceRef.current);
      }
    };
  }, [searchMode, searchQuery, searchScope, searchFilePattern, resolveScope]);

  // Instant local matches from files already loaded in the tree
  const loadedMatches = useMemo(() => {
    if (searchMode !== "filename") return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const scopePaths =
      searchScope === "all"
        ? folderSources.map((s) => s.path)
        : searchScope === "selected"
          ? selectedFolder
            ? [selectedFolder.path]
            : []
          : folderSources
              .filter((s) => s.id === searchScope.slice("source:".length))
              .map((s) => s.path);

    const inScope = (path: string) =>
      scopePaths.some(
        (root) =>
          path === root ||
          path.startsWith(root + "/") ||
          path.startsWith(root + "\\")
      );

    const matches: FilenameResultFile[] = [];
    for (const [id, lowerName] of loadedFileIndex) {
      if (matches.length >= MAX_LOADED_RESULTS) break;
      if (!lowerName.includes(q)) continue;
      const node = treeNodes.get(id);
      if (!node || node.type === "source") continue;
      if (!inScope(node.path)) continue;
      matches.push({
        path: node.path,
        name: node.name,
        isDir: node.isDir,
        parentFolder: node.path.slice(
          0,
          node.path.length - node.name.length - 1
        ),
      });
    }
    matches.sort((a, b) => a.name.localeCompare(b.name));
    return matches;
  }, [
    searchMode,
    searchQuery,
    searchScope,
    folderSources,
    selectedFolder,
    loadedFileIndex,
    treeNodes,
  ]);

  const loadedPathSet = useMemo(
    () => new Set(loadedMatches.map((m) => m.path)),
    [loadedMatches]
  );
  const onDiskMatches = useMemo(
    () => filenameResults.filter((r) => !loadedPathSet.has(r.path)),
    [filenameResults, loadedPathSet]
  );

  const handleFilenameResultClick = useCallback(
    (result: FilenameResultFile) => {
      const store = useExplorerStore.getState();
      if (result.isDir) {
        store.setActiveView("explorer");
        store.revealPath(result.path);
      } else {
        store.setSelectedPath(result.path);
        store.openFile(result.path);
      }
    },
    []
  );

  const handleFileClick = useCallback(
    (filePath: string) => {
      setActiveSearchTerms(parseSearchTermsFrontend(searchQuery));
      openFile(filePath);
    },
    [openFile, setActiveSearchTerms, searchQuery]
  );

  const handleSnippetClick = useCallback(
    (filePath: string, line: number) => {
      setActiveSearchTerms(parseSearchTermsFrontend(searchQuery));
      void openFile(filePath).then(() => {
        useExplorerStore.getState().jumpToProblem(filePath, line, 1);
      });
    },
    [openFile, setActiveSearchTerms, searchQuery]
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

  const hasContentActivity =
    searchStatus !== "idle" ||
    searchResults.length > 0 ||
    searchErrors.length > 0;

  const currentScopeLabel = (() => {
    if (searchScope === "all") return "all sources";
    if (searchScope === "selected") return selectedFolder?.name ?? "selection";
    const source = folderSources.find(
      (s) => s.id === searchScope.slice("source:".length)
    );
    return source?.label ?? "all sources";
  })();

  const renderFilenameSection = (
    heading: string,
    entries: FilenameResultFile[]
  ) =>
    entries.length > 0 && (
      <div>
        <p className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {heading}
        </p>
        {entries.map((result) => (
          <button
            key={result.path}
            type="button"
            className="flex w-full items-center gap-2 px-4 py-1 text-left hover:bg-muted"
            onClick={() => handleFilenameResultClick(result)}
            title={result.path}
          >
            <FilenameRowIcon name={result.name} isDir={result.isDir} />
            <span className="truncate text-sm">{result.name}</span>
            <span className="ml-auto truncate pl-3 text-xs text-muted-foreground">
              {getGroupLabel(result.parentFolder)}
            </span>
          </button>
        ))}
      </div>
    );

  const hasQuery = searchQuery.length > 0;

  return (
    <>
      <div className="flex flex-col gap-2 border-b p-3 pt-0 flex-shrink-0">
        {/* Mode toggle */}
        <div
          className="flex items-center h-7 rounded-md bg-muted border p-0.5 self-start"
          role="group"
          aria-label="Search mode"
        >
          <button
            className={cn(
              "h-full px-2.5 flex items-center text-xs font-medium rounded-sm",
              searchMode === "filename"
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setSearchMode("filename")}
            aria-pressed={searchMode === "filename"}
          >
            Filename
          </button>
          <button
            className={cn(
              "h-full px-2.5 flex items-center text-xs font-medium rounded-sm",
              searchMode === "content"
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setSearchMode("content")}
            aria-pressed={searchMode === "content"}
          >
            Content
          </button>
        </div>

        {/* Query input */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            id="explorer-content-search-input"
            role="searchbox"
            aria-label="Search"
            placeholder={
              searchMode === "filename"
                ? "Search file names..."
                : "Search file contents..."
            }
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && searchMode === "content") {
                handleContentSearch();
              }
              if (e.key === "Escape") {
                setSearchQuery("");
                if (searchMode === "content") clearSearchResults();
                inputRef.current?.blur();
              }
            }}
            className={`h-8 text-sm pl-8 ${hasQuery ? "pr-8" : ""}`}
          />
          {hasQuery && (
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Scope and pattern */}
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground flex-shrink-0">
            In
          </Label>
          <Select
            value={searchScope}
            onValueChange={(value) =>
              setSearchScope(value as typeof searchScope)
            }
          >
            <SelectTrigger className="h-7 flex-1 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {folderSources.map((source) => (
                <SelectItem key={source.id} value={`source:${source.id}`}>
                  Source: {source.label}
                </SelectItem>
              ))}
              <SelectItem value="selected" disabled={!selectedFolder}>
                {selectedFolder
                  ? `Selected folder: ${selectedFolder.name}`
                  : "Selected folder"}
              </SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={searchFilePattern}
            onChange={(e) => setSearchFilePattern(e.target.value)}
            aria-label="File pattern"
            className="h-7 w-20 flex-shrink-0 text-xs"
            placeholder="*.xml"
          />
        </div>
      </div>

      {searchMode === "filename" ? (
        hasQuery ? (
          <div className="flex-1 overflow-y-auto pb-2">
            {filenameStatus === "searching" && (
              <div className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Searching on disk...
              </div>
            )}
            {filenameSummary?.truncated && (
              <p className="px-4 py-1 text-xs text-warning">
                Showing the first {filenameSummary.totalMatched} matches.
                Refine your query for more precise results.
              </p>
            )}
            {renderFilenameSection("Loaded", loadedMatches)}
            {renderFilenameSection("On disk", onDiskMatches)}
            {filenameStatus === "completed" &&
              loadedMatches.length === 0 &&
              onDiskMatches.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No file names match &quot;{searchQuery}&quot; in{" "}
                  {currentScopeLabel}
                </p>
              )}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center px-6">
            <p className="text-center text-sm text-muted-foreground">
              Type to find files by name in {currentScopeLabel}.
            </p>
          </div>
        )
      ) : hasContentActivity ? (
        <SearchResults
          results={searchResults}
          errors={searchErrors}
          summary={searchSummary}
          progress={searchProgress}
          status={searchStatus}
          scopeLabel={searchSummary?.scopeLabel ?? currentScopeLabel}
          searchQuery={searchQuery}
          onCancel={cancelContentSearch}
          onClear={clearSearchResults}
          onFileClick={handleFileClick}
          onSnippetClick={handleSnippetClick}
          getGroupLabel={getGroupLabel}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center px-6">
          <p className="text-center text-sm text-muted-foreground">
            Searches file contents in {currentScopeLabel}. Press Enter to run.
          </p>
        </div>
      )}
    </>
  );
}
