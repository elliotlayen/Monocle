import {
  TreePine,
  Code,
  Copy,
  ClipboardCopy,
  ChevronsDownUp,
  ChevronsUpDown,
  WrapText,
} from "lucide-react";
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

interface FileContentActionsProps {
  tab: FileTab;
  isFormatted?: boolean;
  onToggleFormat?: () => void;
  onExpandAll?: () => void;
  onCollapseAll?: () => void;
}

/**
 * Compact action cluster for the active file, rendered on the breadcrumb
 * line (the file name already lives in the tab and the breadcrumbs).
 */
export function FileContentActions({
  tab,
  isFormatted,
  onToggleFormat,
  onExpandAll,
  onCollapseAll,
}: FileContentActionsProps) {
  const setViewMode = useExplorerStore((state) => state.setViewMode);
  const { copyPath, copyContent } = useFileActions();

  const fileSizeDisplay = tab.isLoading ? "--" : formatFileSize(tab.fileSize);

  return (
    <TooltipProvider>
      <div className="flex items-center gap-1">
        <span className="mr-1 flex-shrink-0 text-[10.5px] text-muted-foreground">
          {fileSizeDisplay}
        </span>

        {/* Format XML toggle -- visible for XML files, disabled in tree view
            and for large source-only files */}
        {tab.isXml && onToggleFormat && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "h-6 w-6",
                  isFormatted && tab.viewMode === "source" && "bg-accent",
                  (tab.viewMode !== "source" || tab.sourceOnly) &&
                    "opacity-40 cursor-not-allowed"
                )}
                onClick={
                  tab.viewMode === "source" && !tab.sourceOnly
                    ? onToggleFormat
                    : undefined
                }
                disabled={tab.viewMode !== "source" || tab.sourceOnly}
              >
                <WrapText className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>
                {tab.sourceOnly
                  ? "Formatting is disabled for large files"
                  : tab.viewMode !== "source"
                    ? "Format XML (source view only)"
                    : isFormatted
                      ? "Show raw XML"
                      : "Format XML (line numbers refer to original)"}
              </p>
            </TooltipContent>
          </Tooltip>
        )}

        {/* Expand/Collapse all */}
        {onExpandAll && onCollapseAll && (
          <div className="flex items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={onExpandAll}
                >
                  <ChevronsUpDown className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Expand all</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={onCollapseAll}
                >
                  <ChevronsDownUp className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Collapse all</p>
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        <Separator orientation="vertical" className="h-4" />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => copyPath(tab.filePath)}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Copy file path</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => copyContent(tab.content)}
            >
              <ClipboardCopy className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Copy raw content</p>
          </TooltipContent>
        </Tooltip>

        {/* Tree/Source toggle -- rightmost, only for XML files */}
        {tab.isXml && (
          <div
            className="ml-1 flex h-6 items-center rounded-md border bg-muted p-0.5"
            role="group"
            aria-label="View mode"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className={cn(
                    "flex h-full items-center gap-1 rounded-sm px-2 text-[11px] font-medium",
                    tab.viewMode === "tree"
                      ? "bg-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                    (tab.parseError || tab.sourceOnly) &&
                      tab.viewMode !== "tree" &&
                      "opacity-50 cursor-not-allowed"
                  )}
                  onClick={() => {
                    if (!tab.parseError && !tab.sourceOnly) {
                      setViewMode(tab.id, "tree");
                    }
                  }}
                  disabled={tab.parseError || tab.sourceOnly}
                  aria-pressed={tab.viewMode === "tree"}
                >
                  <TreePine className="h-3 w-3" />
                  Tree
                </button>
              </TooltipTrigger>
              {(tab.parseError || tab.sourceOnly) && (
                <TooltipContent>
                  <p>
                    {tab.sourceOnly
                      ? "Tree view is disabled for large files"
                      : "Unable to parse XML"}
                  </p>
                </TooltipContent>
              )}
            </Tooltip>
            <button
              className={cn(
                "flex h-full items-center gap-1 rounded-sm px-2 text-[11px] font-medium",
                tab.viewMode === "source"
                  ? "bg-background shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setViewMode(tab.id, "source")}
              aria-pressed={tab.viewMode === "source"}
            >
              <Code className="h-3 w-3" />
              Source
            </button>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
