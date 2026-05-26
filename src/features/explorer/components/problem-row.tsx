import { CircleAlert, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ValidationProblem } from "../types";

export interface ProblemRowProps {
  problem: ValidationProblem;
  onClick: (line: number, column: number) => void;
}

export function ProblemRow({ problem, onClick }: ProblemRowProps) {
  const handleClick = () => {
    onClick(problem.line, problem.column);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick(problem.line, problem.column);
    }
  };

  const isError = problem.severity === "error";

  return (
    <div
      className="flex items-center gap-2 px-4 py-1.5 hover:bg-accent cursor-pointer text-sm"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="listitem"
    >
      {isError ? (
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
  );
}
