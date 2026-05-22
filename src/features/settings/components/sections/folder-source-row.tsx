import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, FolderSearch, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { explorerService } from "@/features/explorer/services/explorer-service";
import type { FolderSource } from "@/features/explorer/types";

interface FolderSourceRowProps {
  source: FolderSource;
  onUpdate: (partial: Partial<FolderSource>) => void;
  onRemove: () => void;
  onBrowse: (sourceId: string) => void;
}

export function FolderSourceRow({
  source,
  onUpdate,
  onRemove,
  onBrowse,
}: FolderSourceRowProps) {
  const [reachable, setReachable] = useState<boolean | null>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: source.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handlePathBlur = async () => {
    if (!source.path.trim()) {
      setReachable(null);
      return;
    }
    try {
      const result = await explorerService.checkPathReachable(source.path);
      setReachable(result);
    } catch {
      setReachable(false);
    }
  };

  const handlePathChange = (value: string) => {
    setReachable(null);
    onUpdate({ path: value });
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div className="flex items-center gap-2 rounded-md border p-3">
        <div
          className="cursor-grab text-muted-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </div>
        <Input
          className="w-32"
          placeholder="Display name"
          value={source.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <Input
            className="w-full"
            placeholder="Enter path (e.g., \\server\share\integrations)"
            value={source.path}
            onChange={(e) => handlePathChange(e.target.value)}
            onBlur={handlePathBlur}
          />
          {reachable === false && (
            <p className="text-xs text-yellow-600">
              Path unreachable -- check VPN connection
            </p>
          )}
        </div>
        <Input
          className="w-24"
          placeholder="Tag"
          value={source.tag}
          onChange={(e) => onUpdate({ tag: e.target.value })}
        />
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onBrowse(source.id)}
          title="Browse for folder"
        >
          <FolderSearch className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-destructive hover:text-destructive"
          onClick={onRemove}
          title="Remove source"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
