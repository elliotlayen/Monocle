import { useEffect, useState } from "react";
import { useShallow } from "zustand/shallow";
import {
  ArrowUpDown,
  CalendarIcon,
  Filter,
  PanelLeftClose,
  Search,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useExplorerStore } from "../store";
import { FolderTree } from "./folder-tree";
import { SearchView } from "./search-view";
import { ScanView } from "./scan-view";
import type { DateRange } from "react-day-picker";

interface ExplorerSidebarProps {
  width: number;
  isDragging: boolean;
  startDrag: (e: React.MouseEvent) => void;
}

const VIEW_TITLES = {
  explorer: "Explorer",
  search: "Search",
  scan: "Scan",
} as const;

export function ExplorerSidebar({
  width,
  isDragging,
  startDrag,
}: ExplorerSidebarProps) {
  const {
    sidebarOpen,
    setSidebarOpen,
    activeView,
    dateSortOrder,
    toggleDateSort,
    dateRange,
    setDateRange,
    loadSources,
    filterInputText,
    setFilterText,
  } = useExplorerStore(
    useShallow((state) => ({
      sidebarOpen: state.sidebarOpen,
      setSidebarOpen: state.setSidebarOpen,
      activeView: state.activeView,
      dateSortOrder: state.dateSortOrder,
      toggleDateSort: state.toggleDateSort,
      dateRange: state.dateRange,
      setDateRange: state.setDateRange,
      loadSources: state.loadSources,
      filterInputText: state.filterInputText,
      setFilterText: state.setFilterText,
    }))
  );

  const [dateDialogOpen, setDateDialogOpen] = useState(false);
  const hasDateFilter = dateRange?.from != null;

  // Load sources on mount
  useEffect(() => {
    loadSources();
  }, [loadSources]);

  return (
    <div
      className={cn(
        "panel-glass absolute bottom-3 left-[68px] top-14 z-10 flex flex-col overflow-hidden",
        !isDragging &&
          "transition-transform duration-[var(--duration-slow)] ease-[var(--ease-out)]",
        sidebarOpen ? "translate-x-0" : "-translate-x-[calc(100%+5rem)]"
      )}
      style={{ width }}
    >
      {/* Header */}
      <div
        className={cn(
          "flex-shrink-0 p-3",
          activeView === "explorer" && "border-b"
        )}
      >
        <div
          className={cn(
            "flex items-center justify-between",
            activeView === "explorer" && "mb-2"
          )}
        >
          <h2 className="pl-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {VIEW_TITLES[activeView]}
          </h2>
          <div className="flex items-center gap-1">
            {activeView === "explorer" && (
              <>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={toggleDateSort}
                      >
                        <ArrowUpDown className="h-3.5 w-3.5" />
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
                              "h-6 w-6",
                              hasDateFilter &&
                                "bg-accent-blue/15 text-accent-blue hover:bg-accent-blue/20 hover:text-accent-blue"
                            )}
                          >
                            <Filter className="h-3.5 w-3.5" />
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
                        className={cn(
                          "h-7 px-2 text-xs",
                          !hasDateFilter && "invisible"
                        )}
                        onClick={() => setDateRange(null)}
                      >
                        Clear all
                      </Button>
                    </div>
                    <div className="flex flex-col gap-4 p-6 overflow-y-auto">
                      <div className="flex flex-col gap-2">
                        <Label>Date range</Label>
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
                                <span className="text-muted-foreground">
                                  Pick a date range
                                </span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-auto p-0 overflow-hidden"
                            align="start"
                          >
                            <Calendar
                              mode="range"
                              defaultMonth={dateRange?.from ?? undefined}
                              selected={
                                dateRange?.from
                                  ? (dateRange as DateRange)
                                  : undefined
                              }
                              onSelect={(range: DateRange | undefined) =>
                                setDateRange(range ?? null)
                              }
                              numberOfMonths={2}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setSidebarOpen(false)}
              title="Close sidebar"
            >
              <PanelLeftClose className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        {activeView === "explorer" && (
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="explorer-filter-input"
              role="searchbox"
              aria-label="Filter files by name"
              placeholder="Filter by filename..."
              value={filterInputText}
              onChange={(e) => setFilterText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setFilterText("");
                  (e.target as HTMLInputElement).blur();
                }
              }}
              className={`h-8 text-sm pl-8 ${filterInputText ? "pr-8" : ""}`}
            />
            {filterInputText && (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
                onClick={() => setFilterText("")}
                aria-label="Clear filter"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Body per view */}
      {activeView === "scan" ? (
        <ScanView />
      ) : activeView === "search" ? (
        <SearchView />
      ) : (
        <FolderTree />
      )}

      {/* Resize handle */}
      <div
        className={cn(
          "absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-accent-blue/40",
          isDragging && "bg-accent-blue/30"
        )}
        onMouseDown={startDrag}
      />
    </div>
  );
}
