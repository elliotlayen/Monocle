import { invoke } from "@tauri-apps/api/core";
import type { SchemaGraph, ConnectionParams } from "../types";

export const schemaService = {
  loadSchema: (params: ConnectionParams) =>
    invoke<SchemaGraph>("load_schema_cmd", { params }),

  loadMockSchema: (size: string) =>
    invoke<SchemaGraph>("load_schema_mock", { size }),
};
