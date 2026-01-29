import { invoke } from "@tauri-apps/api/core";
import type {
  ConnectionParams,
  ServerConnectionParams,
  SchemaGraph,
} from "@/features/schema-graph/types";
import type {
  AppSettings,
  SettingsUpdate,
} from "@/features/settings/services/settings-service";

// Centralized error handling wrapper
async function invokeCommand<T>(
  command: string,
  args?: Record<string, unknown>
): Promise<T> {
  try {
    // Only pass args if defined to maintain original invoke signature
    return args ? await invoke<T>(command, args) : await invoke<T>(command);
  } catch (error) {
    console.error(`Tauri command failed: ${command}`, error);
    throw error;
  }
}

// Type-safe command registry
export const tauri = {
  // Schema commands
  loadSchema: (params: ConnectionParams) =>
    invokeCommand<SchemaGraph>("load_schema_cmd", { params }),
  loadMockSchema: (size: string) =>
    invokeCommand<SchemaGraph>("load_schema_mock", { size }),

  // Database commands
  listDatabases: (params: ServerConnectionParams) =>
    invokeCommand<string[]>("list_databases_cmd", { params }),

  // Settings commands
  getSettings: () => invokeCommand<AppSettings>("get_settings"),
  saveSettings: (settings: SettingsUpdate) =>
    invokeCommand<AppSettings>("save_settings", { settings }),
};
