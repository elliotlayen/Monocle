import { useState, useEffect } from "react";
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
  Star,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { formatDateFolder } from "../utils/date-format";
import { useFileActions } from "../hooks/use-file-actions";
import { useExplorerStore } from "../store";
import type { TreeNode } from "../types";

interface FolderTreeNodeProps {
  node: TreeNode;
  depth: number;
  sourceId: string;
  isExpanded: boolean;
  onExpand: (nodeId: string) => void;
  onCollapse: (nodeId: string) => void;
  onCancel: (nodeId: string) => void;
  onToggleFavorite: (sourceId: string, clientName: string) => void;
  onFileClick: (filePath: string) => void;
}

export function FolderTreeNode({
  node,
  depth,
  sourceId,
  isExpanded,
  onExpand,
  onCollapse,
  onCancel,
  onToggleFavorite,
  onFileClick,
}: FolderTreeNodeProps) {
  const { copyPath, copyContent, openExternal, saveCopy } = useFileActions();
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Track elapsed time during loading state
  useEffect(() => {
    if (node.loadState !== "loading") {
      setElapsedSeconds(0);
      return;
    }

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [node.loadState]);

  const handleToggle = () => {
    if (node.type === "file") return;
    if (isExpanded) {
      onCollapse(node.id);
    } else {
      onExpand(node.id);
    }
  };

  const isSource = node.type === "source";
  const isClient = node.type === "client";
  const isDate = node.type === "date";
  const isFile = node.type === "file";
  const isLoading = node.loadState === "loading";
  const isError = node.loadState === "error";

  const rowPadding = isSource ? "py-1.5" : "py-1";

  const renderChevron = () => {
    if (isFile) return null;

    if (isLoading) {
      return (
        <Loader2 className="h-4 w-4 text-muted-foreground flex-shrink-0 animate-spin" />
      );
    }

    if (isExpanded) {
      return (
        <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      );
    }

    return (
      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
    );
  };

  const renderIcon = () => {
    if (isSource) {
      if (isError) {
        return (
          <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0" />
        );
      }
      return <FolderSync className="h-4 w-4 flex-shrink-0" />;
    }

    if (isClient || isDate) {
      const iconSize = isClient ? "h-4 w-4" : "h-3.5 w-3.5";
      if (isExpanded) {
        return <FolderOpen className={cn(iconSize, "flex-shrink-0")} />;
      }
      return <Folder className={cn(iconSize, "flex-shrink-0")} />;
    }

    if (isFile) {
      const isXml = node.name.toLowerCase().endsWith(".xml");
      if (isXml) {
        return <FileCode className="h-3.5 w-3.5 flex-shrink-0" />;
      }
      return (
        <FileText className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
      );
    }

    return null;
  };

  const renderName = () => {
    if (isDate) {
      const { raw, formatted } = formatDateFolder(node.name);
      return (
        <span className="flex items-center gap-1 min-w-0">
          <span className="text-sm truncate">{raw}</span>
          {formatted && (
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              ({formatted})
            </span>
          )}
        </span>
      );
    }

    return (
      <span
        className={cn(
          "text-sm truncate",
          isSource && "font-semibold",
          isClient && "font-medium"
        )}
      >
        {node.name}
      </span>
    );
  };

  // Get validation status for file nodes from the store cache
  const validationStatus = isFile
    ? useExplorerStore.getState().getValidationStatus(node.path)
    : undefined;

  const renderBadge = () => {
    if (isSource && node.type === "source") {
      return null;
    }

    if ((isClient || isDate) && node.childCount !== undefined) {
      return (
        <span className="text-xs text-muted-foreground flex-shrink-0">
          {node.childCount}
        </span>
      );
    }

    if (isFile && validationStatus === "error") {
      return (
        <span className="h-2 w-2 rounded-full flex-shrink-0 bg-red-500 dark:bg-red-400 ml-1" />
      );
    }

    if (isFile && validationStatus === "warning") {
      return (
        <span className="h-2 w-2 rounded-full flex-shrink-0 bg-amber-500 dark:bg-amber-400 ml-1" />
      );
    }

    return null;
  };

  const renderLoadingInfo = () => {
    if (!isLoading || elapsedSeconds < 3) return null;

    return (
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
            onCancel(node.id);
          }}
        >
          <X className="h-3 w-3" />
        </Button>
      </span>
    );
  };

  const renderStar = () => {
    if (!isClient) return null;

    return (
      <button
        className={cn(
          "flex-shrink-0",
          node.isFavorite ? "visible" : "invisible group-hover:visible"
        )}
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite(sourceId, node.name);
        }}
      >
        <Star
          className={cn(
            "h-3.5 w-3.5 cursor-pointer",
            node.isFavorite
              ? "fill-amber-500 text-amber-500"
              : "text-muted-foreground hover:text-foreground"
          )}
        />
      </button>
    );
  };

  const rowContent = (
    <div
      className={cn(
        "group flex items-center gap-1 w-full rounded",
        rowPadding,
        !isFile && "hover:bg-muted cursor-pointer",
        isFile && "hover:bg-muted cursor-pointer",
        isError && "text-muted-foreground opacity-60"
      )}
      style={{ paddingLeft: `${depth * 16}px` }}
      onClick={isFile ? () => onFileClick(node.path) : handleToggle}
    >
      {renderChevron()}
      {renderIcon()}
      {renderName()}
      {renderBadge()}
      {renderLoadingInfo()}
      {renderStar()}
    </div>
  );

  // Check if file is open in a tab (for enabling content-dependent actions)
  const isFileOpenInTab = isFile
    ? useExplorerStore.getState().tabs.some((t) => t.id === node.path)
    : false;
  const openTab = isFile
    ? useExplorerStore.getState().tabs.find((t) => t.id === node.path)
    : undefined;

  // Wrap nodes with context menus
  const wrappedRow = isFile ? (
    <ContextMenu>
      <ContextMenuTrigger asChild>{rowContent}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => copyPath(node.path)}>Copy Path</ContextMenuItem>
        <ContextMenuItem onClick={() => openExternal(node.path)}>Open in External Editor</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          onClick={() => openTab && copyContent(openTab.content)}
          disabled={!isFileOpenInTab}
        >
          Copy Content
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => openTab && saveCopy(node.name, openTab.content)}
          disabled={!isFileOpenInTab}
        >
          Save Copy...
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  ) : isClient ? (
    <ContextMenu>
      <ContextMenuTrigger asChild>{rowContent}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem
          onClick={() => onToggleFavorite(sourceId, node.name)}
        >
          {node.isFavorite ? "Remove from Favorites" : "Add to Favorites"}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  ) : isError && !isFile ? (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{rowContent}</TooltipTrigger>
        <TooltipContent>
          <p>Failed to load folder contents</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : (
    rowContent
  );

  return <>{wrappedRow}</>;
}

