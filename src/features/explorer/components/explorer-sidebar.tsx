import { useEffect } from "react";
import { useShallow } from "zustand/shallow";
import { Search, ArrowUpDown, PanelLeftClose } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useExplorerStore } from "../store";
import { useExplorerSidebar } from "../hooks/use-explorer-sidebar";
import { FolderTree } from "./folder-tree";

export function ExplorerSidebar() {
  const {
    sidebarOpen,
    sidebarWidth,
    setSidebarOpen,
    setSidebarWidth,
    filterText,
    setFilterText,
    dateSortOrder,
    toggleDateSort,
    loadSources,
  } = useExplorerStore(
    useShallow((state) => ({
      sidebarOpen: state.sidebarOpen,
      sidebarWidth: state.sidebarWidth,
      setSidebarOpen: state.setSidebarOpen,
      setSidebarWidth: state.setSidebarWidth,
      filterText: state.filterText,
      setFilterText: state.setFilterText,
      dateSortOrder: state.dateSortOrder,
      toggleDateSort: state.toggleDateSort,
      loadSources: state.loadSources,
    }))
  );

  const { width, isDragging, startDrag } = useExplorerSidebar(
    sidebarWidth,
    setSidebarWidth
  );

  // Load sources on mount
  useEffect(() => {
    loadSources();
  }, [loadSources]);

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
        style={{ width: sidebarWidth }}
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
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter clients..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>

        {/* Tree body */}
        <FolderTree />
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
