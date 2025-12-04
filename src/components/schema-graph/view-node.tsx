import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { ViewNode as ViewNodeType, Column } from "@/types/schema";
import { cn } from "@/lib/utils";

interface ViewNodeData {
  view: ViewNodeType;
  isFocused?: boolean;
  isDimmed?: boolean;
  onClick?: () => void;
}

function ViewNodeComponent({ data }: NodeProps) {
  const { view, isFocused, isDimmed, onClick } = data as unknown as ViewNodeData;

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
      {/* Generic target handle for incoming procedure/trigger references */}
      <Handle
        type="target"
        position={Position.Left}
        id={`${view.id}-target`}
        className="!w-2 !h-2 !bg-emerald-500 !border-2 !border-white"
        style={{ top: "50%", transform: "translateY(-50%)", left: -4 }}
      />
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white px-3 py-2">
        <span className="text-[10px] text-emerald-200 uppercase tracking-wide block">
          {view.schema}
        </span>
        <span className="text-sm font-semibold">{view.name}</span>
      </div>

      {/* Columns */}
      <div className="py-1">
        {view.columns.map((column, index) => (
          <ColumnRow
            key={column.name}
            column={column}
            viewId={view.id}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}

interface ColumnRowProps {
  column: Column;
  viewId: string;
  index: number;
}

function ColumnRow({ column, viewId }: ColumnRowProps) {
  const handleId = `${viewId}-${column.name}`;

  return (
    <div className="flex items-center px-3 py-1 hover:bg-muted relative min-h-[28px]">
      {/* Left handle for incoming references (target) */}
      <Handle
        type="target"
        position={Position.Left}
        id={`${handleId}-target`}
        className="!w-2 !h-2 !bg-emerald-500 !border-2 !border-white"
        style={{ top: "50%", transform: "translateY(-50%)", left: -4 }}
      />

      {/* Column info */}
      <div className="flex items-center gap-2 flex-1 overflow-hidden">
        <span className="text-xs text-foreground truncate">{column.name}</span>
        <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-auto">
          {column.dataType}
        </span>
        {column.isNullable && (
          <span className="text-amber-500 text-xs font-bold flex-shrink-0">
            ?
          </span>
        )}
      </div>

      {/* Right handle for outgoing references (source) */}
      <Handle
        type="source"
        position={Position.Right}
        id={`${handleId}-source`}
        className="!w-2 !h-2 !bg-emerald-500 !border-2 !border-white"
        style={{ top: "50%", transform: "translateY(-50%)", right: -4 }}
      />
    </div>
  );
}

// Memoize for performance
export const ViewNode = memo(ViewNodeComponent);
