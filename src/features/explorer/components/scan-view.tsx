import { useMemo } from "react";
import { useShallow } from "zustand/shallow";
import { Folder, Loader2, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useExplorerStore } from "../store";

/**
 * Sidebar view for bulk scans: the target defaults to the selected folder
 * (or the selected file's parent), with the file pattern alongside.
 */
export function ScanView() {
  const {
    selectedPath,
    treeNodes,
    scanStatus,
    scanFolderName,
    scanFilePattern,
    setScanFilePattern,
    requestScan,
  } = useExplorerStore(
    useShallow((state) => ({
      selectedPath: state.selectedPath,
      treeNodes: state.treeNodes,
      scanStatus: state.scanStatus,
      scanFolderName: state.scanFolderName,
      scanFilePattern: state.scanFilePattern,
      setScanFilePattern: state.setScanFilePattern,
      requestScan: state.requestScan,
    }))
  );

  const targetFolder = useMemo(() => {
    if (!selectedPath) return null;
    const node = treeNodes.get(selectedPath);
    if (!node) return null;
    if (node.isDir) return node;
    return node.parentId ? (treeNodes.get(node.parentId) ?? null) : null;
  }, [selectedPath, treeNodes]);

  const isScanning = scanStatus === "scanning";

  return (
    <div className="flex flex-col gap-4 p-3">
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">Scan target</Label>
        {targetFolder ? (
          <div className="flex items-center gap-2 rounded-md border px-2.5 py-2">
            <Folder className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
            <span className="text-sm truncate" title={targetFolder.path}>
              {targetFolder.name}
            </span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground rounded-md border border-dashed px-2.5 py-2">
            Select a folder in the Explorer view to scan it.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="scan-pattern" className="text-xs text-muted-foreground">
          File pattern
        </Label>
        <Input
          id="scan-pattern"
          value={scanFilePattern}
          onChange={(e) => setScanFilePattern(e.target.value)}
          className="h-8 text-sm"
          placeholder="*.xml"
        />
      </div>

      <Button
        size="sm"
        disabled={!targetFolder || isScanning}
        onClick={() =>
          targetFolder && requestScan(targetFolder.path, scanFilePattern)
        }
      >
        {isScanning ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Scanning {scanFolderName}...
          </>
        ) : (
          <>
            <ScanSearch className="h-4 w-4" />
            Scan for Issues
          </>
        )}
      </Button>
    </div>
  );
}
