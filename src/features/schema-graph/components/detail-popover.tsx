import { useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DetailSidebarData,
  DetailContent,
  getHeaderInfo,
} from "./detail-content";

const POPOVER_WIDTH = 450;
const POPOVER_MAX_HEIGHT = 600;
const MARGIN = 12;

interface PopoverPosition {
  left: number;
  top: number;
  placement: "right" | "left";
}

function calculatePopoverPosition(anchorRect: DOMRect): PopoverPosition {
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  // Prefer right of anchor
  if (viewportWidth - anchorRect.right >= POPOVER_WIDTH + MARGIN) {
    return {
      left: anchorRect.right + MARGIN,
      top: Math.max(
        MARGIN,
        Math.min(anchorRect.top, viewportHeight - POPOVER_MAX_HEIGHT - MARGIN)
      ),
      placement: "right",
    };
  }

  // Fall back to left
  if (anchorRect.left >= POPOVER_WIDTH + MARGIN) {
    return {
      left: anchorRect.left - POPOVER_WIDTH - MARGIN,
      top: Math.max(
        MARGIN,
        Math.min(anchorRect.top, viewportHeight - POPOVER_MAX_HEIGHT - MARGIN)
      ),
      placement: "left",
    };
  }

  // Center if neither side works
  return {
    left: Math.max(MARGIN, (viewportWidth - POPOVER_WIDTH) / 2),
    top: Math.max(
      MARGIN,
      Math.min(
        anchorRect.bottom + MARGIN,
        viewportHeight - POPOVER_MAX_HEIGHT - MARGIN
      )
    ),
    placement: "right",
  };
}

interface DetailPopoverProps {
  open: boolean;
  data: DetailSidebarData | null;
  anchorRect: DOMRect | null;
  onClose: () => void;
  onEdit?: (data: DetailSidebarData) => void;
}

export function DetailPopover({
  open,
  data,
  anchorRect,
  onClose,
  onEdit,
}: DetailPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Handle escape key
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Handle click outside
  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return;

    // Delay adding the listener to avoid immediate close from the click that opened it
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open, handleClickOutside]);

  if (!open || !data || !anchorRect) {
    return null;
  }

  const position = calculatePopoverPosition(anchorRect);
  const { badge, schema, name, description } = getHeaderInfo(data);

  const popoverContent = (
    <div
      ref={popoverRef}
      className={cn(
        "fixed z-50 bg-background border rounded-lg shadow-lg overflow-hidden",
        "animate-in fade-in-0 zoom-in-95 duration-200"
      )}
      style={{
        left: position.left,
        top: position.top,
        width: POPOVER_WIDTH,
        maxHeight: POPOVER_MAX_HEIGHT,
      }}
    >
      {/* Header */}
      <div className="flex-shrink-0 border-b p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {badge}
              <span className="text-xs text-muted-foreground">{schema}</span>
            </div>
            <h2 className="text-lg font-semibold truncate">{name}</h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onEdit(data);
                  onClose();
                }}
              >
                Edit
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="overflow-y-auto max-h-[500px] p-4 pb-6">
        <DetailContent data={data} />
      </div>
    </div>
  );

  return createPortal(popoverContent, document.body);
}
