import { useShallow } from "zustand/shallow";
import { Input } from "@/components/ui/input";
import { useExplorerStore } from "@/features/explorer/store";
import { Label } from "@/components/ui/label";

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
        <h3 className="text-base font-semibold">Scanning</h3>
        <p className="text-xs text-muted-foreground">
          Configure file patterns for scanning and content search.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Scan File Pattern</Label>
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
        <Label>Content Search File Pattern</Label>
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
