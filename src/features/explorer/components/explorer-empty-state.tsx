import { Button } from "@/components/ui/button";
import { FolderSync, Settings } from "lucide-react";

interface ExplorerEmptyStateProps {
  onOpenSettings: () => void;
}

export function ExplorerEmptyState({ onOpenSettings }: ExplorerEmptyStateProps) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-3 text-center">
        <FolderSync className="w-10 h-10 text-muted-foreground mb-1" />
        <h2 className="text-xl font-semibold">Integration Explorer</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Browse, search, and validate XML integration files from your
          configured folder sources.
        </p>
        <Button className="mt-6" onClick={onOpenSettings}>
          <Settings className="w-4 h-4" />
          Open Settings
        </Button>
      </div>
    </div>
  );
}
