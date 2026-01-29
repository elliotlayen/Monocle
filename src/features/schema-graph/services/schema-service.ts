import { tauri } from "@/services/tauri";
import type { ConnectionParams } from "../types";

export const schemaService = {
  loadSchema: (params: ConnectionParams) => tauri.loadSchema(params),
  loadMockSchema: (size: string) => tauri.loadMockSchema(size),
};
