import type { SchemaGraph } from "@/features/schema-graph/types";

export interface JsonExportOptions {
  pretty?: boolean;
  includeMetadata?: boolean;
  connectionInfo?: { server: string; database?: string };
}

export function exportToJson(
  schema: SchemaGraph,
  options: JsonExportOptions = {}
): string {
  const { pretty = true, includeMetadata = true, connectionInfo } = options;

  const exportData = includeMetadata
    ? {
        metadata: {
          exportedAt: new Date().toISOString(),
          version: "1.0",
          server: connectionInfo?.server,
          database: connectionInfo?.database,
        },
        schema,
      }
    : schema;

  return pretty
    ? JSON.stringify(exportData, null, 2)
    : JSON.stringify(exportData);
}
