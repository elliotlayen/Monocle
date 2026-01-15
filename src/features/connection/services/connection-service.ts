import { invoke } from "@tauri-apps/api/core";

export interface ConnectionHistory {
  server: string;
  database: string;
  username: string;
  lastUsed: string;
}

export const connectionService = {
  getRecentConnections: () =>
    invoke<ConnectionHistory[]>("get_recent_connections"),

  saveConnection: (connection: Omit<ConnectionHistory, "lastUsed">) =>
    invoke<void>("save_connection", {
      server: connection.server,
      database: connection.database,
      username: connection.username,
    }),

  deleteConnection: (server: string, database: string) =>
    invoke<void>("delete_connection", { server, database }),
};
