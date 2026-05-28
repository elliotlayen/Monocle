import { useMemo } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SearchProgress } from "./search-progress";
import { SearchResultGroup } from "./search-result-group";
import type {
  SearchResultFile,
  SearchErrorFile,
  SearchSummary,
  SearchProgressPayload,
  SearchStatus,
} from "../types";

interface SearchResultsProps {
  results: SearchResultFile[];
  errors: SearchErrorFile[];
  summary: SearchSummary | null;
  progress: SearchProgressPayload | null;
  status: SearchStatus;
  scopeLabel: string;
  searchQuery: string;
  onCancel: () => void;
  onClear: () => void;
  onFileClick: (filePath: string) => void;
}

export function SearchResults({
  results,
  errors,
  summary,
  progress,
  status,
  scopeLabel,
  searchQuery,
  onCancel,
  onClear,
  onFileClick,
}: SearchResultsProps) {
  // Group results by parentFolder
  const groupedResults = useMemo(() => {
    const groups = new Map<string, SearchResultFile[]>();
    for (const file of results) {
      const existing = groups.get(file.parentFolder);
      if (existing) {
        existing.push(file);
      } else {
        groups.set(file.parentFolder, [file]);
      }
    }
    return groups;
  }, [results]);

  // Summary header stats
  const summaryText = (() => {
    if (status === "searching") {
      const scanned = progress?.filesScanned ?? 0;
      return `${scanned} files scanned`;
    }
    const totalFiles = summary?.totalFilesMatched ?? results.length;
    const totalMatches = summary?.totalMatches ?? results.reduce((sum, r) => sum + r.matchCount, 0);
    const stoppedSuffix = status === "cancelled" ? " (stopped)" : "";
    return `${totalFiles} ${totalFiles === 1 ? "file" : "files"}, ${totalMatches} ${totalMatches === 1 ? "match" : "matches"} in ${scopeLabel}${stoppedSuffix}`;
  })();

  const isCompleteEmpty =
    (status === "completed" || status === "cancelled") &&
    results.length === 0 &&
    errors.length === 0;

  return (
    <div
      className="flex flex-col flex-1 min-h-0"
      role="region"
      aria-label="Search results"
      aria-live="polite"
    >
      {/* Summary header */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30 flex-shrink-0">
        <span className="text-xs text-muted-foreground flex-1">
          {summaryText}
        </span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={onClear}
              >
                <X className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Clear search</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Progress indicator during search */}
      {status === "searching" && (
        <SearchProgress progress={progress} onCancel={onCancel} />
      )}

      {/* No results message */}
      {isCompleteEmpty && (
        <div className="flex flex-col items-center justify-center py-12 px-8">
          <p className="text-sm font-semibold text-muted-foreground mb-1">
            No matches found
          </p>
          <p className="text-sm text-muted-foreground text-center">
            No files matched &quot;{searchQuery}&quot; in {scopeLabel}
          </p>
        </div>
      )}

      {/* Grouped results */}
      {(results.length > 0 || errors.length > 0) && (
        <ScrollArea className="flex-1">
          <div className="py-1">
            {/* Normal result groups */}
            {Array.from(groupedResults.entries()).map(
              ([folderPath, files]) => (
                <SearchResultGroup
                  key={folderPath}
                  folderPath={folderPath}
                  files={files}
                  defaultExpanded
                  onFileClick={onFileClick}
                />
              )
            )}

            {/* Error group (rendered last, collapsed by default) */}
            {errors.length > 0 && (
              <SearchResultGroup
                folderPath="errors"
                files={[]}
                errorFiles={errors}
                defaultExpanded={false}
                onFileClick={onFileClick}
                isError
              />
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
