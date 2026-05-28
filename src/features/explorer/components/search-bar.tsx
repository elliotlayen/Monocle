import { useShallow } from "zustand/shallow";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useExplorerStore } from "../store";

interface SearchBarProps {
  onSearchExecute: () => void;
}

export function SearchBar({ onSearchExecute }: SearchBarProps) {
  const { searchMode, searchQuery, setSearchMode, setSearchQuery } =
    useExplorerStore(
      useShallow((state) => ({
        searchMode: state.searchMode,
        searchQuery: state.searchQuery,
        setSearchMode: state.setSearchMode,
        setSearchQuery: state.setSearchQuery,
      }))
    );

  const placeholder =
    searchMode === "filename" ? "Search files..." : "Search file contents...";

  const hasQuery = searchQuery.length > 0;

  return (
    <div className="flex items-center gap-2">
      {/* Search input with icon */}
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          role="searchbox"
          aria-label="Search files"
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && searchMode === "content") {
              onSearchExecute();
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

      {/* Segmented toggle */}
      <TooltipProvider>
        <div
          className="flex items-center rounded-md border bg-muted/50 p-0.5"
          role="group"
          aria-label="Search mode"
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className={`h-6 px-2 text-xs font-semibold rounded-sm ${
                  searchMode === "filename"
                    ? "bg-background shadow-sm"
                    : "bg-transparent hover:bg-transparent"
                }`}
                onClick={() => setSearchMode("filename")}
                aria-pressed={searchMode === "filename"}
              >
                Filename
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Search filenames (Cmd+F)</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className={`h-6 px-2 text-xs font-semibold rounded-sm ${
                  searchMode === "content"
                    ? "bg-background shadow-sm"
                    : "bg-transparent hover:bg-transparent"
                }`}
                onClick={() => setSearchMode("content")}
                aria-pressed={searchMode === "content"}
              >
                Content
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Search file contents (Cmd+Shift+F)</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  );
}
