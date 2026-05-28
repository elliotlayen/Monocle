import { useShallow } from "zustand/shallow";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useExplorerStore } from "../store";

interface SearchControlsRowProps {
  selectedNodePath: string | null;
  selectedNodeName: string | null;
  selectedSourceLabel: string | null;
}

export function SearchControlsRow({
  selectedNodePath,
  selectedNodeName,
  selectedSourceLabel,
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

  return (
    <div className="flex flex-col gap-2 px-3 pt-3 pb-2">
      <Select
        value={searchScope}
        onValueChange={(value) =>
          setSearchScope(value as "folder" | "source" | "all")
        }
        disabled={scopeDisabled}
      >
        <SelectTrigger
          className="h-8 text-xs w-full"
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

      <Input
        className="h-8 text-xs w-full"
        value={searchFilePattern}
        onChange={(e) => setSearchFilePattern(e.target.value)}
        placeholder="*.xml"
      />
    </div>
  );
}
