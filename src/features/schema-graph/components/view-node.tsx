import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { TbCircleDashedLetterN, TbLink } from "react-icons/tb";
import { ViewNode as ViewNodeType, Column } from "../types";
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

interface ViewNodeData {
  view: ViewNodeType;
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

function ViewNodeComponent({ data }: NodeProps) {
  const {
    view,
    isFocused,
    isDimmed,
    isCompact,
    canvasMode,
    columnsWithHandles,
    fkColumnUsage,
    fkColumnLinks,
    handleEdgeTypes,
    onClick,
  } = data as unknown as ViewNodeData;
  const nodeHandleBase = buildNodeHandleBase(view.id);

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
      <div className="bg-emerald-600 text-white px-3 py-2 flex items-center relative">
        {/* Generic target handle for incoming procedure/trigger references - inside header */}
        <Handle
          type="target"
          position={Position.Left}
          id={`${nodeHandleBase}-target`}
          className={canvasMode ? "!w-2 !h-2 !bg-blue-400 !border-blue-500 !rounded-full" : "!w-0 !h-0 !bg-transparent !border-0"}
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
          <span className="text-[10px] text-emerald-200 uppercase tracking-wide block">
            View
          </span>
          <span className="text-sm font-semibold">{view.name}</span>
        </div>

        {/* Right header indicators - fixed width for alignment */}
        <div className="w-4 shrink-0 flex justify-end">
          <HandleIndicators
            edgeTypes={handleEdgeTypes?.get(`${nodeHandleBase}-source`)}
            isCompact={isCompact}
          />
        </div>

        {/* Generic source handle for outgoing view-level connections - inside header */}
        <Handle
          type="source"
          position={Position.Right}
          id={`${nodeHandleBase}-source`}
          className={canvasMode ? "!w-2 !h-2 !bg-blue-400 !border-blue-500 !rounded-full" : "!w-0 !h-0 !bg-transparent !border-0"}
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
            hasHandle={
              columnsWithHandles?.has(
                buildColumnHandleBase(view.id, column.name)
              ) ?? true
            }
            fkColumnUsage={fkColumnUsage}
            fkColumnLinks={fkColumnLinks}
            handleEdgeTypes={handleEdgeTypes}
            isCompact={isCompact}
            canvasMode={canvasMode}
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
  fkColumnUsage?: Map<string, { outgoing: number; incoming: number }>;
  fkColumnLinks?: Map<
    string,
    { direction: "outgoing" | "incoming"; tableId: string; column: string }[]
  >;
  handleEdgeTypes?: Map<string, Set<EdgeType>>;
  isCompact?: boolean;
  canvasMode?: boolean;
}

function ColumnRow({
  column,
  viewId,
  hasHandle,
  fkColumnUsage,
  fkColumnLinks,
  handleEdgeTypes,
  isCompact,
  canvasMode,
}: ColumnRowProps) {
  const handleId = buildColumnHandleBase(viewId, column.name);
  const targetEdgeTypes = handleEdgeTypes?.get(`${handleId}-target`);
  const sourceEdgeTypes = handleEdgeTypes?.get(`${handleId}-source`);
  const fkUsage = fkColumnUsage?.get(handleId);
  const fkLinks = fkColumnLinks?.get(handleId) ?? [];
  const hasFkOut = (fkUsage?.outgoing ?? 0) > 0;
  const hasFkIn = (fkUsage?.incoming ?? 0) > 0;
  const fkClass = hasFkOut && hasFkIn
    ? "text-violet-500"
    : hasFkOut
    ? "text-blue-500"
    : "text-emerald-500";
  const fkOutgoingTargets = fkLinks
    .filter((link) => link.direction === "outgoing")
    .map((link) =>
      link.column ? `${link.tableId}.${link.column}` : link.tableId
    );
  const fkIncomingTargets = fkLinks
    .filter((link) => link.direction === "incoming")
    .map((link) =>
      link.column ? `${link.tableId}.${link.column}` : link.tableId
    );
  const showHandle = hasHandle || canvasMode;
  const handleClass = canvasMode
    ? "!w-2 !h-2 !bg-blue-400 !border-blue-500 !rounded-full"
    : "!w-0 !h-0 !bg-transparent !border-0";

  if (isCompact) {
    return (
      <div className="relative h-3">
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
    <div className="flex items-center px-3 py-1 hover:bg-muted relative min-h-[28px]">
      {/* Left handle for incoming references (target) */}
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
      <div className="flex items-center gap-2 flex-1 overflow-hidden">
        <span className="text-xs text-foreground truncate">{column.name}</span>
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

      {/* Right handle for outgoing references (source) */}
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

// Memoize for performance
export const ViewNode = memo(ViewNodeComponent);
