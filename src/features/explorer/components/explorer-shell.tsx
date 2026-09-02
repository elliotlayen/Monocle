import { useEffect } from "react";
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
import { ExplorerNavBar } from "./explorer-nav-bar";
import { ExplorerEmptyState } from "./explorer-empty-state";
import { SearchPanel } from "./search-panel";
import { ResultsPanel } from "./results-panel";
import { FileTabBar } from "./file-tab-bar";
import { BreadcrumbBar } from "./breadcrumb-bar";
import { FileContentArea } from "./file-content-area";
import { ScanProgressPanel } from "./scan-progress-panel";
import { QuickOpen } from "./quick-open";
import { useExplorerStore } from "../store";
import { useExplorerSidebar } from "../hooks/use-explorer-sidebar";
import { useExplorerKeyboard } from "../hooks/use-explorer-keyboard";
import { useExplorerEvents } from "../hooks/use-explorer-events";

interface ExplorerShellProps {
  onHome: () => void;
  onOpenSettings: () => void;
}

export function ExplorerShell({ onHome, onOpenSettings }: ExplorerShellProps) {
  useExplorerKeyboard();
  useExplorerEvents();

  const {
    sidebarWidth,
    setSidebarWidth,
    loadSources,
    tabs,
    scanStatus,
    pendingScanRequest,
    scanFolderName,
    confirmPendingScan,
    dismissPendingScan,
  } = useExplorerStore(
    useShallow((state) => ({
      sidebarWidth: state.sidebarWidth,
      setSidebarWidth: state.setSidebarWidth,
      loadSources: state.loadSources,
      tabs: state.tabs,
      scanStatus: state.scanStatus,
      pendingScanRequest: state.pendingScanRequest,
      scanFolderName: state.scanFolderName,
      confirmPendingScan: state.confirmPendingScan,
      dismissPendingScan: state.dismissPendingScan,
    }))
  );

  // Load sources (and hydrate persisted search state) on entry
  useEffect(() => {
    loadSources();
  }, [loadSources]);

  // Results panel drag-resize; width persists via setSidebarWidth
  const { width, isDragging, startDrag } = useExplorerSidebar(
    sidebarWidth,
    setSidebarWidth
  );

  const hasOpenTabs = tabs.length > 0;
  const isScanning = scanStatus === "scanning";

  const newFolderName = pendingScanRequest
    ? pendingScanRequest.folderPath.split(/[/\\]/).pop()
    : null;

  return (
    <div className="relative flex h-screen flex-col overflow-hidden">
      <ExplorerNavBar onHome={onHome} onOpenSettings={onOpenSettings} />
      <QuickOpen />

      {/* Floating chrome below the docked nav bar */}
      <div className="absolute bottom-3 left-3 right-3 top-14 flex flex-col gap-3">
        <SearchPanel />
        <div className="flex min-h-0 flex-1 gap-3">
          <ResultsPanel width={width} isDragging={isDragging} startDrag={startDrag} />
          <div className="panel-glass flex min-w-0 flex-1 flex-col overflow-hidden">
            {hasOpenTabs ? (
              <>
                <FileTabBar />
                <BreadcrumbBar />
                {isScanning && <ScanProgressPanel />}
                <FileContentArea />
              </>
            ) : isScanning ? (
              <div className="flex flex-1 flex-col">
                <ScanProgressPanel />
                <div className="flex-1" />
              </div>
            ) : (
              <ExplorerEmptyState onOpenSettings={onOpenSettings} />
            )}
          </div>
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
