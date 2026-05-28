import { useEffect, useCallback, useState } from "react";
import { useShallow } from "zustand/shallow";
import { ArrowUpDown, CalendarIcon, Filter, PanelLeftClose } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useExplorerStore, parseSearchTermsFrontend } from "../store";
import { useExplorerSidebar } from "../hooks/use-explorer-sidebar";
import { useSearch } from "../hooks/use-search";
import { FolderTree } from "./folder-tree";
import { SearchBar } from "./search-bar";
import { SearchResults } from "./search-results";
import type { DateRange } from "react-day-picker";

export function ExplorerSidebar() {
  const {
    sidebarOpen,
    sidebarWidth,
    setSidebarOpen,
    setSidebarWidth,
    dateSortOrder,
    toggleDateSort,
    dateRange,
    setDateRange,
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
      dateRange: state.dateRange,
      setDateRange: state.setDateRange,
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

  const [dateDialogOpen, setDateDialogOpen] = useState(false);
  const hasDateFilter = dateRange?.from != null;

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
              <Dialog open={dateDialogOpen} onOpenChange={setDateDialogOpen}>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <DialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            "h-7 w-7",
                            hasDateFilter && "bg-accent"
                          )}
                        >
                          <Filter className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{hasDateFilter ? "Filters active" : "Filters"}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <DialogContent className="flex flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl sm:h-[min(90vh,42rem)]">
                  <div className="flex items-center justify-between pl-6 pr-14 h-14 flex-shrink-0 border-b">
                    <DialogHeader className="p-0">
                      <DialogTitle>Filters</DialogTitle>
                    </DialogHeader>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn("h-7 px-2 text-xs", !hasDateFilter && "invisible")}
                      onClick={() => setDateRange(null)}
                    >
                      Clear all
                    </Button>
                  </div>
                  <div className="flex flex-col gap-4 p-6 overflow-y-auto">
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-medium">Date range</label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start px-3 font-normal"
                          >
                            <CalendarIcon className="h-4 w-4" />
                            {dateRange?.from ? (
                              dateRange.to ? (
                                <>
                                  {format(dateRange.from, "LLL dd, y")} -{" "}
                                  {format(dateRange.to, "LLL dd, y")}
                                </>
                              ) : (
                                format(dateRange.from, "LLL dd, y")
                              )
                            ) : (
                              <span className="text-muted-foreground">Pick a date range</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 overflow-hidden" align="start">
                          <Calendar
                            mode="range"
                            defaultMonth={dateRange?.from ?? undefined}
                            selected={dateRange?.from ? dateRange as DateRange : undefined}
                            onSelect={(range: DateRange | undefined) => setDateRange(range ?? null)}
                            numberOfMonths={2}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
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
