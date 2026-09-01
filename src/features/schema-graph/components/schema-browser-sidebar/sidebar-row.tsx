import { memo } from "react";
import {
  ChevronDown,
  ChevronRight,
  Crosshair,
  Eye,
  FunctionSquare,
  Settings2,
  Table2,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ObjectType } from "../../store";
import type { SidebarItem, SidebarRow } from "./sidebar-tree";

const CATEGORY_ICONS: Record<ObjectType, React.ReactNode> = {
  tables: <Table2 className="h-4 w-4" />,
  views: <Eye className="h-4 w-4" />,
  triggers: <Zap className="h-4 w-4" />,
  storedProcedures: <Settings2 className="h-4 w-4" />,
  scalarFunctions: <FunctionSquare className="h-4 w-4" />,
};

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
          "flex items-center gap-2 w-full h-full px-2 rounded hover:bg-muted text-left",
          isActive && "bg-muted"
        )}
        onClick={() => onToggleCategory(row.categoryType)}
      >
        {row.expanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        )}
        <span className="text-muted-foreground flex-shrink-0">
          {CATEGORY_ICONS[row.categoryType]}
        </span>
        <span className="text-sm font-medium flex-1 truncate">{row.label}</span>
        <span className="text-xs text-muted-foreground">
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
          "flex items-center gap-2 w-full h-full px-2 rounded hover:bg-muted text-left ml-4 max-w-[calc(100%-1rem)]",
          isActive && "bg-muted"
        )}
        onClick={() => onToggleSchema(row.key.replace(/^schema-/, ""))}
      >
        {row.expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        )}
        <span className="text-sm text-muted-foreground flex-1 truncate">
          {row.label}
        </span>
        <span className="text-xs text-muted-foreground">
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
        "group flex items-center gap-2 h-full px-2 rounded hover:bg-muted ml-8 max-w-[calc(100%-2rem)] cursor-pointer",
        isActive && "bg-muted",
        isFocusedObject && "bg-blue-500/10 text-blue-600 dark:text-blue-400",
        dimmed && "opacity-50"
      )}
      onClick={(e) => onItemClick(item, e.currentTarget as HTMLElement)}
      onDoubleClick={focusable ? () => onItemFocus(item.id) : undefined}
    >
      <span className="text-sm truncate flex-1">{item.name}</span>
      {focusable && (
        <button
          tabIndex={-1}
          className={cn(
            "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground shrink-0",
            isFocusedObject && "opacity-100 text-blue-500"
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
