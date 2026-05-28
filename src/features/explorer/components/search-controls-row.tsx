import { useShallow } from "zustand/shallow";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useExplorerStore } from "../store";

interface SearchControlsRowProps {
  selectedNodePath: string | null;
  selectedNodeName: string | null;
  selectedSourceLabel: string | null;
  isSearching: boolean;
  onSearch: () => void;
}

export function SearchControlsRow({
  selectedNodePath,
  selectedNodeName,
  selectedSourceLabel,
  isSearching,
  onSearch,
}: SearchControlsRowProps) {
  const { searchScope, setSearchScope, searchFilePattern, setSearchFilePattern, searchStatus } =
    useExplorerStore(
      useShallow((state) => ({
        searchScope: state.searchScope,
        setSearchScope: state.setSearchScope,
        searchFilePattern: state.searchFilePattern,
        setSearchFilePattern: state.setSearchFilePattern,
        searchStatus: state.searchStatus,
      }))
    );

  const scopeDisabled = searchStatus !== "idle";

  const folderLabel = selectedNodePath
    ? `Folder: ${selectedNodeName}`
    : "Selected folder";

  const sourceLabel = selectedSourceLabel
    ? `Source: ${selectedSourceLabel}`
    : "This source";

  const searchDisabled =
    (!selectedNodePath && searchScope !== "all") || isSearching;

  return (
    <div className="flex items-center gap-2 px-3 pb-2">
      {/* Scope dropdown */}
      <Select
        value={searchScope}
        onValueChange={(value) =>
          setSearchScope(value as "folder" | "source" | "all")
        }
        disabled={scopeDisabled}
      >
        <SelectTrigger
          className="h-8 text-xs flex-1 min-w-0"
          aria-label="Search scope"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="folder">{folderLabel}</SelectItem>
          <SelectItem value="source">{sourceLabel}</SelectItem>
          <SelectItem value="all">All sources</SelectItem>
        </SelectContent>
      </Select>

      {/* File pattern input */}
      <Input
        className="h-8 text-xs w-20"
        value={searchFilePattern}
        onChange={(e) => setSearchFilePattern(e.target.value)}
        placeholder="*.xml"
      />

      {/* Search Files button */}
      <Button
        variant="default"
        size="sm"
        className="h-8 px-3 text-xs font-semibold"
        disabled={searchDisabled}
        onClick={onSearch}
      >
        Search Files
      </Button>
    </div>
  );
}
