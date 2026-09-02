import { cn } from "@/lib/utils";
import type { ObjectType } from "@/features/schema-graph/store";
import type { NodeStyle } from "@/features/settings/services/settings-service";
import {
  NODE_SHELL_CLASS,
  getNodeStyleSpec,
} from "@/features/schema-graph/components/node-style";
import { NodeKindDot } from "@/features/schema-graph/components/table-view-node-shared";
import {
  TABLE_VIEW_HEADER_HEIGHT,
  TABLE_VIEW_ROW_HEIGHT,
} from "@/features/schema-graph/components/node-geometry";

interface PreviewNodeProps {
  style: NodeStyle;
  objectType: ObjectType;
  kindLabel: string;
  name: string;
  rows: Array<[string, string]>;
  isCompact: boolean;
  width: number;
}

/**
 * A static stand-in for a graph node. Shares the shell class, header
 * structure, and getNodeStyleSpec with the real nodes so the preview cannot
 * drift from the canvas; it just has no React Flow handles.
 */
function PreviewNode({
  style,
  objectType,
  kindLabel,
  name,
  rows,
  isCompact,
  width,
}: PreviewNodeProps) {
  const spec = getNodeStyleSpec(style, objectType, isCompact);

  return (
    <div
      aria-hidden
      className={cn(NODE_SHELL_CLASS, "shrink-0 cursor-default")}
      style={{ width, ...spec.shellStyle }}
    >
      <div
        className={cn(
          "relative flex items-center border-b px-3 py-2",
          spec.headerClass
        )}
        style={{ minHeight: TABLE_VIEW_HEADER_HEIGHT, ...spec.headerStyle }}
      >
        <div className="min-w-0 flex-1">
          {spec.showKindLabel && (
            <span
              className={cn(
                "flex items-center gap-1.5 text-[10px] uppercase tracking-wide",
                spec.kindLabelClass
              )}
            >
              {spec.showKindDot && <NodeKindDot objectType={objectType} />}
              {kindLabel}
            </span>
          )}
          <span className={cn("block truncate font-semibold", spec.nameClass)}>
            {name}
          </span>
        </div>
      </div>
      <div className="py-1" style={spec.bodyStyle}>
        {rows.map(([label, type]) => (
          <div
            key={label}
            className="flex items-center justify-between px-3 text-xs"
            style={{ height: TABLE_VIEW_ROW_HEIGHT }}
          >
            {!isCompact && (
              <>
                <span className="truncate text-foreground">{label}</span>
                <span className="ml-2 shrink-0 text-[10px] text-muted-foreground">
                  {type}
                </span>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const TABLE_ROWS: Array<[string, string]> = [
  ["OrderId", "int"],
  ["CustomerId", "int"],
  ["Total", "money"],
];
const PROC_ROWS: Array<[string, string]> = [
  ["@OrderId", "int"],
  ["@Reason", "nvarchar"],
];
const VIEW_ROWS: Array<[string, string]> = [
  ["Region", "nvarchar"],
  ["Revenue", "money"],
];
const TRIGGER_ROWS: Array<[string, string]> = [["Type", "AFTER"]];

interface NodeStylePreviewProps {
  style: NodeStyle;
}

export function NodeStylePreview({ style }: NodeStylePreviewProps) {
  return (
    <div className="dot-grid overflow-hidden rounded-lg border border-border bg-background">
      {/* Keyed on style so the swap remounts: opacity + scale only, ease-out. */}
      <div
        key={style}
        className="animate-in fade-in-0 zoom-in-95 space-y-4 p-4 duration-[var(--duration-base)] ease-[var(--ease-out)]"
      >
        <div className="space-y-2">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Up close
          </span>
          <div className="flex gap-3 overflow-hidden">
            <PreviewNode
              style={style}
              objectType="tables"
              kindLabel="Table"
              name="dbo.Orders"
              rows={TABLE_ROWS}
              isCompact={false}
              width={168}
            />
            <PreviewNode
              style={style}
              objectType="storedProcedures"
              kindLabel="Procedure"
              name="usp_CloseOrder"
              rows={PROC_ROWS}
              isCompact={false}
              width={168}
            />
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Zoomed out
          </span>
          {/* Scaled wrapper: the outer box reserves the scaled height. */}
          <div className="h-[92px] overflow-hidden">
            <div className="flex origin-top-left scale-[0.6] gap-4">
              <PreviewNode
                style={style}
                objectType="tables"
                kindLabel="Table"
                name="dbo.Orders"
                rows={TABLE_ROWS}
                isCompact
                width={168}
              />
              <PreviewNode
                style={style}
                objectType="views"
                kindLabel="View"
                name="vw_Sales"
                rows={VIEW_ROWS}
                isCompact
                width={168}
              />
              <PreviewNode
                style={style}
                objectType="triggers"
                kindLabel="Trigger"
                name="trg_Audit"
                rows={TRIGGER_ROWS}
                isCompact
                width={168}
              />
              <PreviewNode
                style={style}
                objectType="scalarFunctions"
                kindLabel="Function"
                name="fn_Tax"
                rows={TRIGGER_ROWS}
                isCompact
                width={168}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
