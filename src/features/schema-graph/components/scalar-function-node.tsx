import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { ScalarFunction } from "../types";
import { OBJECT_COLORS } from "@/constants/edge-colors";
import { buildNodeHandleBase } from "@/features/schema-graph/utils/handle-ids";
import {
  NodeKindDot,
  nodeFocusStyle,
  nodeHandleClass,
  nodeShellClass,
} from "./table-view-node-shared";

interface ScalarFunctionNodeData {
  function: ScalarFunction;
  nodeWidth?: number;
  isFocused?: boolean;
  isDimmed?: boolean;
  canvasMode?: boolean;
  onClick?: (event: React.MouseEvent) => void;
}

function ScalarFunctionNodeComponent({ data }: NodeProps) {
  const {
    function: fn,
    nodeWidth,
    isFocused,
    isDimmed,
    canvasMode,
    onClick,
  } = data as unknown as ScalarFunctionNodeData;
  const nodeHandleBase = buildNodeHandleBase(fn.id);
  const handleClass = nodeHandleClass(canvasMode);

  return (
    <div
      onClick={onClick}
      style={{
        width: nodeWidth,
        ...nodeFocusStyle("scalarFunctions", isFocused),
      }}
      className={nodeShellClass(isDimmed)}
    >
      {/* Header */}
      <div className="relative border-b bg-muted/40 px-3 py-2">
        {/* Target handle for incoming connections */}
        <Handle
          type="target"
          position={Position.Left}
          id={`${nodeHandleBase}-target`}
          className={handleClass}
          style={{ top: "50%", transform: "translateY(-50%)", left: -4 }}
        />
        {/* Source handle for outgoing connections */}
        <Handle
          type="source"
          position={Position.Right}
          id={`${nodeHandleBase}-source`}
          className={handleClass}
          style={{ top: "50%", transform: "translateY(-50%)", right: -4 }}
        />
        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          <NodeKindDot objectType="scalarFunctions" />
          Function
        </span>
        <span className="block whitespace-nowrap text-sm font-semibold">
          {fn.name}
        </span>
      </div>

      {/* Return type */}
      <div className="border-b border-border px-3 py-2">
        <span className="mb-1 block text-[10px] uppercase text-muted-foreground">
          Returns
        </span>
        <span
          className="text-xs"
          style={{ color: OBJECT_COLORS.scalarFunctions }}
        >
          {fn.returnType}
        </span>
      </div>

      {/* Parameters */}
      <div className="space-y-2 px-3 py-2">
        {fn.parameters.length === 0 ? (
          <span className="text-xs italic text-muted-foreground">
            No parameters
          </span>
        ) : (
          <div>
            <span className="mb-1 block text-[10px] uppercase text-muted-foreground">
              Parameters ({fn.parameters.length})
            </span>
            <div className="space-y-0.5">
              {fn.parameters.slice(0, 3).map((param) => (
                <div
                  key={param.name}
                  className="flex items-center gap-2 text-xs"
                >
                  <span className="whitespace-nowrap text-foreground">
                    {param.name}
                  </span>
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {param.dataType}
                  </span>
                </div>
              ))}
              {fn.parameters.length > 3 && (
                <span className="text-[10px] text-muted-foreground">
                  +{fn.parameters.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const ScalarFunctionNode = memo(ScalarFunctionNodeComponent);
