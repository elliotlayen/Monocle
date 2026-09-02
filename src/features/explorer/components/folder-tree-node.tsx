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
  Plus,
  RotateCw,
  Star,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDateFolder } from "../utils/date-format";
import type { TintRunFlags, TreeNodeRow, TreeRow } from "../store/selectors";

/** DOM id for a tree row, used by aria-activedescendant. */
export function treeRowDomId(key: string): string {
  return `tree-row-${key}`;
}

interface FolderTreeRowProps {
  row: TreeRow;
  isSelected: boolean;
  isFocused: boolean;
  /** Connected-tint flags for the search scope; undefined when no scope. */
  tint?: TintRunFlags;
  /** True while a scope is active and this row falls outside it. */
  dimmed: boolean;
  /** True when this exact folder is a scope root. */
  scoped: boolean;
  /** Short label when this file appears in the active results. */
  matchLabel?: string;
  /** Seconds the row has been loading, or null when not worth showing. */
  elapsedSeconds: number | null;
  onToggle: (row: TreeNodeRow) => void;
  onOpenFile: (row: TreeNodeRow) => void;
  onCancelLoad: (row: TreeNodeRow) => void;
  onRetry: (row: TreeNodeRow) => void;
  onFavoritesToggle: (sourceId: string) => void;
  onToggleScope: (row: TreeNodeRow) => void;
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
  tint,
  dimmed,
  scoped,
  matchLabel,
  elapsedSeconds,
  onToggle,
  onOpenFile,
  onCancelLoad,
  onRetry,
  onFavoritesToggle,
  onToggleScope,
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
  const inScope = tint?.inScope ?? false;

  // Exactly one background treatment per row; selection always wins over
  // the green match tint, which wins over the blue in-scope tint.
  const background = isSelected
    ? "bg-accent"
    : matchLabel
      ? "bg-success/10 hover:bg-success/20"
      : inScope
        ? "bg-accent-blue/[0.07] hover:bg-accent-blue/15"
        : "hover:bg-muted";
  // Contiguous in-scope rows merge into one connected block: corners round
  // only where the run starts or ends.
  const corners = inScope
    ? cn(
        "rounded-none",
        tint?.runStart && "rounded-t-md",
        tint?.runEnd && "rounded-b-md"
      )
    : "rounded";
  const dimClass = dimmed ? "opacity-50" : undefined;

  return (
    <div
      id={treeRowDomId(row.key)}
      data-row-key={row.key}
      role="treeitem"
      aria-level={row.depth + 1}
      aria-selected={isSelected}
      {...(row.isDir ? { "aria-expanded": row.isExpanded } : {})}
      className={cn(
        "group flex items-center gap-1 w-full cursor-pointer transition-colors duration-[var(--duration-fast)]",
        corners,
        background,
        isSource ? "py-1.5" : "py-1",
        isFocused && "ring-1 ring-ring",
        isError && !isSource && "text-muted-foreground"
      )}
      style={{ paddingLeft: `${row.depth * 16}px` }}
      onClick={() => (row.isDir ? onToggle(row) : onOpenFile(row))}
    >
      <span className={cn("contents", dimClass && "[&>*]:opacity-50")}>
        <Chevron row={row} />
        <RowIcon row={row} />
      </span>
      <span
        className={cn(
          "text-sm truncate",
          isSource && "font-semibold",
          dimClass
        )}
        title={dateLabel ?? undefined}
      >
        {row.name}
      </span>
      {isSource && row.tag && (
        <Badge variant="secondary" className="text-xs flex-shrink-0">
          {row.tag}
        </Badge>
      )}
      {matchLabel && (
        <span className="flex-shrink-0 text-[10px] text-success">
          {matchLabel}
        </span>
      )}
      <RowBadge row={row} />
      {row.isDir && !isSource && (
        <span
          role="button"
          tabIndex={-1}
          className={cn(
            // Right-aligned so a click near the folder name never lands on
            // the badge by accident.
            "ml-auto mr-1 inline-flex h-4 flex-shrink-0 items-center gap-0.5 rounded px-1 text-[9px] tracking-wide transition-opacity duration-[var(--duration-fast)]",
            scoped
              ? "border border-accent-blue/40 bg-accent-blue/12 text-accent-blue"
              : "border border-border text-muted-foreground opacity-0 group-hover:opacity-100"
          )}
          title={
            scoped
              ? "Remove from search scope"
              : "Search only this folder (and inside)"
          }
          onClick={(e) => {
            e.stopPropagation();
            onToggleScope(row);
          }}
        >
          {scoped ? (
            <>
              <X className="h-2 w-2" /> scope
            </>
          ) : (
            <>
              <Plus className="h-2 w-2" /> scope
            </>
          )}
        </span>
      )}
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
