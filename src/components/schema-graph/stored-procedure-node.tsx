import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { StoredProcedure } from "@/types/schema";
import { cn } from "@/lib/utils";

interface StoredProcedureNodeData {
  procedure: StoredProcedure;
  isFocused?: boolean;
  isDimmed?: boolean;
  onClick?: () => void;
}

function StoredProcedureNodeComponent({ data }: NodeProps) {
  const { procedure, isFocused, isDimmed, onClick } =
    data as unknown as StoredProcedureNodeData;

  const inputParams = procedure.parameters.filter((p) => !p.isOutput);
  const outputParams = procedure.parameters.filter((p) => p.isOutput);

  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-card border border-border rounded-lg shadow-sm min-w-[200px] max-w-[280px] overflow-hidden transition-all duration-200 cursor-pointer relative",
        isFocused && "border-violet-500 ring-2 ring-violet-200",
        isDimmed && "opacity-40",
        !isDimmed && "hover:shadow-md"
      )}
    >
      {/* Source handle for outgoing connections to referenced tables */}
      <Handle
        type="source"
        position={Position.Right}
        id={`${procedure.id}-source`}
        className="!w-0 !h-0 !bg-transparent !border-0"
        style={{ top: "50%", transform: "translateY(-50%)", right: -4 }}
      />
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-violet-500 text-white px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-violet-200 uppercase tracking-wide">
            {procedure.schema}
          </span>
        </div>
        <span className="text-sm font-semibold block truncate">
          {procedure.name}
        </span>
      </div>

      {/* Parameters */}
      <div className="px-3 py-2 space-y-2">
        {procedure.parameters.length === 0 ? (
          <span className="text-xs text-muted-foreground italic">No parameters</span>
        ) : (
          <>
            {inputParams.length > 0 && (
              <div>
                <span className="text-[10px] text-muted-foreground uppercase block mb-1">
                  Input ({inputParams.length})
                </span>
                <div className="space-y-0.5">
                  {inputParams.slice(0, 3).map((param) => (
                    <div
                      key={param.name}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span className="text-foreground truncate">
                        {param.name}
                      </span>
                      <span className="text-muted-foreground text-[10px] ml-auto">
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
                <span className="text-[10px] text-muted-foreground uppercase block mb-1">
                  Output ({outputParams.length})
                </span>
                <div className="space-y-0.5">
                  {outputParams.map((param) => (
                    <div
                      key={param.name}
                      className="flex items-center gap-2 text-xs"
                    >
                      <span className="bg-violet-100 text-violet-800 text-[9px] font-bold px-1 py-0.5 rounded">
                        OUT
                      </span>
                      <span className="text-foreground truncate">
                        {param.name}
                      </span>
                      <span className="text-muted-foreground text-[10px] ml-auto">
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
