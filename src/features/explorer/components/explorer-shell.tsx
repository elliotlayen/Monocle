import { ExplorerNavBar } from "./explorer-nav-bar";
import { ExplorerEmptyState } from "./explorer-empty-state";

interface ExplorerShellProps {
  onHome: () => void;
  onOpenSettings: () => void;
}

export function ExplorerShell({ onHome, onOpenSettings }: ExplorerShellProps) {
  return (
    <div className="flex flex-col h-screen">
      <ExplorerNavBar onHome={onHome} onOpenSettings={onOpenSettings} />
      <main className="flex-1 overflow-hidden">
        <ExplorerEmptyState onOpenSettings={onOpenSettings} />
      </main>
    </div>
  );
}
