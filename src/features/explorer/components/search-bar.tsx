import { useRef } from "react";
import { useShallow } from "zustand/shallow";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useExplorerStore } from "../store";

interface SearchBarProps {
  onSearchExecute: () => void;
}

/** Content-search input for the Search view. Enter runs the search. */
export function SearchBar({ onSearchExecute }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const { searchQuery, setSearchQuery, clearSearchResults } = useExplorerStore(
    useShallow((state) => ({
      searchQuery: state.searchQuery,
      setSearchQuery: state.setSearchQuery,
      clearSearchResults: state.clearSearchResults,
    }))
  );

  const hasQuery = searchQuery.length > 0;

  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        ref={inputRef}
        id="explorer-content-search-input"
        role="searchbox"
        aria-label="Search file contents"
        placeholder="Search file contents..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onSearchExecute();
          }
          if (e.key === "Escape") {
            setSearchQuery("");
            clearSearchResults();
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
  );
}
