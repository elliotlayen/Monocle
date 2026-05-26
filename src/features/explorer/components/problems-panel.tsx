import { ChevronDown, ChevronRight, CircleDot, AlertTriangle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProblemRow } from "./problem-row";
import type { ValidationProblem } from "../types";

export interface ProblemsPanelProps {
  problems: ValidationProblem[];
  isOpen: boolean;
  onToggle: () => void;
  onProblemClick: (line: number, column: number) => void;
}

export function ProblemsPanel({
  problems,
  isOpen,
  onToggle,
  onProblemClick,
}: ProblemsPanelProps) {
  const errorCount = problems.filter((p) => p.severity === "error").length;
  const warningCount = problems.filter((p) => p.severity === "warning").length;

  const sortedProblems = [...problems].sort((a, b) => {
    if (a.line !== b.line) return a.line - b.line;
    return a.column - b.column;
  });

  const headerTitle =
    problems.length > 0 ? `Problems (${problems.length})` : "Problems";

  return (
    <div
      className="flex flex-col border-t"
      role="region"
      aria-label="Problems panel"
    >
      {/* Header bar -- always visible */}
      <div
        className="flex items-center gap-2 px-4 h-8 bg-muted/50 cursor-pointer border-b"
        onClick={onToggle}
        role="button"
        aria-expanded={isOpen}
      >
        {isOpen ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
        )}
        <span className="text-sm font-semibold">{headerTitle}</span>
        <span className="flex-1" />
        {errorCount > 0 && (
          <span className="flex items-center gap-1">
            <CircleDot className="h-3 w-3 text-red-500 dark:text-red-400" />
            <span className="text-xs text-red-500 dark:text-red-400">
              {errorCount}
            </span>
          </span>
        )}
        {warningCount > 0 && (
          <span className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-amber-500 dark:text-amber-400" />
            <span className="text-xs text-amber-500 dark:text-amber-400">
              {warningCount}
            </span>
          </span>
        )}
      </div>

      {/* Body -- only when open */}
      {isOpen && (
        <ScrollArea className="flex-1 overflow-hidden">
          {sortedProblems.length > 0 ? (
            <div role="list">
              {sortedProblems.map((problem, index) => (
                <ProblemRow
                  key={`${problem.line}:${problem.column}:${index}`}
                  problem={problem}
                  onClick={onProblemClick}
                />
              ))}
            </div>
          ) : (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              No problems detected
            </div>
          )}
        </ScrollArea>
      )}
    </div>
  );
}
