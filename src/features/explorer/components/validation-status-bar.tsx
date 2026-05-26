import { CircleDot, AlertTriangle } from "lucide-react";

export interface ValidationStatusBarProps {
  errorCount: number;
  warningCount: number;
  encoding: string;
  onClick: () => void;
}

export function ValidationStatusBar({
  errorCount,
  warningCount,
  encoding,
  onClick,
}: ValidationStatusBarProps) {
  const errorLabel = errorCount === 1 ? "1 error" : `${errorCount} errors`;
  const warningLabel =
    warningCount === 1 ? "1 warning" : `${warningCount} warnings`;

  return (
    <div
      className="flex items-center gap-3 px-4 h-6 border-t bg-muted/30 text-xs cursor-pointer hover:bg-accent/50"
      onClick={onClick}
      role="status"
      aria-live="polite"
      aria-label={`Validation status: ${errorCount} errors, ${warningCount} warnings, encoding ${encoding}`}
    >
      <div className="flex items-center gap-3">
        {errorCount > 0 && (
          <span className="flex items-center gap-1">
            <CircleDot className="h-3 w-3 text-red-500 dark:text-red-400" />
            <span className="text-xs text-red-500 dark:text-red-400">
              {errorLabel}
            </span>
          </span>
        )}
        {warningCount > 0 && (
          <span className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 text-amber-500 dark:text-amber-400" />
            <span className="text-xs text-amber-500 dark:text-amber-400">
              {warningLabel}
            </span>
          </span>
        )}
        {errorCount === 0 && warningCount === 0 && (
          <span className="text-xs text-muted-foreground">No problems</span>
        )}
      </div>
      <span className="flex-1" />
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground">{encoding}</span>
      </div>
    </div>
  );
}
