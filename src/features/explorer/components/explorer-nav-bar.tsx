import { useShallow } from "zustand/shallow";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LogOut, Settings, ScanSearch, Loader2 } from "lucide-react";
import { MonocleLogo } from "@/features/connection/components/monocle-logo";
import { useExplorerStore } from "../store";

interface ExplorerNavBarProps {
  onHome: () => void;
  onOpenSettings: () => void;
}

export function ExplorerNavBar({
  onHome,
  onOpenSettings,
}: ExplorerNavBarProps) {
  const { lastInteractedFolderPath, scanStatus, scanFilePattern, requestScan } =
    useExplorerStore(
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
    // Floats over the explorer panels like the graph toolbar: bare logo on
    // the left, a glass action group on the right.
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start px-3 pt-3">
      <div className="pointer-events-auto flex h-9 items-center">
        <MonocleLogo className="h-6 w-6" />
      </div>
      <div className="flex-1" />
      <div className="pointer-events-auto panel-glass flex h-9 items-center gap-1 px-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
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
              <Button variant="ghost" size="sm" onClick={onOpenSettings}>
                <Settings className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Settings</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
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
