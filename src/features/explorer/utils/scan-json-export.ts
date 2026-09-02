import type { ScanReport } from "../types";

export function exportScanToJson(result: ScanReport): string {
  const exportData = {
    metadata: {
      folderPath: result.folderPath,
      filePattern: result.filePattern,
      scanDate: new Date().toISOString(),
      totalFiles: result.totalFiles,
      errorFiles: result.errorFiles,
      warningFiles: result.warningFiles,
      cleanFiles: result.cleanFiles,
      totalErrors: result.totalErrors,
      totalWarnings: result.totalWarnings,
    },
    files: result.files,
  };

  return JSON.stringify(exportData, null, 2);
}
