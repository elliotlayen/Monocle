import { memo, useMemo } from "react";
import { Handle, Position } from "@xyflow/react";
import { Column } from "../types";
import {
  EdgeType,
  ObjectType,
  useSchemaStore,
  selectNodeStyle,
} from "../store";
import { cn } from "@/lib/utils";
import { EDGE_COLORS, OBJECT_COLORS } from "@/constants/edge-colors";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  buildColumnHandleBase,
  buildNodeHandleBase,
} from "@/features/schema-graph/utils/handle-ids";
import {
  TABLE_VIEW_HEADER_HEIGHT,
  TABLE_VIEW_ROW_HEIGHT,
  getTableViewNodeHeight,
} from "./node-geometry";
import { NODE_SHELL_CLASS, getNodeStyleSpec } from "./node-style";

export { NODE_SHELL_CLASS } from "./node-style";

export function HandleIndicators({
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

/** Canvas-mode connection handles share one accent look across node kinds. */
export function nodeHandleClass(canvasMode?: boolean): string {
  return canvasMode
    ? "!w-2 !h-2 !rounded-full !bg-accent-blue !border-accent-blue"
    : "!w-0 !h-0 !bg-transparent !border-0";
}

export function nodeShellClass(isDimmed?: boolean): string {
  return cn(
    NODE_SHELL_CLASS,
    isDimmed && "opacity-40",
    !isDimmed && "hover:shadow-md"
  );
}

/** Per-type focus emphasis derived from the object color tokens. */
export function nodeFocusStyle(
  objectType: ObjectType,
  isFocused?: boolean
): React.CSSProperties | undefined {
  if (!isFocused) return undefined;
  const color = OBJECT_COLORS[objectType];
  return {
    borderColor: color,
    boxShadow: `0 0 0 1px ${color}, 0 0 0 4px color-mix(in srgb, ${color} 25%, transparent)`,
  };
}

export function NodeKindDot({ objectType }: { objectType: ObjectType }) {
  return (
    <span
      aria-hidden
      className="h-1.5 w-1.5 shrink-0 rounded-full"
      style={{ backgroundColor: OBJECT_COLORS[objectType] }}
    />
  );
}

/** Per-node-kind presentation differences between tables and views. */
export interface TableViewNodeVariant {
  kindLabel: string;
  objectType: ObjectType;
  showPrimaryKeys: boolean;
}

export interface TableViewNodeCommonData {
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
  /** Browse mode: direct neighbors not currently on the canvas. */
  hiddenNeighborCount?: number;
  onExpandNeighbors?: () => void;
}

interface ColumnRenderData {
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

interface ColumnRowProps {
  row: ColumnRenderData;
  isCompact?: boolean;
  canvasMode?: boolean;
  showPrimaryKeys?: boolean;
}

function ColumnRowComponent({
  row,
  isCompact,
  canvasMode,
  showPrimaryKeys,
}: ColumnRowProps) {
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
  const fkColor =
    hasFkOut && hasFkIn
      ? OBJECT_COLORS.storedProcedures
      : hasFkOut
        ? "var(--accent-blue)"
        : OBJECT_COLORS.views;

  // In canvas mode, all columns get handles and they're visible
  const showHandle = hasHandle || canvasMode;
  const handleClass = nodeHandleClass(canvasMode);

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
      <div className="flex items-center gap-2 flex-1">
        <span
          className={cn(
            "text-xs text-foreground whitespace-nowrap",
            showPrimaryKeys && column.isPrimaryKey && "font-semibold"
          )}
        >
          {column.name}
        </span>
        {showPrimaryKeys && column.isPrimaryKey && (
          <span className="shrink-0 text-[8px] font-bold tracking-wide text-muted-foreground">
            PK
          </span>
        )}
        {(hasFkOut || hasFkIn) && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="inline-flex shrink-0 text-[8px] font-bold tracking-wide"
                style={{ color: fkColor }}
              >
                FK
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
        )}
        <span className="text-[10px] text-muted-foreground shrink-0 ml-auto">
          {column.dataType}
        </span>
        {column.isNullable && (
          <span
            className="shrink-0 text-[8px] font-medium text-muted-foreground/70"
            title="Nullable"
          >
            N
          </span>
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

const ColumnRow = memo(
  ColumnRowComponent,
  (prev, next) =>
    prev.row === next.row &&
    prev.isCompact === next.isCompact &&
    prev.canvasMode === next.canvasMode &&
    prev.showPrimaryKeys === next.showPrimaryKeys
);

export function TableViewNodeBody({
  nodeId,
  name,
  columns,
  data,
  variant,
}: {
  nodeId: string;
  name: string;
  columns: Column[];
  data: TableViewNodeCommonData;
  variant: TableViewNodeVariant;
}) {
  const {
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
    hiddenNeighborCount,
    onExpandNeighbors,
  } = data;
  const nodeHandleBase = buildNodeHandleBase(nodeId);
  const columnRows = useMemo<ColumnRenderData[]>(
    () =>
      columns.map((column) => {
        const handleId = buildColumnHandleBase(nodeId, column.name);
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
      columns,
      nodeId,
      columnsWithHandles,
      fkColumnUsage,
      fkColumnLinks,
      handleEdgeTypes,
    ]
  );

  const nodeLevelHandleClass = nodeHandleClass(canvasMode);
  const nodeStyle = useSchemaStore(selectNodeStyle(canvasMode));
  const styleSpec = getNodeStyleSpec(nodeStyle, variant.objectType, isCompact);

  return (
    <div
      onClick={onClick}
      style={{
        width: nodeWidth,
        minHeight: getTableViewNodeHeight(columns.length),
        ...styleSpec.shellStyle,
        ...nodeFocusStyle(variant.objectType, isFocused),
      }}
      className={nodeShellClass(isDimmed)}
    >
      {/* Header: minHeight pins geometry so style swaps never move handles. */}
      <div
        className={cn(
          "relative flex items-center border-b px-3 py-2",
          styleSpec.headerClass
        )}
        style={{
          minHeight: TABLE_VIEW_HEADER_HEIGHT,
          ...styleSpec.headerStyle,
        }}
      >
        {/* Generic target handle for incoming node-level references - inside header */}
        <Handle
          type="target"
          position={Position.Left}
          id={`${nodeHandleBase}-target`}
          className={nodeLevelHandleClass}
          style={{ top: "50%", transform: "translateY(-50%)", left: -4 }}
        />

        {/* Left header indicators - fixed width for alignment */}
        <div className="w-4 shrink-0">
          <HandleIndicators
            edgeTypes={handleEdgeTypes?.get(`${nodeHandleBase}-target`)}
            isCompact={isCompact}
          />
        </div>

        <div className="min-w-0 flex-1">
          {styleSpec.showKindLabel && (
            <span
              className={cn(
                "flex items-center gap-1.5 text-[10px] uppercase tracking-wide",
                styleSpec.kindLabelClass
              )}
            >
              {styleSpec.showKindDot && (
                <NodeKindDot objectType={variant.objectType} />
              )}
              {variant.kindLabel}
            </span>
          )}
          <span
            className={cn("block truncate font-semibold", styleSpec.nameClass)}
          >
            {name}
          </span>
        </div>

        {/* Browse mode: expand hidden neighbors */}
        {(hiddenNeighborCount ?? 0) > 0 && onExpandNeighbors && (
          <button
            className="mr-1 shrink-0 rounded-full bg-accent-blue/15 px-1.5 py-0.5 text-[10px] font-medium text-accent-blue transition-colors duration-[var(--duration-fast)] hover:bg-accent-blue/25"
            title={`Show ${hiddenNeighborCount} more connected object${
              hiddenNeighborCount === 1 ? "" : "s"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onExpandNeighbors();
            }}
          >
            +{hiddenNeighborCount}
          </button>
        )}

        {/* Right header indicators - fixed width for alignment */}
        <div className="w-4 shrink-0 flex justify-end">
          <HandleIndicators
            edgeTypes={handleEdgeTypes?.get(`${nodeHandleBase}-source`)}
            isCompact={isCompact}
          />
        </div>

        {/* Generic source handle for outgoing node-level connections - inside header */}
        <Handle
          type="source"
          position={Position.Right}
          id={`${nodeHandleBase}-source`}
          className={nodeLevelHandleClass}
          style={{ top: "50%", transform: "translateY(-50%)", right: -4 }}
        />
      </div>

      {/* Columns */}
      <div className="py-1" style={styleSpec.bodyStyle}>
        {columnRows.map((row) => (
          <ColumnRow
            key={row.column.name}
            row={row}
            isCompact={isCompact}
            canvasMode={canvasMode}
            showPrimaryKeys={variant.showPrimaryKeys}
          />
        ))}
      </div>
    </div>
  );
}
