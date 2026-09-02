import { memo } from "react";
import {
  ChevronRight,
  ChevronDown,
  Loader2,
  Folder,
  FolderOpen,
  FolderSync,
  FileCode,
  FileText,
  AlertTriangle,
  RotateCw,
  Star,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDateFolder } from "../utils/date-format";
import type { TreeNodeRow, TreeRow } from "../store/selectors";

/** DOM id for a tree row, used by aria-activedescendant. */
export function treeRowDomId(key: string): string {
  return `tree-row-${key}`;
}

interface FolderTreeRowProps {
  row: TreeRow;
  isSelected: boolean;
  isFocused: boolean;
  /** Seconds the row has been loading, or null when not worth showing. */
  elapsedSeconds: number | null;
  onToggle: (row: TreeNodeRow) => void;
  onOpenFile: (row: TreeNodeRow) => void;
  onCancelLoad: (row: TreeNodeRow) => void;
  onRetry: (row: TreeNodeRow) => void;
  onFavoritesToggle: (sourceId: string) => void;
}

function Chevron({ row }: { row: TreeNodeRow }) {
  if (!row.isDir) return null;
  if (row.loadState === "loading") {
    return (
      <Loader2 className="h-4 w-4 text-muted-foreground flex-shrink-0 animate-spin" />
    );
  }
  if (row.isExpanded) {
    return (
      <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
    );
  }
  return (
    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
  );
}

function RowIcon({ row }: { row: TreeNodeRow }) {
  if (row.type === "source") {
    if (row.loadState === "error") {
      return <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />;
    }
    return <FolderSync className="h-4 w-4 flex-shrink-0" />;
  }
  if (row.isDir) {
    if (row.loadState === "error") {
      return (
        <AlertTriangle className="h-3.5 w-3.5 text-warning flex-shrink-0" />
      );
    }
    if (row.isExpanded) {
      return <FolderOpen className="h-3.5 w-3.5 flex-shrink-0" />;
    }
    return <Folder className="h-3.5 w-3.5 flex-shrink-0" />;
  }
  if (row.name.toLowerCase().endsWith(".xml")) {
    return <FileCode className="h-3.5 w-3.5 flex-shrink-0" />;
  }
  return (
    <FileText className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
  );
}

function RowBadge({ row }: { row: TreeNodeRow }) {
  const dot =
    row.badge === "error" ? (
      <span className="h-2 w-2 rounded-full flex-shrink-0 bg-destructive" />
    ) : row.badge === "warning" ? (
      <span className="h-2 w-2 rounded-full flex-shrink-0 bg-warning" />
    ) : null;

  if (row.isDir && row.type !== "source" && row.childCount !== undefined) {
    return (
      <span className="flex items-center gap-1 flex-shrink-0">
        <span className="text-xs text-muted-foreground">{row.childCount}</span>
        {dot}
      </span>
    );
  }
  return dot ? <span className="ml-1 flex flex-shrink-0">{dot}</span> : null;
}

function FolderTreeRowInner({
  row,
  isSelected,
  isFocused,
  elapsedSeconds,
  onToggle,
  onOpenFile,
  onCancelLoad,
  onRetry,
  onFavoritesToggle,
}: FolderTreeRowProps) {
  if (row.kind === "favorites-header") {
    return (
      <div
        className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide py-1 cursor-pointer hover:text-foreground"
        style={{ paddingLeft: `${row.depth * 16}px` }}
        onClick={() => onFavoritesToggle(row.sourceId)}
      >
        {row.collapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
        Favorites
      </div>
    );
  }

  const isSource = row.type === "source";
  const isError = row.loadState === "error";
  const isLoading = row.loadState === "loading";
  const dateLabel =
    row.isDir && !isSource ? formatDateFolder(row.name).formatted : null;

  return (
    <div
      id={treeRowDomId(row.key)}
      data-row-key={row.key}
      role="treeitem"
      aria-level={row.depth + 1}
      aria-selected={isSelected}
      {...(row.isDir ? { "aria-expanded": row.isExpanded } : {})}
      className={cn(
        "group flex items-center gap-1 w-full rounded cursor-pointer",
        isSource ? "py-1.5" : "py-1",
        isSelected ? "bg-accent" : "hover:bg-muted",
        isFocused && "ring-1 ring-ring",
        isError && !isSource && "text-muted-foreground"
      )}
      style={{ paddingLeft: `${row.depth * 16}px` }}
      onClick={() => (row.isDir ? onToggle(row) : onOpenFile(row))}
    >
      <Chevron row={row} />
      <RowIcon row={row} />
      <span className={cn("text-sm truncate", isSource && "font-semibold")}>
        {row.name}
      </span>
      {dateLabel && (
        <span className="text-xs text-muted-foreground flex-shrink-0 truncate">
          {dateLabel}
        </span>
      )}
      {isSource && row.tag && (
        <Badge variant="secondary" className="text-xs flex-shrink-0">
          {row.tag}
        </Badge>
      )}
      <RowBadge row={row} />
      {isLoading && elapsedSeconds !== null && (
        <span className="flex items-center gap-1 flex-shrink-0">
          <span className="text-xs text-muted-foreground">
            Loading... {elapsedSeconds}s
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={(e) => {
              e.stopPropagation();
              onCancelLoad(row);
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </span>
      )}
      {isError && (
        <Button
          variant="ghost"
          size="sm"
          className="h-5 px-1.5 text-xs flex-shrink-0 text-muted-foreground"
          onClick={(e) => {
            e.stopPropagation();
            onRetry(row);
          }}
        >
          <RotateCw className="h-3 w-3" />
          Retry
        </Button>
      )}
      {row.isFavorite && row.isDir && !isSource && (
        <Star className="h-3.5 w-3.5 flex-shrink-0 fill-warning text-warning" />
      )}
    </div>
  );
}

export const FolderTreeRow = memo(FolderTreeRowInner);
