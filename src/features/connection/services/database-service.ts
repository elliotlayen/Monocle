import { invoke } from "@tauri-apps/api/core";
import type { ServerConnectionParams } from "@/features/schema-graph/types";

export const databaseService = {
  listDatabases: (params: ServerConnectionParams): Promise<string[]> =>
    invoke<string[]>("list_databases_cmd", { params }),
};
