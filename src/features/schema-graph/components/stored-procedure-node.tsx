import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { StoredProcedure } from "../types";
import { OBJECT_COLORS } from "@/constants/edge-colors";
import { buildNodeHandleBase } from "@/features/schema-graph/utils/handle-ids";
import {
  NodeKindDot,
  nodeFocusStyle,
  nodeHandleClass,
  nodeShellClass,
} from "./table-view-node-shared";

interface StoredProcedureNodeData {
  procedure: StoredProcedure;
  nodeWidth?: number;
  isFocused?: boolean;
  isDimmed?: boolean;
  canvasMode?: boolean;
  onClick?: (event: React.MouseEvent) => void;
}

function StoredProcedureNodeComponent({ data }: NodeProps) {
  const { procedure, nodeWidth, isFocused, isDimmed, canvasMode, onClick } =
    data as unknown as StoredProcedureNodeData;
  const nodeHandleBase = buildNodeHandleBase(procedure.id);
  const handleClass = nodeHandleClass(canvasMode);

  const inputParams = procedure.parameters.filter((p) => !p.isOutput);
  const outputParams = procedure.parameters.filter((p) => p.isOutput);

  return (
    <div
      onClick={onClick}
      style={{
        width: nodeWidth,
        ...nodeFocusStyle("storedProcedures", isFocused),
      }}
      className={nodeShellClass(isDimmed)}
    >
      {/* Header */}
      <div className="relative border-b bg-muted/40 px-3 py-2">
        {/* Target handle for incoming connections from referenced tables - inside header */}
        <Handle
          type="target"
          position={Position.Left}
          id={`${nodeHandleBase}-target`}
          className={handleClass}
          style={{ top: "50%", transform: "translateY(-50%)", left: -4 }}
        />
        {/* Source handle for outgoing connections (affects edges) - inside header */}
        <Handle
          type="source"
          position={Position.Right}
          id={`${nodeHandleBase}-source`}
          className={handleClass}
          style={{ top: "50%", transform: "translateY(-50%)", right: -4 }}
        />
        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          <NodeKindDot objectType="storedProcedures" />
          Procedure
        </span>
        <span className="block whitespace-nowrap text-sm font-semibold">
          {procedure.name}
        </span>
      </div>

      {/* Parameters */}
      <div className="space-y-2 px-3 py-2">
        {procedure.parameters.length === 0 ? (
          <span className="text-xs italic text-muted-foreground">
            No parameters
          </span>
        ) : (
          <>
            {inputParams.length > 0 && (
              <div>
                <span className="mb-1 block text-[10px] uppercase text-muted-foreground">
                  Input ({inputParams.length})
                </span>
                <div className="space-y-0.5">
                  {inputParams.slice(0, 3).map((param) => (
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
                  {inputParams.length > 3 && (
                    <span className="text-[10px] text-muted-foreground">
                      +{inputParams.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            )}
            {outputParams.length > 0 && (
              <div>
                <span className="mb-1 block text-[10px] uppercase text-muted-foreground">
                  Output ({outputParams.length})
                </span>
                <div className="space-y-0.5">
                  {outputParams.map((param) => (
                    <div
                      key={param.name}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span
                        className="rounded-sm px-1 py-0.5 text-[9px] font-bold"
                        style={{
                          color: OBJECT_COLORS.storedProcedures,
                          backgroundColor: `color-mix(in srgb, ${OBJECT_COLORS.storedProcedures} 15%, transparent)`,
                        }}
                      >
                        OUT
                      </span>
                      <span className="whitespace-nowrap text-foreground">
                        {param.name}
                      </span>
                      <span className="ml-auto text-[10px] text-muted-foreground">
                        {param.dataType}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export const StoredProcedureNode = memo(StoredProcedureNodeComponent);
