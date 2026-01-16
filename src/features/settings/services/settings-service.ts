import { invoke } from "@tauri-apps/api/core";
import type { ConnectionHistory } from "@/features/connection/services/connection-service";

export type ThemeSetting = "dark" | "light" | "system";
export type FocusMode = "fade" | "hide";

export interface AppSettings {
  recentConnections: ConnectionHistory[];
  theme?: ThemeSetting;
  schemaFilter?: string;
  focusMode?: FocusMode;
}

export interface SettingsUpdate {
  theme?: ThemeSetting;
  schemaFilter?: string;
  focusMode?: FocusMode;
}

export const settingsService = {
  getSettings: () => invoke<AppSettings>("get_settings"),

  saveSettings: (settings: SettingsUpdate) =>
    invoke<AppSettings>("save_settings", { settings }),
};
