import { useCallback, useMemo } from "react";
import { useShallow } from "zustand/shallow";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useExplorerStore, parseSearchTermsFrontend } from "../store";
import { useSearch } from "../hooks/use-search";
import { SearchBar } from "./search-bar";
import { SearchResults } from "./search-results";
import type { TreeNode } from "../types";

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

/** The Search sidebar view: query, scope, pattern, and streamed results. */
export function SearchView() {
  const {
    folderSources,
    treeNodes,
    selectedPath,
    searchScope,
    setSearchScope,
    searchFilePattern,
    setSearchFilePattern,
    searchStatus,
    searchResults,
    searchErrors,
    searchSummary,
    searchProgress,
    searchQuery,
    openFile,
    setActiveSearchTerms,
  } = useExplorerStore(
    useShallow((state) => ({
      folderSources: state.folderSources,
      treeNodes: state.treeNodes,
      selectedPath: state.selectedPath,
      searchScope: state.searchScope,
      setSearchScope: state.setSearchScope,
      searchFilePattern: state.searchFilePattern,
      setSearchFilePattern: state.setSearchFilePattern,
      searchStatus: state.searchStatus,
      searchResults: state.searchResults,
      searchErrors: state.searchErrors,
      searchSummary: state.searchSummary,
      searchProgress: state.searchProgress,
      searchQuery: state.searchQuery,
      openFile: state.openFile,
      setActiveSearchTerms: state.setActiveSearchTerms,
    }))
  );

  // Subscribe to search events while the view is mounted
  const { cancelContentSearch, clearSearchResults } = useSearch();

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

  const handleSearch = useCallback(() => {
    const store = useExplorerStore.getState();
    if (!store.searchQuery.trim()) return;
    const scope = resolveScope();
    if (!scope) return;
    store.startContentSearch(scope.paths, scope.label);
  }, [resolveScope]);

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

  const hasActivity =
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

  return (
    <>
      <div className="flex flex-col gap-2 border-b p-3 pt-0 flex-shrink-0">
        <SearchBar onSearchExecute={handleSearch} />
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

      {hasActivity ? (
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
