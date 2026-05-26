import { FileCode, FileText, Loader2, X } from "lucide-react";
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
import { useFileActions } from "../hooks/use-file-actions";
import type { FileTab as FileTabType } from "../types";

interface FileTabProps {
  tab: FileTabType;
  isActive: boolean;
  onActivate: () => void;
  onClose: () => void;
  onCloseOthers: () => void;
  onCloseAll: () => void;
}

export function FileTab({
  tab,
  isActive,
  onActivate,
  onClose,
  onCloseOthers,
  onCloseAll,
}: FileTabProps) {
  const { copyPath, copyContent, openExternal, saveCopy } = useFileActions();

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  const handleMiddleClick = (e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault();
      onClose();
    }
  };

  const renderIcon = () => {
    if (tab.isLoading) {
      return <Loader2 className="h-3.5 w-3.5 flex-shrink-0 animate-spin" />;
    }
    if (tab.isXml) {
      return <FileCode className="h-3.5 w-3.5 flex-shrink-0" />;
    }
    return <FileText className="h-3.5 w-3.5 flex-shrink-0" />;
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            "group flex items-center gap-1.5 px-4 h-full text-sm border-r border-border cursor-pointer whitespace-nowrap select-none",
            isActive
              ? "bg-background border-b-2 border-b-primary"
              : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          )}
          onClick={onActivate}
          onMouseDown={handleMiddleClick}
        >
          {renderIcon()}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-sm truncate max-w-[160px]">
                  {tab.fileName}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>{tab.filePath}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <button
            className={cn(
              "h-5 w-5 rounded-sm flex items-center justify-center hover:bg-muted-foreground/20",
              isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
            onClick={handleClose}
            aria-label={`Close ${tab.fileName}`}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={onClose}>Close</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onCloseOthers}>Close Others</ContextMenuItem>
        <ContextMenuItem onClick={onCloseAll}>Close All</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => copyPath(tab.filePath)}>Copy Path</ContextMenuItem>
        <ContextMenuItem onClick={() => openExternal(tab.filePath)}>Open in External Editor</ContextMenuItem>
        <ContextMenuItem onClick={() => copyContent(tab.content)} disabled={tab.isLoading}>Copy Content</ContextMenuItem>
        <ContextMenuItem onClick={() => saveCopy(tab.fileName, tab.content)} disabled={tab.isLoading}>Save Copy...</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
