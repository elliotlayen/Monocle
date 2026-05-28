import { useEffect, useCallback } from "react";
import { useShallow } from "zustand/shallow";
import { ArrowUpDown, Calendar, PanelLeftClose } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useExplorerStore, parseSearchTermsFrontend } from "../store";
import type { DateFilterPreset } from "../store";
import { useExplorerSidebar } from "../hooks/use-explorer-sidebar";
import { useSearch } from "../hooks/use-search";
import { FolderTree } from "./folder-tree";
import { SearchBar } from "./search-bar";
import { SearchResults } from "./search-results";

export function ExplorerSidebar() {
  const {
    sidebarOpen,
    sidebarWidth,
    setSidebarOpen,
    setSidebarWidth,
    dateSortOrder,
    toggleDateSort,
    dateFilterPreset,
    setDateFilterPreset,
    loadSources,
    searchMode,
    searchStatus,
    searchCheckedPaths,
    searchResults,
    searchErrors,
    searchSummary,
    searchProgress,
    searchQuery,
    openFile,
    setActiveSearchTerms,
  } = useExplorerStore(
    useShallow((state) => ({
      sidebarOpen: state.sidebarOpen,
      sidebarWidth: state.sidebarWidth,
      setSidebarOpen: state.setSidebarOpen,
      setSidebarWidth: state.setSidebarWidth,
      dateSortOrder: state.dateSortOrder,
      toggleDateSort: state.toggleDateSort,
      dateFilterPreset: state.dateFilterPreset,
      setDateFilterPreset: state.setDateFilterPreset,
      loadSources: state.loadSources,
      searchMode: state.searchMode,
      searchStatus: state.searchStatus,
      searchCheckedPaths: state.searchCheckedPaths,
      searchResults: state.searchResults,
      searchErrors: state.searchErrors,
      searchSummary: state.searchSummary,
      searchProgress: state.searchProgress,
      searchQuery: state.searchQuery,
      openFile: state.openFile,
      setActiveSearchTerms: state.setActiveSearchTerms,
    }))
  );

  // Subscribe to search events (searchResultHub, searchProgressHub)
  const { cancelContentSearch, clearSearchResults } = useSearch();

  const { width, isDragging, startDrag } = useExplorerSidebar(
    sidebarWidth,
    setSidebarWidth
  );

  // Load sources on mount
  useEffect(() => {
    loadSources();
  }, [loadSources]);

  // Derive scope label from checked paths
  const currentScopeLabel = (() => {
    if (searchCheckedPaths.size === 0) return "";
    const names = Array.from(searchCheckedPaths).map(
      (p) => p.split(/[/\\]/).pop() ?? p
    );
    if (names.length <= 2) return names.join(", ");
    return `${names.length} folders`;
  })();

  // Wire onSearch — uses checked paths
  const handleSearch = useCallback(() => {
    const store = useExplorerStore.getState();
    const paths = Array.from(store.searchCheckedPaths);

    if (paths.length > 0) {
      const names = paths.map((p) => p.split(/[/\\]/).pop() ?? p);
      const scopeLabel = names.length <= 2 ? names.join(", ") : `${names.length} folders`;
      store.startContentSearch(paths, scopeLabel);
    }
  }, []);

  // Wire onSearchExecute for SearchBar (Enter key in content mode)
  const handleSearchExecute = useCallback(() => {
    handleSearch();
  }, [handleSearch]);

  // Wire file click from search results
  const handleFileClick = useCallback(
    (filePath: string) => {
      setActiveSearchTerms(parseSearchTermsFrontend(searchQuery));
      openFile(filePath);
    },
    [openFile, setActiveSearchTerms, searchQuery]
  );

  const dateFilterLabels: Record<DateFilterPreset, string> = {
    all: "All dates",
    "7d": "Last 7 days",
    "30d": "Last 30 days",
    "90d": "Last 90 days",
  };

  // Determine what to show in the body area
  const showSearchResults =
    searchMode === "content" &&
    (searchStatus !== "idle" ||
      searchResults.length > 0 ||
      searchErrors.length > 0);

  return (
    <div
      className={cn(
        "relative flex-shrink-0 border-r bg-background overflow-hidden",
        !isDragging && "transition-[width] duration-300 ease-in-out"
      )}
      style={{ width: sidebarOpen ? width : 0 }}
    >
      {/* Inner container with fixed width to prevent content reflow */}
      <div
        className="flex flex-col h-full"
        style={{ width: sidebarOpen ? width : sidebarWidth }}
      >
        {/* Header */}
        <div className="flex-shrink-0 border-b p-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">Explorer</h2>
            <div className="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={toggleDateSort}
                    >
                      <ArrowUpDown className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      Sort:{" "}
                      {dateSortOrder === "newest"
                        ? "newest first"
                        : "oldest first"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <DropdownMenu>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "h-7 w-7",
                            dateFilterPreset !== "all" && "bg-accent"
                          )}
                        >
                          <Calendar className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Date filter: {dateFilterLabels[dateFilterPreset]}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <DropdownMenuContent align="end">
                  {(Object.entries(dateFilterLabels) as [DateFilterPreset, string][]).map(
                    ([value, label]) => (
                      <DropdownMenuCheckboxItem
                        key={value}
                        checked={dateFilterPreset === value}
                        onCheckedChange={() => setDateFilterPreset(value)}
                      >
                        {label}
                      </DropdownMenuCheckboxItem>
                    )
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setSidebarOpen(false)}
                title="Close sidebar"
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <SearchBar onSearchExecute={handleSearchExecute} />
        </div>

        {/* Body: SearchResults or FolderTree (with checkboxes in content mode) */}
        {showSearchResults ? (
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
          />
        ) : (
          <FolderTree />
        )}
      </div>

      {/* Resize handle */}
      <div
        className={cn(
          "absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-border",
          isDragging && "bg-primary/20"
        )}
        onMouseDown={startDrag}
      />
    </div>
  );
}
