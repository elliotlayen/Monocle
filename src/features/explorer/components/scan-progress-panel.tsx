import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useScan } from "../hooks/use-scan";

export function ScanProgressPanel() {
  const { scanStatus, scanProgress, cancelScan, scanFolderName } = useScan();
  const [showComplete, setShowComplete] = useState(false);

  // Brief "Scan complete/cancelled" display before clearing
  useEffect(() => {
    if (scanStatus === "completed" || scanStatus === "cancelled") {
      setShowComplete(true);
      const timer = setTimeout(() => {
        setShowComplete(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
    setShowComplete(false);
  }, [scanStatus]);

  if (scanStatus !== "scanning" && !showComplete) return null;

  if (showComplete) {
    return (
      <div className="border-t bg-muted/50 px-4 py-3">
        <p className="text-sm font-medium">
          {scanStatus === "completed" ? "Scan complete" : "Scan cancelled"}
        </p>
      </div>
    );
  }

  const filesProcessed = scanProgress?.filesProcessed ?? 0;
  const totalFiles = scanProgress?.totalFiles ?? 0;
  const percentage =
    totalFiles > 0 ? Math.round((filesProcessed / totalFiles) * 100) : 0;

  return (
    <div className="border-t bg-muted/50 px-4 py-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          Scanning {scanFolderName}...
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2"
          onClick={() => cancelScan()}
        >
          <X className="h-3.5 w-3.5 mr-1" />
          Cancel
        </Button>
      </div>

      <Progress value={percentage} className="h-2" />

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {filesProcessed} of {totalFiles} files ({percentage}%)
        </span>
        <div className="flex items-center gap-3">
          {(scanProgress?.totalErrors ?? 0) > 0 && (
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500 dark:bg-red-400" />
              <span>{scanProgress?.totalErrors} errors</span>
            </span>
          )}
          {(scanProgress?.totalWarnings ?? 0) > 0 && (
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500 dark:bg-amber-400" />
              <span>{scanProgress?.totalWarnings} warnings</span>
            </span>
          )}
        </div>
      </div>

      {scanProgress?.fileName && (
        <p className="text-xs text-muted-foreground truncate">
          Current: {scanProgress.fileName}
        </p>
      )}
    </div>
  );
}
