import { tauri } from "@/services/tauri";
import type { ServerConnectionParams } from "@/features/schema-graph/types";

export const databaseService = {
  listDatabases: (params: ServerConnectionParams): Promise<string[]> =>
    tauri.listDatabases(params),
};
