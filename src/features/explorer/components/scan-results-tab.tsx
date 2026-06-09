import { useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useShallow } from "zustand/shallow";
import {
  ChevronUp,
  ChevronDown,
  FolderOpen,
  CircleAlert,
  TriangleAlert,
  CircleCheck,
} from "lucide-react";
import { useExplorerStore } from "../store";
import { ScanResultsHeader } from "./scan-results-header";
import { ScanFileRow } from "./scan-file-row";
import type { ScanFileResult } from "../types";

type SortField = "file" | "status" | "errors" | "warnings" | "encoding";
type SortDirection = "asc" | "desc";

const statusOrder: Record<string, number> = {
  error: 0,
  warning: 1,
  clean: 2,
};

function sortFiles(
  files: ScanFileResult[],
  field: SortField,
  direction: SortDirection
): ScanFileResult[] {
  const sorted = [...files].sort((a, b) => {
    let cmp = 0;
    switch (field) {
      case "file":
        cmp = a.fileName.localeCompare(b.fileName);
        break;
      case "status":
        cmp = (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3);
        break;
      case "errors": {
        const aErrors = a.problems.filter((p) => p.severity === "error").length;
        const bErrors = b.problems.filter((p) => p.severity === "error").length;
        cmp = aErrors - bErrors;
        break;
      }
      case "warnings": {
        const aWarns = a.problems.filter((p) => p.severity === "warning").length;
        const bWarns = b.problems.filter((p) => p.severity === "warning").length;
        cmp = aWarns - bWarns;
        break;
      }
      case "encoding":
        cmp = a.encoding.localeCompare(b.encoding);
        break;
    }
    return direction === "asc" ? cmp : -cmp;
  });
  return sorted;
}

function ColumnHeader({
  label,
  field,
  activeField,
  direction,
  onSort,
  className,
}: {
  label: string;
  field: SortField;
  activeField: SortField;
  direction: SortDirection;
  onSort: (field: SortField) => void;
  className?: string;
}) {
  const isActive = activeField === field;
  return (
    <button
      className={`flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground ${className ?? ""}`}
      onClick={() => onSort(field)}
    >
      {label}
      {isActive &&
        (direction === "asc" ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        ))}
    </button>
  );
}

export function ScanResultsTab() {
  const { scanResult, openFile } = useExplorerStore(
    useShallow((state) => ({
      scanResult: state.scanResult,
      openFile: state.openFile,
    }))
  );

  const [sortField, setSortField] = useState<SortField>("status");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [showIssuesOnly, setShowIssuesOnly] = useState(false);
  const scrollParentRef = useRef<HTMLDivElement | null>(null);

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const filteredAndSorted = useMemo(() => {
    if (!scanResult) return [];
    let files = scanResult.files;
    if (showIssuesOnly) {
      files = files.filter((f) => f.status !== "clean");
    }
    return sortFiles(files, sortField, sortDirection);
  }, [scanResult, showIssuesOnly, sortField, sortDirection]);

  const rowVirtualizer = useVirtualizer({
    count: filteredAndSorted.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => 36,
    overscan: 10,
    getItemKey: (index) => filteredAndSorted[index]?.filePath ?? index,
  });

  if (!scanResult) return null;

  const handleFileClick = (filePath: string) => {
    openFile(filePath);
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <ScanResultsHeader
        result={scanResult}
        showIssuesOnly={showIssuesOnly}
        onToggleFilter={() => setShowIssuesOnly((prev) => !prev)}
      />

      {/* Summary stat cards */}
      <div className="flex items-center gap-4 px-4 py-2 border-b">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <FolderOpen className="h-3.5 w-3.5" />
          <span className="font-medium">{scanResult.totalFiles}</span> files
        </div>
        <div className="flex items-center gap-1.5 text-xs text-red-500 dark:text-red-400">
          <CircleAlert className="h-3.5 w-3.5" />
          <span className="font-medium">{scanResult.totalErrors}</span> errors
        </div>
        <div className="flex items-center gap-1.5 text-xs text-amber-500 dark:text-amber-400">
          <TriangleAlert className="h-3.5 w-3.5" />
          <span className="font-medium">{scanResult.totalWarnings}</span> warnings
        </div>
        <div className="flex items-center gap-1.5 text-xs text-green-500 dark:text-green-400">
          <CircleCheck className="h-3.5 w-3.5" />
          <span className="font-medium">{scanResult.cleanFiles}</span> clean
        </div>
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-2 px-4 py-1 border-b bg-muted/30">
        {/* Spacer for chevron + icon */}
        <span className="w-3.5 flex-shrink-0" />
        <span className="w-4 flex-shrink-0" />
        <ColumnHeader
          label="File"
          field="file"
          activeField={sortField}
          direction={sortDirection}
          onSort={handleSort}
          className="flex-1 min-w-0"
        />
        <ColumnHeader
          label="Status"
          field="status"
          activeField={sortField}
          direction={sortDirection}
          onSort={handleSort}
        />
        <ColumnHeader
          label="Errors"
          field="errors"
          activeField={sortField}
          direction={sortDirection}
          onSort={handleSort}
        />
        <ColumnHeader
          label="Warnings"
          field="warnings"
          activeField={sortField}
          direction={sortDirection}
          onSort={handleSort}
        />
        <ColumnHeader
          label="Encoding"
          field="encoding"
          activeField={sortField}
          direction={sortDirection}
          onSort={handleSort}
        />
      </div>

      {/* File list */}
      <div ref={scrollParentRef} className="flex-1 overflow-auto">
        <div
          className="relative"
          role="table"
          aria-label="Scan results"
          style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const file = filteredAndSorted[virtualRow.index];
            if (!file) return null;

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
                <ScanFileRow
                  file={file}
                  scanRoot={scanResult.folderPath}
                  onFileClick={handleFileClick}
                />
              </div>
            );
          })}
          {filteredAndSorted.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {showIssuesOnly
                ? "No issues found -- all files are clean"
              : "No files in scan results"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
