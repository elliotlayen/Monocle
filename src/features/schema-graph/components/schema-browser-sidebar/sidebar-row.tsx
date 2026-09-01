import { memo } from "react";
import { ChevronDown, ChevronRight, Crosshair } from "lucide-react";
import { cn } from "@/lib/utils";
import { OBJECT_COLORS } from "@/constants/edge-colors";
import type { ObjectType } from "../../store";
import type { SidebarItem, SidebarRow } from "./sidebar-tree";

function TypeDot({ type }: { type: ObjectType }) {
  return (
    <span
      aria-hidden
      className="h-1.5 w-1.5 shrink-0 rounded-full"
      style={{ backgroundColor: OBJECT_COLORS[type] }}
    />
  );
}

function formatCount(shown: number, total: number): string {
  return shown === total ? `${total}` : `${shown}/${total}`;
}

export interface SidebarRowViewProps {
  row: SidebarRow;
  isActive: boolean;
  isFocusedObject: boolean;
  onToggleCategory: (type: ObjectType) => void;
  onToggleSchema: (key: string) => void;
  onItemClick: (item: SidebarItem, element: HTMLElement) => void;
  onItemFocus: (itemId: string) => void;
}

function SidebarRowViewComponent({
  row,
  isActive,
  isFocusedObject,
  onToggleCategory,
  onToggleSchema,
  onItemClick,
  onItemFocus,
}: SidebarRowViewProps) {
  if (row.kind === "category") {
    return (
      <button
        role="treeitem"
        aria-level={1}
        aria-expanded={row.expanded}
        aria-selected={isActive}
        tabIndex={-1}
        className={cn(
          "flex h-full w-full items-center gap-2 rounded-sm px-2 text-left hover:bg-muted",
          isActive && "bg-muted"
        )}
        onClick={() => onToggleCategory(row.categoryType)}
      >
        {row.expanded ? (
          <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
        )}
        <TypeDot type={row.categoryType} />
        <span className="flex-1 truncate text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {row.label}
        </span>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {formatCount(row.shown, row.total)}
        </span>
      </button>
    );
  }

  if (row.kind === "schema") {
    return (
      <button
        role="treeitem"
        aria-level={2}
        aria-expanded={row.expanded}
        aria-selected={isActive}
        tabIndex={-1}
        className={cn(
          "flex h-full w-full items-center gap-2 rounded-sm pl-6 pr-2 text-left hover:bg-muted",
          isActive && "bg-muted"
        )}
        onClick={() => onToggleSchema(row.key.replace(/^schema-/, ""))}
      >
        {row.expanded ? (
          <ChevronDown className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
        )}
        <span className="flex-1 truncate text-xs text-muted-foreground">
          {row.label}
        </span>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {formatCount(row.shown, row.total)}
        </span>
      </button>
    );
  }

  const { item, dimmed } = row;
  const focusable =
    item.type === "tables" || item.type === "views" ? item.id : null;

  return (
    <div
      role="treeitem"
      aria-level={3}
      aria-selected={isActive || isFocusedObject}
      className={cn(
        "group flex h-full cursor-pointer items-center gap-2 rounded-sm pl-9 pr-2 hover:bg-muted",
        isActive && "bg-muted",
        isFocusedObject && "bg-accent-blue/10 text-accent-blue",
        dimmed && "opacity-50"
      )}
      onClick={(e) => onItemClick(item, e.currentTarget as HTMLElement)}
      onDoubleClick={focusable ? () => onItemFocus(item.id) : undefined}
    >
      <span className="flex-1 truncate text-xs">{item.name}</span>
      {focusable && (
        <button
          tabIndex={-1}
          className={cn(
            "shrink-0 text-muted-foreground opacity-0 transition-opacity duration-[var(--duration-fast)] hover:text-foreground group-hover:opacity-100",
            isFocusedObject && "text-accent-blue opacity-100"
          )}
          title={isFocusedObject ? "Focused in graph" : "Focus in graph"}
          onClick={(e) => {
            e.stopPropagation();
            onItemFocus(item.id);
          }}
        >
          <Crosshair className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export const SidebarRowView = memo(SidebarRowViewComponent);
