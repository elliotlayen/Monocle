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
import { TABLE_VIEW_HEADER_HEIGHT } from "./node-geometry";
import { getNodeStyleSpec } from "./node-style";
import { useSchemaStore } from "../store";
import { cn } from "@/lib/utils";

interface TriggerNodeData {
  trigger: Trigger;
  nodeWidth?: number;
  isFocused?: boolean;
  isDimmed?: boolean;
  isCompact?: boolean;
  canvasMode?: boolean;
  onClick?: (event: React.MouseEvent) => void;
}

function TriggerNodeComponent({ data }: NodeProps) {
  const {
    trigger,
    nodeWidth,
    isFocused,
    isDimmed,
    isCompact,
    canvasMode,
    onClick,
  } = data as unknown as TriggerNodeData;
  const nodeHandleBase = buildNodeHandleBase(trigger.id);
  const handleClass = nodeHandleClass(canvasMode);
  const nodeStyle = useSchemaStore((state) => state.nodeStyle);
  const styleSpec = getNodeStyleSpec(nodeStyle, "triggers", isCompact);

  const events = [
    trigger.firesOnInsert && "I",
    trigger.firesOnUpdate && "U",
    trigger.firesOnDelete && "D",
  ].filter(Boolean);

  return (
    <div
      onClick={onClick}
      style={{
        width: nodeWidth,
        ...styleSpec.shellStyle,
        ...nodeFocusStyle("triggers", isFocused),
      }}
      className={nodeShellClass(isDimmed)}
    >
      {/* Header: minHeight pins geometry so style swaps never move handles. */}
      <div
        className={cn("relative border-b px-3 py-2", styleSpec.headerClass)}
        style={{
          minHeight: TABLE_VIEW_HEADER_HEIGHT,
          ...styleSpec.headerStyle,
        }}
      >
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
        {styleSpec.showKindLabel && (
          <div className="flex items-center gap-1.5">
            {styleSpec.showKindDot && <NodeKindDot objectType="triggers" />}
            <span
              className={cn(
                "text-[10px] uppercase tracking-wide",
                styleSpec.kindLabelClass
              )}
            >
              Trigger
            </span>
            {trigger.isDisabled && (
              <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                DISABLED
              </span>
            )}
          </div>
        )}
        <span
          className={cn(
            "block whitespace-nowrap font-semibold",
            styleSpec.nameClass
          )}
        >
          {trigger.name}
        </span>
      </div>

      {/* Body */}
      <div className="space-y-1 px-3 py-2" style={styleSpec.bodyStyle}>
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
