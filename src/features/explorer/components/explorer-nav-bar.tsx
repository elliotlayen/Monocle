import { useShallow } from "zustand/shallow";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LogOut, Settings, ScanSearch, Loader2 } from "lucide-react";
import { useExplorerStore } from "../store";

interface ExplorerNavBarProps {
  onHome: () => void;
  onOpenSettings: () => void;
}

export function ExplorerNavBar({ onHome, onOpenSettings }: ExplorerNavBarProps) {
  const {
    lastInteractedFolderPath,
    scanStatus,
    scanFilePattern,
    requestScan,
  } = useExplorerStore(
    useShallow((state) => ({
      lastInteractedFolderPath: state.lastInteractedFolderPath,
      scanStatus: state.scanStatus,
      scanFilePattern: state.scanFilePattern,
      requestScan: state.requestScan,
    }))
  );

  const isScanning = scanStatus === "scanning";
  const canScan = lastInteractedFolderPath !== null;
  const folderName = lastInteractedFolderPath
    ? lastInteractedFolderPath.split(/[/\\]/).pop()
    : null;

  const handleScanClick = () => {
    if (lastInteractedFolderPath) {
      requestScan(lastInteractedFolderPath, scanFilePattern);
    }
  };

  return (
    <div className="relative z-20 flex items-center gap-3 px-3 py-2 bg-background border-b border-border">
      <span
        className="font-semibold text-base"
        style={{ fontFamily: "'JetBrains Mono', monospace" }}
      >
        Monocle
      </span>
      <div className="flex-1" />
      <div className="flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-2"
                disabled={!canScan}
                onClick={handleScanClick}
              >
                {isScanning ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ScanSearch className="w-4 h-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {canScan
                ? `Scan ${folderName} for issues`
                : "Select a folder to scan"}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-2"
                onClick={onOpenSettings}
              >
                <Settings className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Settings</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                className="h-9 px-2"
                onClick={onHome}
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Leave Explorer</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}
