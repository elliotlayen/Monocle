import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Trigger } from "../types";
import { cn } from "@/lib/utils";

interface TriggerNodeData {
  trigger: Trigger;
  isFocused?: boolean;
  isDimmed?: boolean;
  onClick?: (event: React.MouseEvent) => void;
}

function TriggerNodeComponent({ data }: NodeProps) {
  const { trigger, isFocused, isDimmed, onClick } = data as unknown as TriggerNodeData;

  const events = [
    trigger.firesOnInsert && "I",
    trigger.firesOnUpdate && "U",
    trigger.firesOnDelete && "D",
  ].filter(Boolean);

  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-card border border-border rounded-lg shadow-sm min-w-[180px] max-w-[240px] overflow-hidden transition-all duration-200 cursor-pointer relative",
        isFocused && "border-amber-500 ring-2 ring-amber-200",
        isDimmed && "opacity-40",
        !isDimmed && "hover:shadow-md"
      )}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-600 to-amber-500 text-white px-3 py-2 relative">
        {/* Left handle for connection FROM parent table - inside header */}
        <Handle
          type="target"
          position={Position.Left}
          id={trigger.id}
          className="!w-0 !h-0 !bg-transparent !border-0"
          style={{ top: "50%", transform: "translateY(-50%)", left: -4 }}
        />
        {/* Right handle for outgoing connections (affects edges) - inside header */}
        <Handle
          type="source"
          position={Position.Right}
          id={`${trigger.id}-source`}
          className="!w-0 !h-0 !bg-transparent !border-0"
          style={{ top: "50%", transform: "translateY(-50%)", right: -4 }}
        />
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-amber-200 uppercase tracking-wide">
            Trigger
          </span>
          {trigger.isDisabled && (
            <span className="text-[9px] bg-amber-800/50 px-1.5 py-0.5 rounded">
              DISABLED
            </span>
          )}
        </div>
        <span className="text-sm font-semibold block truncate">
          {trigger.name}
        </span>
      </div>

      {/* Body */}
      <div className="px-3 py-2 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground uppercase">Type:</span>
          <span className="text-xs text-foreground">{trigger.triggerType}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground uppercase">Events:</span>
          <div className="flex gap-1">
            {events.map((event, idx) => (
              <span
                key={idx}
                className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded"
              >
                {event}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export const TriggerNode = memo(TriggerNodeComponent);
