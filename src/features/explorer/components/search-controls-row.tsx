import { useShallow } from "zustand/shallow";
import { Input } from "@/components/ui/input";
import { useExplorerStore } from "../store";

export function SearchControlsRow() {
  const { searchFilePattern, setSearchFilePattern } = useExplorerStore(
    useShallow((state) => ({
      searchFilePattern: state.searchFilePattern,
      setSearchFilePattern: state.setSearchFilePattern,
    }))
  );

  return (
    <div className="px-3 pt-3 pb-2">
      <Input
        className="h-8 text-xs w-full"
        value={searchFilePattern}
        onChange={(e) => setSearchFilePattern(e.target.value)}
        placeholder="*.xml"
        aria-label="File pattern"
      />
    </div>
  );
}
