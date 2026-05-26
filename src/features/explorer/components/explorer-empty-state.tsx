import { Button } from "@/components/ui/button";
import { FolderSync, Settings } from "lucide-react";
import { useExplorerStore } from "@/features/explorer/store";
import { useShallow } from "zustand/shallow";

interface ExplorerEmptyStateProps {
  onOpenSettings: () => void;
}

export function ExplorerEmptyState({ onOpenSettings }: ExplorerEmptyStateProps) {
  const { folderSources } = useExplorerStore(
    useShallow((state) => ({
      folderSources: state.folderSources,
    }))
  );

  const hasSources = folderSources.length > 0;

  return (
    <div className="flex h-full items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-center">
        <FolderSync className="mb-1 h-10 w-10 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Integration Explorer</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          {hasSources
            ? "Click a file in the sidebar to open it."
            : "Add a folder source in Settings to get started."}
        </p>
        {!hasSources && (
          <Button className="mt-6" onClick={onOpenSettings}>
            <Settings className="h-4 w-4" />
            Open Settings
          </Button>
        )}
      </div>
    </div>
  );
}
