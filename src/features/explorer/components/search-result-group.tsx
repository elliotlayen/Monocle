import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  AlertCircle,
} from "lucide-react";
import { SearchResultRow } from "./search-result-row";
import type { SearchResultFile, SearchErrorFile } from "../types";

interface SearchResultGroupProps {
  folderPath: string;
  files: SearchResultFile[];
  defaultExpanded: boolean;
  onFileClick: (filePath: string) => void;
  isError?: boolean;
  errorFiles?: SearchErrorFile[];
}

export function SearchResultGroup({
  folderPath,
  files,
  defaultExpanded,
  onFileClick,
  isError,
  errorFiles,
}: SearchResultGroupProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  // Extract folder name from path
  const folderName = folderPath.split(/[/\\]/).pop() ?? folderPath;

  const fileCount = isError ? (errorFiles?.length ?? 0) : files.length;
  const headerLabel = isError
    ? `Errors (${fileCount} ${fileCount === 1 ? "file" : "files"})`
    : folderName;

  // Sort files alphabetically by fileName (D-20)
  const sortedFiles = [...files].sort((a, b) =>
    a.fileName.localeCompare(b.fileName)
  );
  const sortedErrors = errorFiles
    ? [...errorFiles].sort((a, b) => a.fileName.localeCompare(b.fileName))
    : [];

  return (
    <div role="group" aria-label={folderPath}>
      {/* Group header */}
      <div
        className="flex items-center gap-2 px-4 py-1 cursor-pointer hover:bg-accent/50"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
      >
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
        )}
        {isError ? (
          <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 text-destructive" />
        ) : (
          <Folder className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
        )}
        <span
          className={`text-xs font-semibold truncate ${
            isError ? "text-destructive" : ""
          }`}
        >
          {headerLabel}
        </span>
        <span className="flex-1" />
        {!isError && (
          <span className="text-xs text-muted-foreground">
            {fileCount} {fileCount === 1 ? "file" : "files"}
          </span>
        )}
      </div>

      {/* Children */}
      {expanded && (
        <div>
          {isError
            ? sortedErrors.map((file) => (
                <SearchResultRow
                  key={file.filePath}
                  file={file}
                  onClick={() => onFileClick(file.filePath)}
                  isError
                />
              ))
            : sortedFiles.map((file) => (
                <SearchResultRow
                  key={file.filePath}
                  file={file}
                  onClick={() => onFileClick(file.filePath)}
                />
              ))}
        </div>
      )}
    </div>
  );
}
