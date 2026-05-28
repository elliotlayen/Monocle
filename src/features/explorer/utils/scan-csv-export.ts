import type { ScanSummary } from "../types";

export function escapeCsv(value: string): string {
  if (
    value.includes(",") ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function sanitizeCsvComment(value: string): string {
  return value.replace(/[\r\n]/g, " ");
}

export function exportScanToCsv(result: ScanSummary): string {
  const lines: string[] = [];

  // Metadata comments (D-21)
  lines.push("# Scan Report");
  lines.push(`# Folder: ${sanitizeCsvComment(result.folderPath)}`);
  lines.push(`# Pattern: ${sanitizeCsvComment(result.filePattern)}`);
  lines.push(`# Date: ${new Date().toISOString()}`);
  lines.push(`# Total Files: ${result.totalFiles}`);
  lines.push(`# Errors: ${result.totalErrors}`);
  lines.push(`# Warnings: ${result.totalWarnings}`);
  lines.push(`# Clean: ${result.cleanFiles}`);
  lines.push("");

  // Header row (D-17)
  lines.push("File Path,Line,Column,Severity,Issue Code,Description,Encoding");

  // Data rows
  for (const file of result.files) {
    if (file.problems.length === 0) {
      // Clean file: one row with Clean severity (D-17)
      lines.push(
        `${escapeCsv(file.filePath)},,,,Clean,,${escapeCsv(file.encoding)}`
      );
    } else {
      // One row per problem (D-17)
      for (const problem of file.problems) {
        lines.push(
          [
            escapeCsv(file.filePath),
            String(problem.line),
            String(problem.column),
            problem.severity,
            escapeCsv(problem.code),
            escapeCsv(problem.message),
            escapeCsv(file.encoding),
          ].join(",")
        );
      }
    }
  }

  return lines.join("\n");
}
