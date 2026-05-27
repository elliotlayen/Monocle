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
import { cn } from "@/lib/utils";
import { useScanExport } from "../hooks/use-scan-export";
import type { ScanSummary } from "../types";

export interface ScanResultsHeaderProps {
  result: ScanSummary;
  showIssuesOnly: boolean;
  onToggleFilter: () => void;
}

export function ScanResultsHeader({
  result,
  showIssuesOnly,
  onToggleFilter,
}: ScanResultsHeaderProps) {
  const {
    exportCsv,
    exportJson,
    exportPdf,
    exportClipboardText,
    exportClipboardMarkdown,
  } = useScanExport();

  const folderName = result.folderPath.split(/[/\\]/).pop() ?? result.folderPath;

  return (
    <div className="flex items-center gap-2 px-4 h-10 border-b bg-muted/50">
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
          {result.totalFiles} files, {result.totalErrors} errors, {result.totalWarnings} warnings
        </span>
      </div>

      {/* Right section */}
      <Separator orientation="vertical" className="h-5" />

      {/* Filter toggle (D-14) */}
      <Button
        variant="ghost"
        size="sm"
        className={cn("h-7 px-2", showIssuesOnly && "bg-accent")}
        onClick={onToggleFilter}
      >
        <Filter className="h-3.5 w-3.5 mr-1" />
        <span className="text-xs">Issues only</span>
      </Button>

      {/* Export dropdown (D-16) */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 px-2">
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
