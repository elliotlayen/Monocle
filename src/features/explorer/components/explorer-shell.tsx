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
import { cn } from "@/lib/utils";
import { ExplorerNavBar } from "./explorer-nav-bar";
import { ExplorerEmptyState } from "./explorer-empty-state";
import { ExplorerSidebar } from "./explorer-sidebar";
import { ActivityRail } from "./activity-rail";
import { BreadcrumbBar } from "./breadcrumb-bar";
import { QuickOpen } from "./quick-open";
import { useExplorerKeyboard } from "../hooks/use-explorer-keyboard";
import { useScanEvents } from "../hooks/use-scan-events";
import { FileTabBar } from "./file-tab-bar";
import { FileContentArea } from "./file-content-area";
import { ScanProgressPanel } from "./scan-progress-panel";
import { useExplorerStore } from "../store";
import { useExplorerSidebar } from "../hooks/use-explorer-sidebar";

interface ExplorerShellProps {
  onHome: () => void;
  onOpenSettings: () => void;
}

export function ExplorerShell({ onHome, onOpenSettings }: ExplorerShellProps) {
  useExplorerKeyboard();
  useScanEvents();

  const {
    sidebarOpen,
    sidebarWidth,
    setSidebarWidth,
    tabs,
    scanStatus,
    pendingScanRequest,
    scanFolderName,
    confirmPendingScan,
    dismissPendingScan,
  } = useExplorerStore(
    useShallow((state) => ({
      sidebarOpen: state.sidebarOpen,
      sidebarWidth: state.sidebarWidth,
      setSidebarWidth: state.setSidebarWidth,
      tabs: state.tabs,
      scanStatus: state.scanStatus,
      pendingScanRequest: state.pendingScanRequest,
      scanFolderName: state.scanFolderName,
      confirmPendingScan: state.confirmPendingScan,
      dismissPendingScan: state.dismissPendingScan,
    }))
  );

  // Width state lives here so the floating content panel can track the
  // sidebar edge live during drag-resize.
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
      <ExplorerNavBar onHome={onHome} />
      <QuickOpen />
      {/* Floating chrome below the docked nav bar. */}
      <ActivityRail onOpenSettings={onOpenSettings} />
      <ExplorerSidebar width={width} isDragging={isDragging} startDrag={startDrag} />
      <div
        className={cn(
          "panel-glass absolute bottom-3 right-3 top-14 z-10 flex flex-col overflow-hidden",
          // Tracks the sidebar edge 1:1 during drag; animates on toggle.
          !isDragging &&
            "transition-[left] duration-[var(--duration-slow)] ease-[var(--ease-out)]"
        )}
        style={{ left: sidebarOpen ? width + 80 : 68 }}
      >
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
