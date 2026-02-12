import type { AuthType } from "@/features/schema-graph/types";

const CONNECTION_SETTINGS_STORAGE_KEY = "monocle-connection-settings";

export interface SavedConnectionSettings {
  server: string;
  authType: AuthType;
  username?: string;
}

export function loadConnectionSettings(): SavedConnectionSettings | null {
  try {
    const saved = localStorage.getItem(CONNECTION_SETTINGS_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved) as SavedConnectionSettings;
    }
  } catch {
    // Ignore parse/storage errors
  }
  return null;
}

export function saveConnectionSettings(settings: SavedConnectionSettings) {
  try {
    const toSave: SavedConnectionSettings = {
      server: settings.server,
      authType: settings.authType,
    };

    if (settings.authType === "sqlServer" && settings.username) {
      toSave.username = settings.username;
    }

    localStorage.setItem(
      CONNECTION_SETTINGS_STORAGE_KEY,
      JSON.stringify(toSave)
    );
  } catch {
    // Ignore storage errors
  }
}
