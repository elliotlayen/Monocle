import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/shallow";
import {
  CalendarIcon,
  Clock,
  FileCode,
  ListFilter,
  Search,
  Star,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { format } from "date-fns";
import { useExplorerStore } from "../store";
import { ScopeTree } from "./scope-tree";
import type { DateRange as DayPickerRange } from "react-day-picker";

/** Live filename search debounce. */
const FILENAME_DEBOUNCE_MS = 250;

export const FILENAME_INPUT_ID = "explorer-filename-input";
export const CONTENT_INPUT_ID = "explorer-content-input";

function QueryClearButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors duration-[var(--duration-fast)] hover:text-foreground"
      onClick={onClick}
      aria-label="Clear"
    >
      <X className="h-3.5 w-3.5" />
    </button>
  );
}

export function SearchPanel() {
  const {
    folderSources,
    searchSourceId,
    setSearchSource,
    filenameQuery,
    setFilenameQuery,
    contentQuery,
    setContentQuery,
    lastRun,
    scopePaths,
    removeScopePath,
    clearScope,
    searchFilePattern,
    setSearchFilePattern,
    searchRegex,
    setSearchRegex,
    searchCaseSensitive,
    setSearchCaseSensitive,
    savedSearches,
    searchHistory,
    dateRange,
    setDateRange,
  } = useExplorerStore(
    useShallow((state) => ({
      folderSources: state.folderSources,
      searchSourceId: state.searchSourceId,
      setSearchSource: state.setSearchSource,
      filenameQuery: state.filenameQuery,
      setFilenameQuery: state.setFilenameQuery,
      contentQuery: state.contentQuery,
      setContentQuery: state.setContentQuery,
      lastRun: state.lastRun,
      scopePaths: state.scopePaths,
      removeScopePath: state.removeScopePath,
      clearScope: state.clearScope,
      searchFilePattern: state.searchFilePattern,
      setSearchFilePattern: state.setSearchFilePattern,
      searchRegex: state.searchRegex,
      setSearchRegex: state.setSearchRegex,
      searchCaseSensitive: state.searchCaseSensitive,
      setSearchCaseSensitive: state.setSearchCaseSensitive,
      savedSearches: state.savedSearches,
      searchHistory: state.searchHistory,
      dateRange: state.dateRange,
      setDateRange: state.setDateRange,
    }))
  );

  const activeSource =
    folderSources.find((s) => s.id === searchSourceId) ?? folderSources[0];

  // Live filename search, debounced; also reruns when scope/flags change.
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
  }, [filenameQuery, scopePaths, searchRegex, searchCaseSensitive]);

  const [saveName, setSaveName] = useState("");
  const canSave =
    (lastRun === "content" ? contentQuery : filenameQuery).trim().length > 0 &&
    saveName.trim().length > 0;
  const handleSave = () => {
    if (!canSave) return;
    const store = useExplorerStore.getState();
    const mode = lastRun ?? (contentQuery.trim() ? "content" : "filename");
    store.saveSearch({
      name: saveName.trim(),
      query: mode === "content" ? contentQuery.trim() : filenameQuery.trim(),
      mode,
      regex: searchRegex,
      caseSensitive: searchCaseSensitive,
      filePattern: searchFilePattern,
    });
    setSaveName("");
  };

  const scopeChips =
    scopePaths.size > 0 ? (
      [...scopePaths].map((path) => {
        const label = activeSource
          ? path === activeSource.path
            ? activeSource.label
            : path.slice(activeSource.path.length + 1).replace(/\\/g, "/")
          : path;
        return (
          <span
            key={path}
            className="inline-flex h-6 items-center gap-1 rounded-md border border-accent-blue/35 bg-accent-blue/12 py-0 pl-2 pr-1 text-[10.5px]"
            title={path}
          >
            <span className="max-w-56 truncate">{label}</span>
            <button
              type="button"
              className="flex h-4 w-4 items-center justify-center rounded-sm text-muted-foreground transition-colors duration-[var(--duration-fast)] hover:bg-accent-blue/25 hover:text-foreground"
              onClick={() => removeScopePath(path)}
              aria-label={`Remove ${label} from scope`}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        );
      })
    ) : (
      <span className="inline-flex h-6 items-center rounded-md border bg-muted px-2 text-[10.5px] text-muted-foreground">
        whole location
      </span>
    );

  return (
    <div className="panel-glass relative z-30 flex-shrink-0 overflow-visible">
      <div className="flex flex-col gap-2 p-3">
        {/* Row 1: location, filename query, saved searches, history */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="h-[26px] max-w-52 rounded-md border bg-muted px-1.5 text-[11px]"
            aria-label="Location"
            value={activeSource?.id ?? ""}
            onChange={(e) => setSearchSource(e.target.value)}
          >
            {folderSources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.label}
              </option>
            ))}
          </select>
          <div className="relative min-w-52 flex-1">
            <FileCode className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={FILENAME_INPUT_ID}
              aria-label="Filename search"
              placeholder="Filter file names - live"
              value={filenameQuery}
              onChange={(e) => setFilenameQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setFilenameQuery("");
                  (e.target as HTMLInputElement).blur();
                }
                if (e.key === "Enter" && filenameQuery.trim()) {
                  useExplorerStore
                    .getState()
                    .pushSearchHistory(filenameQuery, "filename");
                }
              }}
              className={cn("h-8 pl-8 text-sm", filenameQuery && "pr-8")}
            />
            {filenameQuery && (
              <QueryClearButton onClick={() => setFilenameQuery("")} />
            )}
          </div>

          <DropdownMenu>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                    >
                      <Star className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Saved searches</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Saved searches
              </DropdownMenuLabel>
              {savedSearches.length === 0 && (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">
                  Nothing saved yet.
                </p>
              )}
              {savedSearches.map((saved) => (
                <DropdownMenuItem
                  key={saved.name}
                  onClick={() =>
                    useExplorerStore.getState().applySavedSearch(saved.name)
                  }
                >
                  <Star className="h-3.5 w-3.5 fill-warning text-warning" />
                  <span className="truncate">{saved.name}</span>
                  <span className="ml-auto flex items-center gap-1 pl-3 text-[10px] text-muted-foreground">
                    {saved.mode}
                    <button
                      type="button"
                      className="flex h-4 w-4 items-center justify-center rounded-sm hover:bg-muted hover:text-foreground"
                      aria-label={`Delete saved search ${saved.name}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        useExplorerStore
                          .getState()
                          .deleteSavedSearch(saved.name);
                      }}
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <div
                className="flex items-center gap-1.5 p-1.5"
                onKeyDown={(e) => e.stopPropagation()}
              >
                <Input
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="Save current search as..."
                  className="h-7 flex-1 text-xs"
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") handleSave();
                  }}
                />
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-7 px-2 text-xs"
                  disabled={!canSave}
                  onClick={handleSave}
                >
                  Save
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                    >
                      <Clock className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent>Search history</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Recent searches
              </DropdownMenuLabel>
              {searchHistory.length === 0 && (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">
                  No searches yet.
                </p>
              )}
              {searchHistory.map((entry) => (
                <DropdownMenuItem
                  key={`${entry.mode}:${entry.query}`}
                  onClick={() =>
                    useExplorerStore.getState().applyHistoryEntry(entry)
                  }
                >
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="truncate">{entry.query}</span>
                  <span className="ml-auto pl-3 text-[10px] text-muted-foreground">
                    {entry.mode}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Row 2: content query */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id={CONTENT_INPUT_ID}
            aria-label="Content search"
            placeholder="Search file contents - press Enter to run"
            value={contentQuery}
            onChange={(e) => setContentQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                void useExplorerStore.getState().startContentSearch();
              }
              if (e.key === "Escape") {
                setContentQuery("");
                (e.target as HTMLInputElement).blur();
              }
            }}
            className={cn("h-8 pl-8 text-sm", contentQuery && "pr-8")}
          />
          {contentQuery && (
            <QueryClearButton onClick={() => setContentQuery("")} />
          )}
        </div>

        {/* Row 3: scope */}
        <div
          className="flex flex-wrap items-center gap-1.5"
          id="explorer-scope-row"
        >
          <span className="text-[10px] text-muted-foreground">in</span>
          {scopeChips}
          <Popover
            onOpenChange={(open) => {
              if (!open) return;
              // Make sure the source's top-level folders are loaded
              const store = useExplorerStore.getState();
              const source =
                store.folderSources.find(
                  (s) => s.id === store.searchSourceId
                ) ?? store.folderSources[0];
              const root = source ? store.treeNodes.get(source.id) : undefined;
              if (root && root.loadState === "idle") {
                void store.expandNode(root.id);
              }
            }}
          >
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex h-6 items-center gap-1.5 rounded-md border px-2 text-[10.5px] transition-[transform,background-color,border-color,color] duration-[var(--duration-fast)] ease-[var(--ease-out)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring active:scale-[0.97]",
                  scopePaths.size > 0
                    ? "border-accent-blue text-accent-blue"
                    : "border-border bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <ListFilter className="h-3 w-3" /> Choose folders
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 p-0">
              <p className="border-b px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Scope: {activeSource?.label ?? ""}
              </p>
              <ScopeTree />
              <div className="flex items-center gap-2 border-t px-3 py-1.5 text-[10.5px] text-muted-foreground">
                Checked folders (and everything inside) are searched.
                <button
                  type="button"
                  className="ml-auto text-accent-blue hover:underline"
                  onClick={clearScope}
                >
                  Clear
                </button>
              </div>
            </PopoverContent>
          </Popover>
          {scopePaths.size > 0 && (
            <button
              type="button"
              className="text-[10.5px] text-muted-foreground transition-colors duration-[var(--duration-fast)] hover:text-foreground"
              onClick={clearScope}
            >
              Clear
            </button>
          )}
        </div>

        {/* Row 4: pattern, dates, regex/case */}
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={searchFilePattern}
            onChange={(e) => setSearchFilePattern(e.target.value)}
            aria-label="File pattern"
            placeholder="*.xml"
            className="h-[26px] w-20 text-[11px]"
          />
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-[26px] gap-1.5 border px-2 text-[11px] font-normal",
                  dateRange?.from
                    ? "border-accent-blue/40 bg-accent-blue/10 text-foreground"
                    : "border-border bg-muted text-muted-foreground"
                )}
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                {dateRange?.from
                  ? dateRange.to
                    ? `${format(dateRange.from, "MMM d")} - ${format(dateRange.to, "MMM d, yyyy")}`
                    : format(dateRange.from, "MMM d, yyyy")
                  : "Any date"}
                {dateRange?.from && (
                  <span
                    role="button"
                    tabIndex={0}
                    className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-sm hover:bg-accent-blue/25"
                    aria-label="Clear date range"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDateRange(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.stopPropagation();
                        setDateRange(null);
                      }
                    }}
                  >
                    <X className="h-2.5 w-2.5" />
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto overflow-hidden p-0"
              align="start"
            >
              <Calendar
                mode="range"
                defaultMonth={dateRange?.from ?? undefined}
                selected={
                  dateRange?.from ? (dateRange as DayPickerRange) : undefined
                }
                onSelect={(range: DayPickerRange | undefined) =>
                  setDateRange(range ?? null)
                }
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "h-[26px] rounded-md border px-2 text-[11px] transition-[transform,background-color,border-color,color] duration-[var(--duration-fast)] ease-[var(--ease-out)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring active:scale-[0.97]",
                    searchRegex
                      ? "border-accent-blue bg-accent-blue/12 text-accent-blue"
                      : "border-border bg-muted text-muted-foreground hover:text-foreground"
                  )}
                  aria-pressed={searchRegex}
                  onClick={() => setSearchRegex(!searchRegex)}
                >
                  .*
                </button>
              </TooltipTrigger>
              <TooltipContent>Regular expression</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "h-[26px] rounded-md border px-2 text-[11px] transition-[transform,background-color,border-color,color] duration-[var(--duration-fast)] ease-[var(--ease-out)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring active:scale-[0.97]",
                    searchCaseSensitive
                      ? "border-accent-blue bg-accent-blue/12 text-accent-blue"
                      : "border-border bg-muted text-muted-foreground hover:text-foreground"
                  )}
                  aria-pressed={searchCaseSensitive}
                  onClick={() => setSearchCaseSensitive(!searchCaseSensitive)}
                >
                  Aa
                </button>
              </TooltipTrigger>
              <TooltipContent>Case sensitive</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <span className="ml-auto truncate text-[10px] text-muted-foreground">
            {activeSource?.path ?? ""}
          </span>
        </div>
      </div>
    </div>
  );
}
