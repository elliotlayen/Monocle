import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Folder,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { parseSearchTermsFrontend } from "../store";
import { SearchProgress } from "./search-progress";
import { SearchResultRow } from "./search-result-row";
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
  onSnippetClick: (filePath: string, line: number) => void;
  /** Folder path -> display label (e.g. relative to its source root). */
  getGroupLabel: (folderPath: string) => string;
}

/** Snippet lines shown per matched file before the "+N more" row. */
const MAX_SNIPPETS_SHOWN = 3;

type SearchVirtualRow =
  | {
      type: "group";
      key: string;
      folderPath: string;
      label: string;
      fileCount: number;
      isError: boolean;
      expanded: boolean;
    }
  | {
      type: "result";
      key: string;
      file: SearchResultFile;
    }
  | {
      type: "snippet";
      key: string;
      filePath: string;
      line: number;
      text: string;
    }
  | {
      type: "more";
      key: string;
      filePath: string;
      remaining: number;
    }
  | {
      type: "error";
      key: string;
      file: SearchErrorFile;
    };

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightTerms(text: string, terms: string[]): React.ReactNode {
  const usable = terms.filter((t) => t.length > 0);
  if (usable.length === 0) return text;
  const pattern = new RegExp(`(${usable.map(escapeRegExp).join("|")})`, "gi");
  const parts = text.split(pattern);
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <span key={i} className="rounded-sm bg-accent-blue/25 text-foreground">
        {part}
      </span>
    ) : (
      part
    )
  );
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
  onSnippetClick,
  getGroupLabel,
}: SearchResultsProps) {
  const [expandedOverrides, setExpandedOverrides] = useState<
    Map<string, boolean>
  >(new Map());
  const scrollParentRef = useRef<HTMLDivElement | null>(null);

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

  const virtualRows = useMemo<SearchVirtualRow[]>(() => {
    const rows: SearchVirtualRow[] = [];
    for (const [folderPath, files] of groupedResults.entries()) {
      const expanded = expandedOverrides.get(folderPath) ?? true;
      rows.push({
        type: "group",
        key: `group:${folderPath}`,
        folderPath,
        label: getGroupLabel(folderPath),
        fileCount: files.length,
        isError: false,
        expanded,
      });
      if (expanded) {
        for (const file of files) {
          rows.push({
            type: "result",
            key: `result:${file.filePath}`,
            file,
          });
          const previews = file.matches ?? [];
          for (const match of previews.slice(0, MAX_SNIPPETS_SHOWN)) {
            rows.push({
              type: "snippet",
              key: `snippet:${file.filePath}:${match.line}`,
              filePath: file.filePath,
              line: match.line,
              text: match.text,
            });
          }
          const shown = Math.min(previews.length, MAX_SNIPPETS_SHOWN);
          if (file.matchCount > shown) {
            rows.push({
              type: "more",
              key: `more:${file.filePath}`,
              filePath: file.filePath,
              remaining: file.matchCount - shown,
            });
          }
        }
      }
    }

    if (errors.length > 0) {
      const folderPath = "errors";
      const expanded = expandedOverrides.get(folderPath) ?? false;
      rows.push({
        type: "group",
        key: "group:errors",
        folderPath,
        label: `Errors (${errors.length} ${errors.length === 1 ? "file" : "files"})`,
        fileCount: errors.length,
        isError: true,
        expanded,
      });
      if (expanded) {
        for (const file of errors) {
          rows.push({
            type: "error",
            key: `error:${file.filePath}`,
            file,
          });
        }
      }
    }

    return rows;
  }, [groupedResults, errors, expandedOverrides, getGroupLabel]);

  const searchTerms = useMemo(
    () => parseSearchTermsFrontend(searchQuery),
    [searchQuery]
  );

  const rowVirtualizer = useVirtualizer({
    count: virtualRows.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => 28,
    overscan: 8,
    getItemKey: (index) => virtualRows[index]?.key ?? index,
  });

  const toggleGroup = (folderPath: string) => {
    setExpandedOverrides((prev) => {
      const next = new Map(prev);
      const defaultExpanded = folderPath !== "errors";
      next.set(folderPath, !(prev.get(folderPath) ?? defaultExpanded));
      return next;
    });
  };

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
        <div ref={scrollParentRef} className="flex-1 overflow-auto">
          <div
            className="relative py-1"
            style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const row = virtualRows[virtualRow.index];
              if (!row) return null;

              return (
                <div
                  key={virtualRow.key}
                  ref={rowVirtualizer.measureElement}
                  data-index={virtualRow.index}
                  className="absolute left-0 top-0 w-full"
                  style={{
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  {row.type === "group" ? (
                    <div
                      className="flex items-center gap-2 px-4 py-1 cursor-pointer hover:bg-accent/50"
                      onClick={() => toggleGroup(row.folderPath)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          toggleGroup(row.folderPath);
                        }
                      }}
                      aria-expanded={row.expanded}
                    >
                      {row.expanded ? (
                        <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                      )}
                      {row.isError ? (
                        <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 text-destructive" />
                      ) : (
                        <Folder className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                      )}
                      <span
                        className={`text-xs font-semibold truncate ${
                          row.isError ? "text-destructive" : ""
                        }`}
                      >
                        {row.label}
                      </span>
                      <span className="flex-1" />
                      {!row.isError && (
                        <span className="text-xs text-muted-foreground">
                          {row.fileCount}{" "}
                          {row.fileCount === 1 ? "file" : "files"}
                        </span>
                      )}
                    </div>
                  ) : row.type === "snippet" ? (
                    <button
                      type="button"
                      className="flex w-full items-baseline gap-2 py-0.5 pl-12 pr-4 text-left hover:bg-muted"
                      onClick={() => onSnippetClick(row.filePath, row.line)}
                    >
                      <span className="w-8 flex-shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
                        {row.line}
                      </span>
                      <span className="truncate font-mono text-xs text-muted-foreground">
                        {highlightTerms(row.text.trimStart(), searchTerms)}
                      </span>
                    </button>
                  ) : row.type === "more" ? (
                    <button
                      type="button"
                      className="w-full py-0.5 pl-[5.5rem] pr-4 text-left text-[10px] text-muted-foreground hover:bg-muted"
                      onClick={() => onFileClick(row.filePath)}
                    >
                      +{row.remaining} more{" "}
                      {row.remaining === 1 ? "match" : "matches"}
                    </button>
                  ) : (
                    <SearchResultRow
                      file={row.file}
                      onClick={() => onFileClick(row.file.filePath)}
                      isError={row.type === "error"}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
