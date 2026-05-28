import { FileCode, FileText, TreePine, Code, Copy, ClipboardCopy, ChevronsDownUp, ChevronsUpDown, WrapText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useExplorerStore } from "../store";
import { useFileActions } from "../hooks/use-file-actions";
import { formatFileSize } from "../utils/file-size-format";
import type { FileTab } from "../types";

interface FileContentHeaderProps {
  tab: FileTab;
  isFormatted?: boolean;
  onToggleFormat?: () => void;
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
}

export function FileContentHeader({ tab, isFormatted, onToggleFormat, onExpandAll, onCollapseAll }: FileContentHeaderProps) {
  const setViewMode = useExplorerStore((state) => state.setViewMode);
  const { copyPath, copyContent } = useFileActions();

  const fileIcon = tab.isXml ? (
    <FileCode className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
  ) : (
    <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
  );

  const fileSizeDisplay = tab.isLoading
    ? "--"
    : formatFileSize(tab.fileSize);

  return (
    <div className="flex items-center gap-2 px-4 h-10 border-b bg-muted/50">
      {/* Left section */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {fileIcon}
        <span className="text-sm font-semibold truncate">{tab.fileName}</span>
        <span className="text-xs text-muted-foreground flex-shrink-0 ml-1">
          {fileSizeDisplay}
        </span>
      </div>

      {/* Format XML toggle -- visible for XML files, disabled in tree view */}
      {tab.isXml && onToggleFormat && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-7 w-7",
                  isFormatted && tab.viewMode === "source" && "bg-accent",
                  tab.viewMode !== "source" && "opacity-40 cursor-not-allowed"
                )}
                onClick={tab.viewMode === "source" ? onToggleFormat : undefined}
                disabled={tab.viewMode !== "source"}
              >
                <WrapText className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{tab.viewMode !== "source" ? "Format XML (source view only)" : isFormatted ? "Show raw XML" : "Format XML (line numbers refer to original)"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}

      {/* Expand/Collapse all -- only when tree view is active */}
      {onExpandAll && onCollapseAll && (
        <div className="flex items-center gap-0.5">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onExpandAll}>
                  <ChevronsUpDown className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Expand all</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onCollapseAll}>
                  <ChevronsDownUp className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Collapse all</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      )}

      {/* Action buttons */}
      <Separator orientation="vertical" className="h-5" />
      <div className="flex items-center gap-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyPath(tab.filePath)}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Copy file path</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyContent(tab.content)}>
                <ClipboardCopy className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Copy raw content</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Tree/Source toggle -- rightmost, only for XML files */}
      {tab.isXml && (
        <div
          className="flex items-center h-7 rounded-md bg-muted border p-0.5"
          role="group"
          aria-label="View mode"
        >
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={cn(
                    "h-full px-2.5 flex items-center gap-1.5 text-xs font-medium rounded-sm",
                    tab.viewMode === "tree"
                      ? "bg-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                    tab.parseError && tab.viewMode !== "tree" && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={() => {
                    if (!tab.parseError) {
                      setViewMode(tab.id, "tree");
                    }
                  }}
                  disabled={tab.parseError}
                  aria-pressed={tab.viewMode === "tree"}
                >
                  <TreePine className="h-3.5 w-3.5" />
                  Tree
                </button>
              </TooltipTrigger>
              {tab.parseError && (
                <TooltipContent>
                  <p>Unable to parse XML</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
          <button
            className={cn(
              "h-full px-2.5 flex items-center gap-1.5 text-xs font-medium rounded-sm",
              tab.viewMode === "source"
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
            onClick={() => setViewMode(tab.id, "source")}
            aria-pressed={tab.viewMode === "source"}
          >
            <Code className="h-3.5 w-3.5" />
            Source
          </button>
        </div>
      )}
    </div>
  );
}
