import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DetailSidebarData,
  DetailContent,
  getHeaderInfo,
} from "./detail-content";
import {
  useDetailDismiss,
  useTransitionPresence,
} from "../hooks/use-detail-view";

interface DetailDrawerProps {
  open: boolean;
  data: DetailSidebarData | null;
  onClose: () => void;
  onEdit?: (data: DetailSidebarData) => void;
}

/** Full-width bottom drawer above the status strip. */
export function DetailDrawer({
  open,
  data,
  onClose,
  onEdit,
}: DetailDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { mounted, shown } = useTransitionPresence(open);
  // Retain the last data through the exit transition.
  const [retained, setRetained] = useState<DetailSidebarData | null>(data);
  useEffect(() => {
    if (data) setRetained(data);
  }, [data]);

  useDetailDismiss(open, panelRef, onClose);

  const current = data ?? retained;
  if (!mounted || !current) return null;

  const { badge, schema, name, description } = getHeaderInfo(current);

  return (
    <div
      ref={panelRef}
      className={cn(
        "panel-glass absolute bottom-11 left-3 right-3 z-40 grid h-[38%] max-h-[380px] min-h-[220px] grid-cols-[280px_minmax(0,1fr)] overflow-hidden",
        // Rises from its home edge; transform/opacity only, interruptible.
        "transition-[transform,opacity] ease-[var(--ease-out)]",
        shown
          ? "translate-y-0 opacity-100 duration-[var(--duration-base)]"
          : "translate-y-3 opacity-0 duration-[var(--duration-fast)]"
      )}
      role="dialog"
      aria-label={`${name} details`}
    >
      {/* Meta column */}
      <div className="flex flex-col gap-2 border-r p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="mb-1.5 flex items-center gap-2">{badge}</div>
            <h2 className="truncate text-sm font-semibold">{name}</h2>
            <p className="text-[11px] text-muted-foreground">
              {schema} &middot; {description}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 flex-shrink-0"
            onClick={onClose}
          >
            <X className="h-3.5 w-3.5" />
            <span className="sr-only">Close</span>
          </Button>
        </div>
        {onEdit && (
          <Button
            variant="outline"
            size="sm"
            className="mt-auto self-start"
            onClick={() => {
              onEdit(current);
              onClose();
            }}
          >
            Edit
          </Button>
        )}
      </div>

      {/* Detail column */}
      <div className="overflow-y-auto p-3">
        <DetailContent data={current} />
      </div>
    </div>
  );
}
