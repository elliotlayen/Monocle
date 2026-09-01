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

interface DetailInspectorProps {
  open: boolean;
  data: DetailSidebarData | null;
  onClose: () => void;
  onEdit?: (data: DetailSidebarData) => void;
}

/** Floating right-side inspector panel over the canvas. */
export function DetailInspector({
  open,
  data,
  onClose,
  onEdit,
}: DetailInspectorProps) {
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
        "panel-glass absolute bottom-11 right-3 top-14 z-40 flex w-[400px] flex-col overflow-hidden",
        // Enters from its home edge; transform/opacity only, interruptible.
        "transition-[transform,opacity] ease-[var(--ease-out)]",
        shown
          ? "translate-x-0 opacity-100 duration-[var(--duration-base)]"
          : "translate-x-3 opacity-0 duration-[var(--duration-fast)]"
      )}
      role="dialog"
      aria-label={`${name} details`}
    >
      {/* Header */}
      <div className="flex-shrink-0 border-b p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex items-center gap-2">
              {badge}
              <span className="text-[11px] text-muted-foreground">
                {schema}
              </span>
            </div>
            <h2 className="truncate text-sm font-semibold">{name}</h2>
            <p className="text-[11px] text-muted-foreground">{description}</p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-1">
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onEdit(current);
                  onClose();
                }}
              >
                Edit
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onClose}
            >
              <X className="h-3.5 w-3.5" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-3">
        <DetailContent data={current} />
      </div>
    </div>
  );
}
