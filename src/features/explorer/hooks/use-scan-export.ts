import { useState, useCallback } from "react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { useExplorerStore } from "../store";
import { exportService } from "@/features/export/services/export-service";
import { exportScanToCsv } from "../utils/scan-csv-export";
import { exportScanToJson } from "../utils/scan-json-export";
import { exportScanToPdf } from "../utils/scan-pdf-export";
import {
  formatScanAsText,
  formatScanAsMarkdown,
} from "../utils/scan-clipboard-export";
import { showToast } from "@/features/notifications/store";

function getDateSuffix(): string {
  return new Date().toISOString().slice(0, 10);
}

export function useScanExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const exportCsv = useCallback(async () => {
    const scanResult = useExplorerStore.getState().scanResult;
    if (!scanResult) return;

    setIsExporting(true);
    setExportError(null);
    try {
      const csv = exportScanToCsv(scanResult);
      await exportService.saveTextFile(csv, {
        filename: `scan-report-${getDateSuffix()}.csv`,
        filters: [{ name: "CSV File", extensions: ["csv"] }],
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Export failed";
      setExportError(message);
    } finally {
      setIsExporting(false);
    }
  }, []);

  const exportJson = useCallback(async () => {
    const scanResult = useExplorerStore.getState().scanResult;
    if (!scanResult) return;

    setIsExporting(true);
    setExportError(null);
    try {
      const json = exportScanToJson(scanResult);
      await exportService.saveTextFile(json, {
        filename: `scan-report-${getDateSuffix()}.json`,
        filters: [{ name: "JSON File", extensions: ["json"] }],
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Export failed";
      setExportError(message);
    } finally {
      setIsExporting(false);
    }
  }, []);

  const exportPdf = useCallback(async () => {
    const scanResult = useExplorerStore.getState().scanResult;
    if (!scanResult) return;

    setIsExporting(true);
    setExportError(null);
    try {
      const pdfData = await exportScanToPdf(scanResult);
      await exportService.saveBinaryFile(pdfData, {
        filename: `scan-report-${getDateSuffix()}.pdf`,
        filters: [{ name: "PDF Document", extensions: ["pdf"] }],
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Export failed";
      setExportError(message);
    } finally {
      setIsExporting(false);
    }
  }, []);

  const exportClipboardText = useCallback(async () => {
    const scanResult = useExplorerStore.getState().scanResult;
    if (!scanResult) return;

    setIsExporting(true);
    setExportError(null);
    try {
      const text = formatScanAsText(scanResult);
      await writeText(text);
      showToast({
        type: "success",
        title: "Copied to clipboard",
        message: "Scan results copied as plain text",
        duration: 3000,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Copy failed";
      setExportError(message);
    } finally {
      setIsExporting(false);
    }
  }, []);

  const exportClipboardMarkdown = useCallback(async () => {
    const scanResult = useExplorerStore.getState().scanResult;
    if (!scanResult) return;

    setIsExporting(true);
    setExportError(null);
    try {
      const markdown = formatScanAsMarkdown(scanResult);
      await writeText(markdown);
      showToast({
        type: "success",
        title: "Copied to clipboard",
        message: "Scan results copied as markdown",
        duration: 3000,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Copy failed";
      setExportError(message);
    } finally {
      setIsExporting(false);
    }
  }, []);

  return {
    isExporting,
    exportError,
    exportCsv,
    exportJson,
    exportPdf,
    exportClipboardText,
    exportClipboardMarkdown,
  };
}
