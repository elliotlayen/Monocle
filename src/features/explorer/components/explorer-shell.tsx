import { useShallow } from "zustand/shallow";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PanelLeft } from "lucide-react";
import { ExplorerNavBar } from "./explorer-nav-bar";
import { ExplorerEmptyState } from "./explorer-empty-state";
import { ExplorerSidebar } from "./explorer-sidebar";
import { FileTabBar } from "./file-tab-bar";
import { FileContentArea } from "./file-content-area";
import { ScanProgressPanel } from "./scan-progress-panel";
import { useExplorerStore } from "../store";

interface ExplorerShellProps {
  onHome: () => void;
  onOpenSettings: () => void;
}

export function ExplorerShell({ onHome, onOpenSettings }: ExplorerShellProps) {
  const {
    sidebarOpen,
    setSidebarOpen,
    tabs,
    scanStatus,
    pendingScanRequest,
    scanFolderName,
    confirmPendingScan,
    dismissPendingScan,
  } = useExplorerStore(
    useShallow((state) => ({
      sidebarOpen: state.sidebarOpen,
      setSidebarOpen: state.setSidebarOpen,
      tabs: state.tabs,
      scanStatus: state.scanStatus,
      pendingScanRequest: state.pendingScanRequest,
      scanFolderName: state.scanFolderName,
      confirmPendingScan: state.confirmPendingScan,
      dismissPendingScan: state.dismissPendingScan,
    }))
  );

  const hasOpenTabs = tabs.length > 0;
  const isScanning = scanStatus === "scanning";

  const newFolderName = pendingScanRequest
    ? pendingScanRequest.folderPath.split(/[/\\]/).pop()
    : null;

  return (
    <div className="flex flex-col h-screen">
      <ExplorerNavBar onHome={onHome} onOpenSettings={onOpenSettings} />
      <div className="flex flex-row flex-1 overflow-hidden">
        <ExplorerSidebar />
        {!sidebarOpen && (
          <button
            className="flex-shrink-0 flex items-center justify-center w-8 border-r hover:bg-muted transition-colors"
            onClick={() => setSidebarOpen(true)}
            title="Open sidebar"
          >
            <PanelLeft className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {hasOpenTabs ? (
            <>
              <FileTabBar />
              {isScanning && <ScanProgressPanel />}
              <FileContentArea />
            </>
          ) : isScanning ? (
            <div className="flex-1 flex flex-col">
              <ScanProgressPanel />
              <div className="flex-1" />
            </div>
          ) : (
            <ExplorerEmptyState onOpenSettings={onOpenSettings} />
          )}
        </div>
      </div>

      {/* Scan confirmation dialog (D-04) */}
      <AlertDialog
        open={pendingScanRequest !== null}
        onOpenChange={(open: boolean) => {
          if (!open) dismissPendingScan();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Scan already in progress</AlertDialogTitle>
            <AlertDialogDescription>
              A scan of {scanFolderName} is already running. Cancel it and start
              scanning {newFolderName}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={dismissPendingScan}>
              Keep Current Scan
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmPendingScan}>
              Cancel and Rescan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
