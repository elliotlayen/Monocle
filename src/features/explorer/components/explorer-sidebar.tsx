import { useEffect, useCallback } from "react";
import { useShallow } from "zustand/shallow";
import { ArrowUpDown, PanelLeftClose } from "lucide-react";
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
import { SearchBar } from "./search-bar";
import { SearchControlsRow } from "./search-controls-row";

export function ExplorerSidebar() {
  const {
    sidebarOpen,
    sidebarWidth,
    setSidebarOpen,
    setSidebarWidth,
    dateSortOrder,
    toggleDateSort,
    loadSources,
    searchMode,
    searchStatus,
    setSearchScope,
    lastInteractedFolderPath,
    folderSources,
  } = useExplorerStore(
    useShallow((state) => ({
      sidebarOpen: state.sidebarOpen,
      sidebarWidth: state.sidebarWidth,
      setSidebarOpen: state.setSidebarOpen,
      setSidebarWidth: state.setSidebarWidth,
      dateSortOrder: state.dateSortOrder,
      toggleDateSort: state.toggleDateSort,
      loadSources: state.loadSources,
      searchMode: state.searchMode,
      searchStatus: state.searchStatus,
      setSearchScope: state.setSearchScope,
      lastInteractedFolderPath: state.lastInteractedFolderPath,
      folderSources: state.folderSources,
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

  // D-13: Scope auto-updates to "folder" when tree selection changes while idle
  useEffect(() => {
    if (lastInteractedFolderPath && searchStatus === "idle") {
      setSearchScope("folder");
    }
  }, [lastInteractedFolderPath, searchStatus, setSearchScope]);

  // Derive selected node props for SearchControlsRow
  const selectedNodePath = lastInteractedFolderPath;
  const selectedNodeName = selectedNodePath
    ? selectedNodePath.split(/[/\\]/).pop() ?? selectedNodePath
    : null;

  // Find which source contains the selected node
  const selectedSourceLabel = (() => {
    if (!selectedNodePath) return null;
    for (const source of folderSources) {
      if (selectedNodePath.startsWith(source.path)) {
        return source.label;
      }
    }
    return null;
  })();

  const selectedSourcePath = (() => {
    if (!selectedNodePath) return null;
    for (const source of folderSources) {
      if (selectedNodePath.startsWith(source.path)) {
        return source.path;
      }
    }
    return null;
  })();

  // Wire onSearch for SearchControlsRow
  const handleSearch = useCallback(() => {
    const store = useExplorerStore.getState();
    const { searchScope: scope, folderSources: sources } = store;

    let paths: string[] = [];
    let scopeLabel = "";

    if (scope === "folder" && selectedNodePath) {
      paths = [selectedNodePath];
      scopeLabel = `Folder: ${selectedNodeName}`;
    } else if (scope === "source" && selectedSourcePath) {
      paths = [selectedSourcePath];
      scopeLabel = `Source: ${selectedSourceLabel}`;
    } else if (scope === "all") {
      paths = sources.map((s) => s.path);
      scopeLabel = "All sources";
    }

    if (paths.length > 0) {
      store.startContentSearch(paths, scopeLabel);
    }
  }, [selectedNodePath, selectedNodeName, selectedSourcePath, selectedSourceLabel]);

  // Wire onSearchExecute for SearchBar (Enter key in content mode)
  const handleSearchExecute = useCallback(() => {
    handleSearch();
  }, [handleSearch]);

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

        {/* Content search controls row (visible only in content mode) */}
        {searchMode === "content" && (
          <SearchControlsRow
            selectedNodePath={selectedNodePath}
            selectedNodeName={selectedNodeName}
            selectedSourceLabel={selectedSourceLabel}
            isSearching={searchStatus === "searching"}
            onSearch={handleSearch}
          />
        )}

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
