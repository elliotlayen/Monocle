import { FileSearch, Filter, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useScanExport } from "../hooks/use-scan-export";

export interface ScanResultsHeaderProps {
  folderPath: string;
  totalFiles: number;
  totalErrors: number;
  totalWarnings: number;
  showIssuesOnly: boolean;
  onToggleFilter: () => void;
  /** Exports are disabled while the scan is still streaming results. */
  exportsEnabled: boolean;
}

export function ScanResultsHeader({
  folderPath,
  totalFiles,
  totalErrors,
  totalWarnings,
  showIssuesOnly,
  onToggleFilter,
  exportsEnabled,
}: ScanResultsHeaderProps) {
  const {
    exportCsv,
    exportJson,
    exportPdf,
    exportClipboardText,
    exportClipboardMarkdown,
  } = useScanExport();

  const folderName = folderPath.split(/[/\\]/).pop() ?? folderPath;

  return (
    <div className="flex h-9 items-center gap-2 border-b bg-muted/40 px-3">
      {/* Left section */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <FileSearch className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        <span className="text-sm font-semibold truncate">
          Scan Results
        </span>
        <span className="text-xs text-muted-foreground flex-shrink-0">
          {folderName}
        </span>
        <span className="text-xs text-muted-foreground flex-shrink-0">
          {totalFiles} files, {totalErrors} errors, {totalWarnings} warnings
        </span>
      </div>

      {/* Right section */}
      <Separator orientation="vertical" className="h-5" />

      {/* Filter toggle (D-14) */}
      <Button
        variant={showIssuesOnly ? "default" : "ghost"}
        size="sm"
        className="h-7 px-2"
        onClick={onToggleFilter}
      >
        <Filter className="h-3.5 w-3.5 mr-1" />
        <span className="text-xs">Issues only</span>
      </Button>

      {/* Export dropdown (D-16) */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2"
            disabled={!exportsEnabled}
          >
            <Download className="h-3.5 w-3.5 mr-1" />
            <span className="text-xs">Export</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => exportCsv()}>
            CSV (.csv)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => exportPdf()}>
            PDF (.pdf)
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => exportJson()}>
            JSON (.json)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => exportClipboardText()}>
            Copy as Text
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => exportClipboardMarkdown()}>
            Copy as Markdown
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
