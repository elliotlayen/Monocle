import { useState, useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import { useSchemaStore } from "@/features/schema-graph/store";
import { useShallow } from "zustand/shallow";
import { exportService } from "../services/export-service";
import { exportToPng } from "../utils/png-export";
import { exportToPdf } from "../utils/pdf-export";
import { exportToJson } from "../utils/json-export";

export function useExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { getNodes } = useReactFlow();

  const { schema, connectionInfo } = useSchemaStore(
    useShallow((state) => ({
      schema: state.schema,
      connectionInfo: state.connectionInfo,
    }))
  );

  const exportPng = useCallback(async () => {
    if (!schema) return null;

    setIsExporting(true);
    setError(null);

    try {
      const nodes = getNodes();
      const pngData = await exportToPng(nodes);
      const dbName = connectionInfo?.database ?? "schema";
      const filename = `${dbName}-diagram.png`;

      const savedPath = await exportService.saveBinaryFile(pngData, {
        filename,
        filters: [{ name: "PNG Image", extensions: ["png"] }],
      });

      return savedPath;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
      return null;
    } finally {
      setIsExporting(false);
    }
  }, [schema, connectionInfo, getNodes]);

  const exportPdf = useCallback(
    async (includeImage = true) => {
      if (!schema) return null;

      setIsExporting(true);
      setError(null);

      try {
        let imageData: Uint8Array | undefined;

        if (includeImage) {
          const nodes = getNodes();
          imageData = await exportToPng(nodes);
        }

        const pdfData = await exportToPdf(schema, {
          title: `${connectionInfo?.database ?? "Database"} Schema Report`,
          connectionInfo: connectionInfo ?? undefined,
          includeImage,
          imageData,
        });

        const dbName = connectionInfo?.database ?? "schema";
        const filename = `${dbName}-report.pdf`;

        const savedPath = await exportService.saveBinaryFile(pdfData, {
          filename,
          filters: [{ name: "PDF Document", extensions: ["pdf"] }],
        });

        return savedPath;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Export failed");
        return null;
      } finally {
        setIsExporting(false);
      }
    },
    [schema, connectionInfo, getNodes]
  );

  const exportJson = useCallback(async () => {
    if (!schema) return null;

    setIsExporting(true);
    setError(null);

    try {
      const jsonContent = exportToJson(schema, {
        connectionInfo: connectionInfo ?? undefined,
      });

      const dbName = connectionInfo?.database ?? "schema";
      const filename = `${dbName}-schema.json`;

      const savedPath = await exportService.saveTextFile(jsonContent, {
        filename,
        filters: [{ name: "JSON File", extensions: ["json"] }],
      });

      return savedPath;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export failed");
      return null;
    } finally {
      setIsExporting(false);
    }
  }, [schema, connectionInfo]);

  return {
    isExporting,
    error,
    exportPng,
    exportPdf,
    exportJson,
  };
}
