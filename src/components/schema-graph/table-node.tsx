import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { TableNode as TableNodeType, Column } from "@/types/schema";
import { cn } from "@/lib/utils";

interface TableNodeData {
  table: TableNodeType;
  isFocused?: boolean;
  isDimmed?: boolean;
}

function TableNodeComponent({ data }: NodeProps) {
  const { table, isFocused, isDimmed } = data as TableNodeData;

  return (
    <div
      className={cn(
        "bg-white border border-slate-200 rounded-lg shadow-sm min-w-[240px] max-w-[320px] overflow-hidden transition-all duration-200",
        isFocused && "border-blue-500 ring-2 ring-blue-200",
        isDimmed && "opacity-40",
        !isDimmed && "hover:shadow-md"
      )}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white px-3 py-2">
        <span className="text-[10px] text-slate-400 uppercase tracking-wide block">
          {table.schema}
        </span>
        <span className="text-sm font-semibold">{table.name}</span>
      </div>

      {/* Columns */}
      <div className="py-1">
        {table.columns.map((column, index) => (
          <ColumnRow
            key={column.name}
            column={column}
            tableId={table.id}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}

interface ColumnRowProps {
  column: Column;
  tableId: string;
  index: number;
}

function ColumnRow({ column, tableId, index }: ColumnRowProps) {
  const handleId = `${tableId}-${column.name}`;
  // Calculate handle position based on index
  // Header is ~52px, each column row is ~28px
  const handleTop = 52 + index * 28 + 14;

  return (
    <div className="flex items-center px-3 py-1 hover:bg-slate-50 relative min-h-[28px]">
      {/* Left handle for incoming FKs (target) */}
      <Handle
        type="target"
        position={Position.Left}
        id={handleId}
        className="!w-2 !h-2 !bg-blue-500 !border-2 !border-white"
        style={{ top: handleTop, left: -4 }}
      />

      {/* Column info */}
      <div className="flex items-center gap-2 flex-1 overflow-hidden">
        {column.isPrimaryKey && (
          <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1 py-0.5 rounded flex-shrink-0">
            PK
          </span>
        )}
        <span
          className={cn(
            "text-xs text-slate-700 truncate",
            column.isPrimaryKey && "font-semibold"
          )}
        >
          {column.name}
        </span>
        <span className="text-[10px] text-slate-400 flex-shrink-0 ml-auto">
          {column.dataType}
        </span>
        {column.isNullable && (
          <span className="text-amber-500 text-xs font-bold flex-shrink-0">
            ?
          </span>
        )}
      </div>

      {/* Right handle for outgoing FKs (source) */}
      <Handle
        type="source"
        position={Position.Right}
        id={handleId}
        className="!w-2 !h-2 !bg-blue-500 !border-2 !border-white"
        style={{ top: handleTop, right: -4 }}
      />
    </div>
  );
}

// Memoize for performance
export const TableNode = memo(TableNodeComponent);
