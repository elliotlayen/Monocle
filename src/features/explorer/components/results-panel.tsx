import { useCallback } from "react";
import { useShallow } from "zustand/shallow";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useExplorerStore, parseSearchTermsFrontend } from "../store";
import { FolderTree } from "./folder-tree";
import { FilenameResults } from "./filename-results";
import { SearchResults } from "./search-results";

interface ResultsPanelProps {
  width: number;
  isDragging: boolean;
  startDrag: (e: React.MouseEvent) => void;
}

/** Left panel: search results (filename or content) and the Browse tree. */
export function ResultsPanel({ width, isDragging, startDrag }: ResultsPanelProps) {
  const {
    resultsPanelMode,
    setResultsPanelMode,
    lastRun,
    contentQuery,
    searchStatus,
    searchResults,
    searchErrors,
    searchSummary,
    searchProgress,
    dateSortOrder,
    toggleDateSort,
    openFile,
    setActiveSearchTerms,
    cancelContentSearch,
    clearSearchResults,
  } = useExplorerStore(
    useShallow((state) => ({
      resultsPanelMode: state.resultsPanelMode,
      setResultsPanelMode: state.setResultsPanelMode,
      lastRun: state.lastRun,
      contentQuery: state.contentQuery,
      searchStatus: state.searchStatus,
      searchResults: state.searchResults,
      searchErrors: state.searchErrors,
      searchSummary: state.searchSummary,
      searchProgress: state.searchProgress,
      dateSortOrder: state.dateSortOrder,
      toggleDateSort: state.toggleDateSort,
      openFile: state.openFile,
      setActiveSearchTerms: state.setActiveSearchTerms,
      cancelContentSearch: state.cancelContentSearch,
      clearSearchResults: state.clearSearchResults,
    }))
  );

  const showBrowse = resultsPanelMode === "browse";

  const handleFileClick = useCallback(
    (filePath: string) => {
      const store = useExplorerStore.getState();
      store.setSelectedPath(filePath);
      if (!store.searchRegex) {
        setActiveSearchTerms(parseSearchTermsFrontend(store.contentQuery));
      }
      void openFile(filePath);
    },
    [openFile, setActiveSearchTerms]
  );

  const handleSnippetClick = useCallback(
    (filePath: string, line: number) => {
      const store = useExplorerStore.getState();
      store.setSelectedPath(filePath);
      if (!store.searchRegex) {
        setActiveSearchTerms(parseSearchTermsFrontend(store.contentQuery));
      }
      void openFile(filePath).then(() => {
        useExplorerStore.getState().jumpToProblem(filePath, line, 1);
      });
    },
    [openFile, setActiveSearchTerms]
  );

  const getGroupLabel = useCallback((folderPath: string) => {
    const { folderSources } = useExplorerStore.getState();
    const source = folderSources.find(
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

  const title = showBrowse
    ? "Browse"
    : lastRun === "content"
      ? "Content results"
      : "Filename results";

  return (
    <div
      className="panel-glass relative flex flex-shrink-0 flex-col overflow-hidden"
      style={{ width }}
    >
      <div className="flex flex-shrink-0 items-center gap-2 px-3 pb-1.5 pt-2.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        {showBrowse && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-muted-foreground"
                  onClick={toggleDateSort}
                >
                  <ArrowUpDown className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Sort: {dateSortOrder === "newest" ? "newest first" : "oldest first"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        <div className="ml-auto flex gap-0.5 rounded-md bg-muted p-0.5">
          <button
            type="button"
            className={cn(
              "rounded px-2 py-0.5 text-[10.5px]",
              !showBrowse
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-pressed={!showBrowse}
            onClick={() => setResultsPanelMode("results")}
          >
            Results
          </button>
          <button
            type="button"
            className={cn(
              "rounded px-2 py-0.5 text-[10.5px]",
              showBrowse
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            aria-pressed={showBrowse}
            onClick={() => setResultsPanelMode("browse")}
          >
            Browse
          </button>
        </div>
      </div>

      {showBrowse ? (
        <FolderTree />
      ) : lastRun === "content" ? (
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
      ) : (
        <FilenameResults />
      )}

      {/* Resize handle */}
      <div
        className={cn(
          "absolute bottom-0 right-0 top-0 w-1 cursor-col-resize hover:bg-accent-blue/40",
          isDragging && "bg-accent-blue/30"
        )}
        onMouseDown={startDrag}
      />
    </div>
  );
}
