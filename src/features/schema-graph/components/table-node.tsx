import { memo, useMemo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { TbCircleDashedLetterN, TbLink } from "react-icons/tb";
import { IoMdKey } from "react-icons/io";
import { TableNode as TableNodeType, Column } from "../types";
import { EdgeType } from "../store";
import { cn } from "@/lib/utils";
import { EDGE_COLORS } from "@/constants/edge-colors";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  buildColumnHandleBase,
  buildNodeHandleBase,
} from "@/features/schema-graph/utils/handle-ids";
import {
  TABLE_VIEW_ROW_HEIGHT,
  getTableViewNodeHeight,
} from "./node-geometry";

function HandleIndicators({
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
}

interface TableNodeData {
  table: TableNodeType;
  nodeWidth?: number;
  isFocused?: boolean;
  isDimmed?: boolean;
  isCompact?: boolean;
  canvasMode?: boolean;
  columnsWithHandles?: Set<string>;
  fkColumnUsage?: Map<string, { outgoing: number; incoming: number }>;
  fkColumnLinks?: Map<
    string,
    { direction: "outgoing" | "incoming"; tableId: string; column: string }[]
  >;
  handleEdgeTypes?: Map<string, Set<EdgeType>>;
  onClick?: (event: React.MouseEvent) => void;
}

interface TableColumnRenderData {
  column: Column;
  handleId: string;
  hasHandle: boolean;
  targetEdgeTypes?: Set<EdgeType>;
  sourceEdgeTypes?: Set<EdgeType>;
  hasFkOut: boolean;
  hasFkIn: boolean;
  fkOutgoingTargets: string[];
  fkIncomingTargets: string[];
}

function TableNodeComponent({ data }: NodeProps) {
  const {
    table,
    nodeWidth,
    isFocused,
    isDimmed,
    isCompact,
    canvasMode,
    columnsWithHandles,
    fkColumnUsage,
    fkColumnLinks,
    handleEdgeTypes,
    onClick,
  } = data as unknown as TableNodeData;
  const nodeHandleBase = buildNodeHandleBase(table.id);
  const columnRows = useMemo<TableColumnRenderData[]>(
    () =>
      table.columns.map((column) => {
        const handleId = buildColumnHandleBase(table.id, column.name);
        const fkUsage = fkColumnUsage?.get(handleId);
        const fkLinks = fkColumnLinks?.get(handleId) ?? [];
        const hasFkOut = (fkUsage?.outgoing ?? 0) > 0;
        const hasFkIn = (fkUsage?.incoming ?? 0) > 0;
        return {
          column,
          handleId,
          hasHandle: columnsWithHandles?.has(handleId) ?? true,
          targetEdgeTypes: handleEdgeTypes?.get(`${handleId}-target`),
          sourceEdgeTypes: handleEdgeTypes?.get(`${handleId}-source`),
          hasFkOut,
          hasFkIn,
          fkOutgoingTargets: fkLinks
            .filter((link) => link.direction === "outgoing")
            .map((link) =>
              link.column ? `${link.tableId}.${link.column}` : link.tableId
            ),
          fkIncomingTargets: fkLinks
            .filter((link) => link.direction === "incoming")
            .map((link) =>
              link.column ? `${link.tableId}.${link.column}` : link.tableId
            ),
        };
      }),
    [
      table.columns,
      table.id,
      columnsWithHandles,
      fkColumnUsage,
      fkColumnLinks,
      handleEdgeTypes,
    ]
  );

  return (
    <div
      onClick={onClick}
      style={{
        width: nodeWidth,
        minHeight: getTableViewNodeHeight(table.columns.length),
      }}
      className={cn(
        "bg-card border border-border rounded-lg shadow-sm overflow-hidden transition-all duration-200 cursor-pointer relative",
        isFocused && "border-blue-500 ring-2 ring-blue-200",
        isDimmed && "opacity-40",
        !isDimmed && "hover:shadow-md"
      )}
    >
      {/* Header */}
      <div className="bg-slate-700 text-white px-3 py-2 flex items-center relative">
        {/* Generic target handle for incoming procedure/trigger references - inside header */}
        <Handle
          type="target"
          position={Position.Left}
          id={`${nodeHandleBase}-target`}
          className={
            canvasMode
              ? "!w-2 !h-2 !bg-blue-400 !border-blue-500 !rounded-full"
              : "!w-0 !h-0 !bg-transparent !border-0"
          }
          style={{ top: "50%", transform: "translateY(-50%)", left: -4 }}
        />

        {/* Left header indicators - fixed width for alignment */}
        <div className="w-4 shrink-0">
          <HandleIndicators
            edgeTypes={handleEdgeTypes?.get(`${nodeHandleBase}-target`)}
            isCompact={isCompact}
          />
        </div>

        <div className="flex-1">
          <span className="text-[10px] text-slate-400 uppercase tracking-wide block">
            Table
          </span>
          <span className="text-sm font-semibold">{table.name}</span>
        </div>

        {/* Right header indicators - fixed width for alignment */}
        <div className="w-4 shrink-0 flex justify-end">
          <HandleIndicators
            edgeTypes={handleEdgeTypes?.get(`${nodeHandleBase}-source`)}
            isCompact={isCompact}
          />
        </div>

        {/* Generic source handle for outgoing table-level connections (e.g., to triggers) - inside header */}
        <Handle
          type="source"
          position={Position.Right}
          id={`${nodeHandleBase}-source`}
          className={
            canvasMode
              ? "!w-2 !h-2 !bg-blue-400 !border-blue-500 !rounded-full"
              : "!w-0 !h-0 !bg-transparent !border-0"
          }
          style={{ top: "50%", transform: "translateY(-50%)", right: -4 }}
        />
      </div>

      {/* Columns */}
      <div className="py-1">
        {columnRows.map((row) => (
          <ColumnRow
            key={row.column.name}
            row={row}
            isCompact={isCompact}
            canvasMode={canvasMode}
          />
        ))}
      </div>
    </div>
  );
}

interface ColumnRowProps {
  row: TableColumnRenderData;
  isCompact?: boolean;
  canvasMode?: boolean;
}

function ColumnRowComponent({ row, isCompact, canvasMode }: ColumnRowProps) {
  const {
    column,
    handleId,
    hasHandle,
    targetEdgeTypes,
    sourceEdgeTypes,
    hasFkOut,
    hasFkIn,
    fkOutgoingTargets,
    fkIncomingTargets,
  } = row;
  const fkClass = hasFkOut && hasFkIn
    ? "text-violet-500"
    : hasFkOut
      ? "text-blue-500"
      : "text-emerald-500";

  // In canvas mode, all columns get handles and they're visible
  const showHandle = hasHandle || canvasMode;
  const handleClass = canvasMode
    ? "!w-2 !h-2 !bg-blue-400 !border-blue-500 !rounded-full"
    : "!w-0 !h-0 !bg-transparent !border-0";

  if (isCompact) {
    return (
      <div className="relative" style={{ minHeight: TABLE_VIEW_ROW_HEIGHT }}>
        {showHandle && (
          <Handle
            type="target"
            position={Position.Left}
            id={`${handleId}-target`}
            className={handleClass}
            style={{ top: "50%", transform: "translateY(-50%)", left: -4 }}
          />
        )}
        {showHandle && (
          <Handle
            type="source"
            position={Position.Right}
            id={`${handleId}-source`}
            className={handleClass}
            style={{ top: "50%", transform: "translateY(-50%)", right: -4 }}
          />
        )}
      </div>
    );
  }

  return (
    <div
      className="flex items-center px-3 py-1 hover:bg-muted relative"
      style={{ minHeight: TABLE_VIEW_ROW_HEIGHT }}
    >
      {/* Left handle for incoming FKs (target) */}
      {showHandle && (
        <Handle
          type="target"
          position={Position.Left}
          id={`${handleId}-target`}
          className={handleClass}
          style={{ top: "50%", transform: "translateY(-50%)", left: -4 }}
        />
      )}

      {/* Left edge type indicators - fixed width for alignment */}
      <div className="w-4 shrink-0">
        <HandleIndicators edgeTypes={targetEdgeTypes} />
      </div>

      {/* Column info */}
      <div className="flex items-center gap-2 flex-1">
        <span
          className={cn(
            "text-xs text-foreground whitespace-nowrap",
            column.isPrimaryKey && "font-semibold"
          )}
        >
          {column.name}
        </span>
        {column.isPrimaryKey && (
          <IoMdKey className="text-slate-400 w-3.5 h-3.5 shrink-0 -ml-1" />
        )}
        {(hasFkOut || hasFkIn) && (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <TbLink className={`${fkClass} w-3.5 h-3.5 shrink-0 -ml-1`} />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top" align="start" className="max-w-xs">
                <div className="space-y-2 text-xs">
                  {fkOutgoingTargets.length > 0 && (
                    <div>
                      <div className="text-[11px] font-medium text-muted-foreground">
                        References
                      </div>
                      <ul className="list-disc pl-4">
                        {fkOutgoingTargets.map((target) => (
                          <li key={target} className="font-mono text-[11px]">
                            {target}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {fkIncomingTargets.length > 0 && (
                    <div>
                      <div className="text-[11px] font-medium text-muted-foreground">
                        Referenced by
                      </div>
                      <ul className="list-disc pl-4">
                        {fkIncomingTargets.map((target) => (
                          <li key={target} className="font-mono text-[11px]">
                            {target}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
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

      {/* Right handle for outgoing FKs (source) */}
      {showHandle && (
        <Handle
          type="source"
          position={Position.Right}
          id={`${handleId}-source`}
          className={handleClass}
          style={{ top: "50%", transform: "translateY(-50%)", right: -4 }}
        />
      )}
    </div>
  );
}

const ColumnRow = memo(
  ColumnRowComponent,
  (prev, next) =>
    prev.row === next.row &&
    prev.isCompact === next.isCompact &&
    prev.canvasMode === next.canvasMode
);

// Memoize for performance
export const TableNode = memo(TableNodeComponent);
