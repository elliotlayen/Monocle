import { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  CircleAlert,
  TriangleAlert,
  CircleCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScanFileResult } from "../types";

export interface ScanFileRowProps {
  file: ScanFileResult;
  scanRoot: string;
  onFileClick: (filePath: string) => void;
}

export function ScanFileRow({ file, onFileClick }: ScanFileRowProps) {
  const [expanded, setExpanded] = useState(false);

  const errorCount = file.problems.filter(
    (p) => p.severity === "error"
  ).length;
  const warningCount = file.problems.filter(
    (p) => p.severity === "warning"
  ).length;

  const hasProblems = file.problems.length > 0;

  const handleToggle = () => {
    if (hasProblems) {
      setExpanded((prev) => !prev);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleToggle();
    }
  };

  const handleDoubleClick = () => {
    onFileClick(file.filePath);
  };

  const statusIcon =
    file.status === "error" ? (
      <CircleAlert className="h-4 w-4 flex-shrink-0 text-red-500 dark:text-red-400" />
    ) : file.status === "warning" ? (
      <TriangleAlert className="h-4 w-4 flex-shrink-0 text-amber-500 dark:text-amber-400" />
    ) : (
      <CircleCheck className="h-4 w-4 flex-shrink-0 text-green-500 dark:text-green-400" />
    );

  return (
    <div role="row">
      <div
        className="flex items-center gap-2 px-4 py-1.5 hover:bg-accent cursor-pointer text-sm"
        onClick={handleToggle}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="row"
        aria-expanded={hasProblems ? expanded : undefined}
      >
        {hasProblems ? (
          expanded ? (
            <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
          )
        ) : (
          <span className="w-3.5 flex-shrink-0" />
        )}
        {statusIcon}
        <span className="text-sm font-semibold truncate">{file.fileName}</span>
        <span className="text-xs text-muted-foreground truncate">
          {file.relativePath}
        </span>
        <span className="flex-1" />
        {errorCount > 0 && (
          <span className="text-xs text-red-500 dark:text-red-400 flex-shrink-0">
            {errorCount} errors
          </span>
        )}
        {warningCount > 0 && (
          <span className="text-xs text-amber-500 dark:text-amber-400 flex-shrink-0">
            {warningCount} warnings
          </span>
        )}
        <span className="text-xs text-muted-foreground flex-shrink-0">
          {file.encoding}
        </span>
      </div>

      {expanded &&
        file.problems.map((problem, index) => (
          <div
            key={`${problem.line}:${problem.column}:${index}`}
            className="flex items-center gap-2 px-4 py-1.5 hover:bg-accent cursor-pointer text-sm pl-12"
          >
            {problem.severity === "error" ? (
              <CircleAlert
                className={cn(
                  "h-4 w-4 flex-shrink-0",
                  "text-red-500 dark:text-red-400"
                )}
              />
            ) : (
              <TriangleAlert
                className={cn(
                  "h-4 w-4 flex-shrink-0",
                  "text-amber-500 dark:text-amber-400"
                )}
              />
            )}
            <span className="text-xs text-muted-foreground font-mono flex-shrink-0 w-14 text-right">
              {problem.line}:{problem.column}
            </span>
            <span className="text-sm truncate">{problem.message}</span>
          </div>
        ))}
    </div>
  );
}
