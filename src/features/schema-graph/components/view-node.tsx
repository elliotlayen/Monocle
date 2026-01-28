import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { TbCircleDashedLetterN } from "react-icons/tb";
import { ViewNode as ViewNodeType, Column } from "../types";
import { EdgeType } from "../store";
import { cn } from "@/lib/utils";
import { EDGE_COLORS } from "@/constants/edge-colors";

const HandleIndicators = memo(function HandleIndicators({
  edgeTypes,
  isCompact,
}: {
  edgeTypes?: Set<EdgeType>;
  isCompact?: boolean;
}) {
  if (isCompact || !edgeTypes || edgeTypes.size === 0) return null;
  return (
    <div className="flex flex-col gap-0.5">
      {Array.from(edgeTypes).map((type) => (
        <div
          key={type}
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{ backgroundColor: EDGE_COLORS[type] }}
        />
      ))}
    </div>
  );
});

interface ViewNodeData {
  view: ViewNodeType;
  isFocused?: boolean;
  isDimmed?: boolean;
  isCompact?: boolean;
  columnsWithHandles?: Set<string>;
  handleEdgeTypes?: Map<string, Set<EdgeType>>;
  onClick?: (event: React.MouseEvent) => void;
}

function ViewNodeComponent({ data }: NodeProps) {
  const {
    view,
    isFocused,
    isDimmed,
    isCompact,
    columnsWithHandles,
    handleEdgeTypes,
    onClick,
  } = data as unknown as ViewNodeData;

  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-card border border-border rounded-lg shadow-sm min-w-[240px] max-w-[320px] overflow-hidden transition-all duration-200 cursor-pointer relative",
        isFocused && "border-emerald-500 ring-2 ring-emerald-200",
        isDimmed && "opacity-40",
        !isDimmed && "hover:shadow-md"
      )}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white px-3 py-2 flex items-center relative">
        {/* Generic target handle for incoming procedure/trigger references - inside header */}
        <Handle
          type="target"
          position={Position.Left}
          id={`${view.id}-target`}
          className="!w-0 !h-0 !bg-transparent !border-0"
          style={{ top: "50%", transform: "translateY(-50%)", left: -4 }}
        />

        {/* Left header indicators - fixed width for alignment */}
        <div className="w-4 shrink-0">
          <HandleIndicators
            edgeTypes={handleEdgeTypes?.get(`${view.id}-target`)}
            isCompact={isCompact}
          />
        </div>

        <div className="flex-1">
          <span className="text-[10px] text-emerald-200 uppercase tracking-wide block">
            View
          </span>
          <span className="text-sm font-semibold">{view.name}</span>
        </div>

        {/* Right header indicators - fixed width for alignment */}
        <div className="w-4 shrink-0 flex justify-end">
          <HandleIndicators
            edgeTypes={handleEdgeTypes?.get(`${view.id}-source`)}
            isCompact={isCompact}
          />
        </div>

        {/* Generic source handle for outgoing view-level connections - inside header */}
        <Handle
          type="source"
          position={Position.Right}
          id={`${view.id}-source`}
          className="!w-0 !h-0 !bg-transparent !border-0"
          style={{ top: "50%", transform: "translateY(-50%)", right: -4 }}
        />
      </div>

      {/* Columns */}
      <div className="py-1">
        {view.columns.map((column, index) => (
          <ColumnRow
            key={column.name}
            column={column}
            viewId={view.id}
            index={index}
            hasHandle={columnsWithHandles?.has(`${view.id}-${column.name}`) ?? true}
            handleEdgeTypes={handleEdgeTypes}
            isCompact={isCompact}
          />
        ))}
      </div>
      {isCompact && (
        <div className="px-3 pb-2 text-[10px] text-muted-foreground">
          {view.columns.length} column{view.columns.length !== 1 && "s"}
        </div>
      )}
    </div>
  );
}

interface ColumnRowProps {
  column: Column;
  viewId: string;
  index: number;
  hasHandle: boolean;
  handleEdgeTypes?: Map<string, Set<EdgeType>>;
  isCompact?: boolean;
}

const ColumnRow = memo(function ColumnRow({
  column,
  viewId,
  hasHandle,
  handleEdgeTypes,
  isCompact,
}: ColumnRowProps) {
  const handleId = `${viewId}-${column.name}`;
  const targetEdgeTypes = handleEdgeTypes?.get(`${handleId}-target`);
  const sourceEdgeTypes = handleEdgeTypes?.get(`${handleId}-source`);

  if (isCompact) {
    return (
      <div className="relative h-3">
        {hasHandle && (
          <Handle
            type="target"
            position={Position.Left}
            id={`${handleId}-target`}
            className="!w-0 !h-0 !bg-transparent !border-0"
            style={{ top: "50%", transform: "translateY(-50%)", left: -4 }}
          />
        )}
        {hasHandle && (
          <Handle
            type="source"
            position={Position.Right}
            id={`${handleId}-source`}
            className="!w-0 !h-0 !bg-transparent !border-0"
            style={{ top: "50%", transform: "translateY(-50%)", right: -4 }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center px-3 py-1 hover:bg-muted relative min-h-[28px]">
      {/* Left handle for incoming references (target) - only render if column has relationships */}
      {hasHandle && (
        <Handle
          type="target"
          position={Position.Left}
          id={`${handleId}-target`}
          className="!w-0 !h-0 !bg-transparent !border-0"
          style={{ top: "50%", transform: "translateY(-50%)", left: -4 }}
        />
      )}

      {/* Left edge type indicators - fixed width for alignment */}
      <div className="w-4 shrink-0">
        <HandleIndicators edgeTypes={targetEdgeTypes} />
      </div>

      {/* Column info */}
      <div className="flex items-center gap-2 flex-1 overflow-hidden">
        <span className="text-xs text-foreground truncate">{column.name}</span>
        <span className="text-[10px] text-muted-foreground shrink-0 ml-auto">
          {column.dataType}
        </span>
        {column.isNullable && (
          <TbCircleDashedLetterN className="text-amber-500 w-3.5 h-3.5 shrink-0 -ml-1" />
        )}
      </div>

      {/* Right edge type indicators - fixed width for alignment */}
      <div className="w-4 shrink-0 flex justify-end">
        <HandleIndicators edgeTypes={sourceEdgeTypes} />
      </div>

      {/* Right handle for outgoing references (source) - only render if column has relationships */}
      {hasHandle && (
        <Handle
          type="source"
          position={Position.Right}
          id={`${handleId}-source`}
          className="!w-0 !h-0 !bg-transparent !border-0"
          style={{ top: "50%", transform: "translateY(-50%)", right: -4 }}
        />
      )}
    </div>
  );
});

// Memoize for performance
export const ViewNode = memo(ViewNodeComponent);