// Subcomponent: Source node with tag badge support
interface FolderTreeSourceNodeProps extends Omit<FolderTreeNodeProps, "onFileClick"> {
  tag?: string;
  onFileClick: (filePath: string) => void;
}

export function FolderTreeSourceNode({
  tag,
  ...props
}: FolderTreeSourceNodeProps) {
  const { node, depth, isExpanded, onExpand, onCollapse, onCancel } = props;
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const isLoading = node.loadState === "loading";
  const isError = node.loadState === "error";

  useEffect(() => {
    if (node.loadState !== "loading") {
      setElapsedSeconds(0);
      return;
    }

    const interval = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [node.loadState]);

  const handleToggle = () => {
    if (isExpanded) {
      onCollapse(node.id);
    } else {
      onExpand(node.id);
    }
  };

  return (
    <div
      className={cn(
        "group flex items-center gap-1 w-full rounded py-1.5 hover:bg-muted cursor-pointer",
        isError && "opacity-60"
      )}
      style={{ paddingLeft: `${depth * 16}px` }}
      onClick={handleToggle}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 text-muted-foreground flex-shrink-0 animate-spin" />
      ) : isExpanded ? (
        <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      ) : (
        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      )}
      {isError ? (
        <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0" />
      ) : (
        <FolderSync className="h-4 w-4 flex-shrink-0" />
      )}
      <span className="text-sm font-semibold truncate">{node.name}</span>
      {tag && (
        <Badge variant="secondary" className="text-xs flex-shrink-0">
          {tag}
        </Badge>
      )}
      {isLoading && elapsedSeconds >= 3 && (
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
              onCancel(node.id);
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        </span>
      )}
    </div>
  );
}
