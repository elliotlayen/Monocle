import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Trigger } from "../types";
import { OBJECT_COLORS } from "@/constants/edge-colors";
import { buildNodeHandleBase } from "@/features/schema-graph/utils/handle-ids";
import {
  NodeKindDot,
  nodeFocusStyle,
  nodeHandleClass,
  nodeShellClass,
} from "./table-view-node-shared";

interface TriggerNodeData {
  trigger: Trigger;
  nodeWidth?: number;
  isFocused?: boolean;
  isDimmed?: boolean;
  canvasMode?: boolean;
  onClick?: (event: React.MouseEvent) => void;
}

function TriggerNodeComponent({ data }: NodeProps) {
  const { trigger, nodeWidth, isFocused, isDimmed, canvasMode, onClick } =
    data as unknown as TriggerNodeData;
  const nodeHandleBase = buildNodeHandleBase(trigger.id);
  const handleClass = nodeHandleClass(canvasMode);

  const events = [
    trigger.firesOnInsert && "I",
    trigger.firesOnUpdate && "U",
    trigger.firesOnDelete && "D",
  ].filter(Boolean);

  return (
    <div
      onClick={onClick}
      style={{ width: nodeWidth, ...nodeFocusStyle("triggers", isFocused) }}
      className={nodeShellClass(isDimmed)}
    >
      {/* Header */}
      <div className="relative border-b bg-muted/40 px-3 py-2">
        {/* Left handle for connection FROM parent table - inside header */}
        <Handle
          type="target"
          position={Position.Left}
          id={`${nodeHandleBase}-target`}
          className={handleClass}
          style={{ top: "50%", transform: "translateY(-50%)", left: -4 }}
        />
        {/* Right handle for outgoing connections (affects edges) - inside header */}
        <Handle
          type="source"
          position={Position.Right}
          id={`${nodeHandleBase}-source`}
          className={handleClass}
          style={{ top: "50%", transform: "translateY(-50%)", right: -4 }}
        />
        <div className="flex items-center gap-1.5">
          <NodeKindDot objectType="triggers" />
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Trigger
          </span>
          {trigger.isDisabled && (
            <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
              DISABLED
            </span>
          )}
        </div>
        <span className="block whitespace-nowrap text-sm font-semibold">
          {trigger.name}
        </span>
      </div>

      {/* Body */}
      <div className="space-y-1 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase text-muted-foreground">
            Type:
          </span>
          <span className="text-xs text-foreground">{trigger.triggerType}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase text-muted-foreground">
            Events:
          </span>
          <div className="flex gap-1">
            {events.map((event, idx) => (
              <span
                key={idx}
                className="rounded-sm px-1.5 py-0.5 text-[9px] font-bold"
                style={{
                  color: OBJECT_COLORS.triggers,
                  backgroundColor: `color-mix(in srgb, ${OBJECT_COLORS.triggers} 15%, transparent)`,
                }}
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
