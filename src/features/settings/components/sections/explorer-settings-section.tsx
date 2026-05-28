import { useShallow } from "zustand/shallow";
import { Input } from "@/components/ui/input";
import { useExplorerStore } from "@/features/explorer/store";

export function ExplorerSettingsSection() {
  const {
    scanFilePattern,
    setScanFilePattern,
    searchFilePattern,
    setSearchFilePattern,
  } = useExplorerStore(
    useShallow((state) => ({
      scanFilePattern: state.scanFilePattern,
      setScanFilePattern: state.setScanFilePattern,
      searchFilePattern: state.searchFilePattern,
      setSearchFilePattern: state.setSearchFilePattern,
    }))
  );

  return (
    <div className="space-y-6 px-1">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Explorer</h3>
        <p className="text-xs text-muted-foreground">
          Configure file patterns for scanning and content search.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Scan File Pattern</label>
        <Input
          className="w-full"
          value={scanFilePattern}
          onChange={(e) => setScanFilePattern(e.target.value)}
          placeholder="*.xml"
        />
        <p className="text-xs text-muted-foreground">
          Glob pattern for validation scans (e.g., *.xml, *.json).
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Content Search File Pattern</label>
        <Input
          className="w-full"
          value={searchFilePattern}
          onChange={(e) => setSearchFilePattern(e.target.value)}
          placeholder="*.xml"
        />
        <p className="text-xs text-muted-foreground">
          Glob pattern for content search (e.g., *.xml, *.json).
        </p>
      </div>
    </div>
  );
}
