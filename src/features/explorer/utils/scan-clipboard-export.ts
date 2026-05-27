import type { ScanSummary } from "../types";

export function formatScanAsText(result: ScanSummary): string {
  const lines: string[] = [];

  lines.push(`Scan Report - ${result.folderPath}`);
  lines.push(
    `Pattern: ${result.filePattern} | Date: ${new Date().toISOString()}`
  );
  lines.push("");
  lines.push(
    `Summary: ${result.totalFiles} files scanned, ${result.totalErrors} errors, ${result.totalWarnings} warnings, ${result.cleanFiles} clean`
  );
  lines.push("");

  for (const file of result.files) {
    if (file.status === "clean") continue;

    const errorCount = file.problems.filter(
      (p) => p.severity === "error"
    ).length;
    const warningCount = file.problems.filter(
      (p) => p.severity === "warning"
    ).length;

    const icon =
      file.status === "error" ? "[ERROR]" : "[WARN]";

    lines.push(
      `  ${icon} ${file.relativePath} - ${errorCount} errors, ${warningCount} warnings`
    );
  }

  return lines.join("\n");
}

export function formatScanAsMarkdown(result: ScanSummary): string {
  const lines: string[] = [];

  lines.push("# Scan Report");
  lines.push("");
  lines.push(`- **Folder:** ${result.folderPath}`);
  lines.push(`- **Pattern:** ${result.filePattern}`);
  lines.push(`- **Date:** ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- **Total Files:** ${result.totalFiles}`);
  lines.push(`- **Errors:** ${result.totalErrors}`);
  lines.push(`- **Warnings:** ${result.totalWarnings}`);
  lines.push(`- **Clean:** ${result.cleanFiles}`);
  lines.push("");
  lines.push("## Results");
  lines.push("");
  lines.push("| File | Status | Errors | Warnings | Encoding |");
  lines.push("| --- | --- | --- | --- | --- |");

  for (const file of result.files) {
    const errorCount = file.problems.filter(
      (p) => p.severity === "error"
    ).length;
    const warningCount = file.problems.filter(
      (p) => p.severity === "warning"
    ).length;

    let statusBadge: string;
    if (file.status === "error") {
      statusBadge = "Error";
    } else if (file.status === "warning") {
      statusBadge = "Warning";
    } else {
      statusBadge = "Clean";
    }

    lines.push(
      `| ${file.relativePath} | ${statusBadge} | ${errorCount} | ${warningCount} | ${file.encoding} |`
    );
  }

  return lines.join("\n");
}
