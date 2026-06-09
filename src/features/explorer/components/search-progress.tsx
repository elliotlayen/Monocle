import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SearchProgressPayload } from "../types";

interface SearchProgressProps {
  progress: SearchProgressPayload | null;
  onCancel: () => void;
}

export function SearchProgress({ progress, onCancel }: SearchProgressProps) {
  const filesScanned = progress?.filesScanned ?? 0;
  const totalFiles = progress?.totalFiles ?? null;
  const progressText =
    totalFiles == null
      ? `Searching... ${filesScanned} files scanned`
      : `Searching... ${filesScanned} of ${totalFiles} files`;

  return (
    <div
      className="flex items-center gap-2 px-4 py-2 border-b bg-muted/20"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      <span className="text-xs text-muted-foreground flex-1">
        {progressText}
      </span>
      <Button
        variant="outline"
        size="sm"
        className="h-6 px-2 text-xs"
        onClick={onCancel}
      >
        <X className="h-3 w-3 mr-1" />
        Stop Search
      </Button>
    </div>
  );
}
