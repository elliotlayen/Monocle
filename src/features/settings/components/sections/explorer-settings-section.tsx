import { useShallow } from "zustand/shallow";
import { useExplorerStore } from "@/features/explorer/store";
import { FileTypePicker } from "@/features/explorer/components/file-type-picker";
import { Label } from "@/components/ui/label";

export function ExplorerSettingsSection() {
  const { scanFilePattern, setScanFilePattern } = useExplorerStore(
    useShallow((state) => ({
      scanFilePattern: state.scanFilePattern,
      setScanFilePattern: state.setScanFilePattern,
    }))
  );

  return (
    <div className="space-y-6 px-1">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Scanning</h3>
      </div>

      <div className="space-y-2">
        <Label>Scan File Types</Label>
        <div>
          <FileTypePicker
            value={scanFilePattern}
            onChange={setScanFilePattern}
            ariaLabel="File types to scan"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          File types included when scanning a folder for issues. The types for
          searching are set in the search panel itself.
        </p>
      </div>
    </div>
  );
}
