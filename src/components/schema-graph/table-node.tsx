import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { TableNode as TableNodeType, Column } from "@/types/schema";
import { cn } from "@/lib/utils";

interface TableNodeData {
  table: TableNodeType;
  isFocused?: boolean;
  isDimmed?: boolean;
  onClick?: () => void;
}

function TableNodeComponent({ data }: NodeProps) {
  const { table, isFocused, isDimmed, onClick } = data as unknown as TableNodeData;

  return (
    <div
      onClick={onClick}
      className={cn(
        "bg-card border border-border rounded-lg shadow-sm min-w-[240px] max-w-[320px] overflow-hidden transition-all duration-200 cursor-pointer relative",
        isFocused && "border-blue-500 ring-2 ring-blue-200",
        isDimmed && "opacity-40",
        !isDimmed && "hover:shadow-md"
      )}
    >
      {/* Generic target handle for incoming procedure/trigger references */}
      <Handle
        type="target"
        position={Position.Left}
        id={`${table.id}-target`}
        className="!w-0 !h-0 !bg-transparent !border-0"
        style={{ top: "50%", transform: "translateY(-50%)", left: -4 }}
      />
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white px-3 py-2 relative">
        {/* Generic source handle for outgoing table-level connections (e.g., to triggers) */}
        <Handle
          type="source"
          position={Position.Right}
          id={`${table.id}-source`}
          className="!w-0 !h-0 !bg-transparent !border-0"
          style={{ top: "50%", transform: "translateY(-50%)", right: -4 }}
        />
        <span className="text-[10px] text-slate-400 uppercase tracking-wide block">
          Table
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

function ColumnRow({ column, tableId }: ColumnRowProps) {
  const handleId = `${tableId}-${column.name}`;

  return (
    <div className="flex items-center px-3 py-1 hover:bg-muted relative min-h-[28px]">
      {/* Left handle for incoming FKs (target) */}
      <Handle
        type="target"
        position={Position.Left}
        id={`${handleId}-target`}
        className="!w-0 !h-0 !bg-transparent !border-0"
        style={{ top: "50%", transform: "translateY(-50%)", left: -4 }}
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
            "text-xs text-foreground truncate",
            column.isPrimaryKey && "font-semibold"
          )}
        >
          {column.name}
        </span>
        <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-auto">
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
        id={`${handleId}-source`}
        className="!w-0 !h-0 !bg-transparent !border-0"
        style={{ top: "50%", transform: "translateY(-50%)", right: -4 }}
      />
    </div>
  );
}

// Memoize for performance
export const TableNode = memo(TableNodeComponent);
