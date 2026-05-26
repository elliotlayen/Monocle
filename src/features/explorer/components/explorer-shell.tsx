import { useShallow } from "zustand/shallow";
import { ExplorerNavBar } from "./explorer-nav-bar";
import { ExplorerEmptyState } from "./explorer-empty-state";
import { ExplorerSidebar } from "./explorer-sidebar";
import { SidebarToggle } from "@/features/schema-graph/components/sidebar-toggle";
import { useExplorerStore } from "../store";

interface ExplorerShellProps {
  onHome: () => void;
  onOpenSettings: () => void;
}

export function ExplorerShell({ onHome, onOpenSettings }: ExplorerShellProps) {
  const { sidebarOpen, setSidebarOpen } = useExplorerStore(
    useShallow((state) => ({
      sidebarOpen: state.sidebarOpen,
      setSidebarOpen: state.setSidebarOpen,
    }))
  );

  return (
    <div className="flex flex-col h-screen">
      <ExplorerNavBar onHome={onHome} onOpenSettings={onOpenSettings} />
      <div className="flex flex-row flex-1 overflow-hidden">
        <ExplorerSidebar />
        <div className="flex-1 overflow-hidden relative">
          <SidebarToggle
            onClick={() => setSidebarOpen(true)}
            visible={!sidebarOpen}
          />
          <ExplorerEmptyState onOpenSettings={onOpenSettings} />
        </div>
      </div>
    </div>
  );
}
