import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { ScalarFunction } from "../types";
import { cn } from "@/lib/utils";
import { buildNodeHandleBase } from "@/features/schema-graph/utils/handle-ids";

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

  return (
    <div
      onClick={onClick}
      style={{ width: nodeWidth }}
      className={cn(
        "bg-card border border-border rounded-lg shadow-sm overflow-hidden transition-all duration-200 cursor-pointer relative",
        isFocused && "border-cyan-500 ring-2 ring-cyan-200",
        isDimmed && "opacity-40",
        !isDimmed && "hover:shadow-md"
      )}
    >
      {/* Header */}
      <div className="bg-cyan-600 text-white px-3 py-2 relative">
        {/* Target handle for incoming connections */}
        <Handle
          type="target"
          position={Position.Left}
          id={`${nodeHandleBase}-target`}
          className={canvasMode ? "!w-2 !h-2 !bg-cyan-400 !border-cyan-500 !rounded-full" : "!w-0 !h-0 !bg-transparent !border-0"}
          style={{ top: "50%", transform: "translateY(-50%)", left: -4 }}
        />
        {/* Source handle for outgoing connections */}
        <Handle
          type="source"
          position={Position.Right}
          id={`${nodeHandleBase}-source`}
          className={canvasMode ? "!w-2 !h-2 !bg-cyan-400 !border-cyan-500 !rounded-full" : "!w-0 !h-0 !bg-transparent !border-0"}
          style={{ top: "50%", transform: "translateY(-50%)", right: -4 }}
        />
        <span className="text-[10px] text-cyan-200 uppercase tracking-wide block">
          Function
        </span>
        <span className="text-sm font-semibold block whitespace-nowrap">
          {fn.name}
        </span>
      </div>

      {/* Return type */}
      <div className="px-3 py-2 border-b border-border">
        <span className="text-[10px] text-muted-foreground uppercase block mb-1">
          Returns
        </span>
        <span className="text-xs font-mono text-cyan-700 dark:text-cyan-400">
          {fn.returnType}
        </span>
      </div>

      {/* Parameters */}
      <div className="px-3 py-2 space-y-2">
        {fn.parameters.length === 0 ? (
          <span className="text-xs text-muted-foreground italic">
            No parameters
          </span>
        ) : (
          <div>
            <span className="text-[10px] text-muted-foreground uppercase block mb-1">
              Parameters ({fn.parameters.length})
            </span>
            <div className="space-y-0.5">
              {fn.parameters.slice(0, 3).map((param) => (
                <div
                  key={param.name}
                  className="flex items-center gap-2 text-xs"
                >
                  <span className="text-foreground whitespace-nowrap">
                    {param.name}
                  </span>
                  <span className="text-muted-foreground text-[10px] ml-auto">
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
