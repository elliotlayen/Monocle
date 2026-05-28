import { FileText, AlertCircle } from "lucide-react";
import type { SearchResultFile, SearchErrorFile } from "../types";

interface SearchResultRowProps {
  file: SearchResultFile | SearchErrorFile;
  onClick: () => void;
  isError?: boolean;
}

export function SearchResultRow({ file, onClick, isError }: SearchResultRowProps) {
  if (isError) {
    const errorFile = file as SearchErrorFile;
    return (
      <div
        className="flex items-center gap-2 px-4 py-1 pl-8 cursor-pointer hover:bg-accent text-sm"
        onClick={onClick}
        role="button"
        aria-label={`${errorFile.fileName}, error: ${errorFile.errorMessage}`}
      >
        <AlertCircle className="h-4 w-4 flex-shrink-0 text-destructive" />
        <span className="truncate">{errorFile.fileName}</span>
        <span className="text-xs text-destructive truncate">
          {errorFile.errorMessage}
        </span>
      </div>
    );
  }

  const resultFile = file as SearchResultFile;
  const matchLabel =
    resultFile.matchCount === 1 ? "1 match" : `${resultFile.matchCount} matches`;

  return (
    <div
      className="flex items-center gap-2 px-4 py-1 pl-8 cursor-pointer hover:bg-accent text-sm"
      onClick={onClick}
      role="button"
      aria-label={`${resultFile.fileName}, ${matchLabel}`}
    >
      <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
      <span className="truncate flex-1">{resultFile.fileName}</span>
      <span className="text-xs text-muted-foreground flex-shrink-0">
        {matchLabel}
      </span>
    </div>
  );
}
