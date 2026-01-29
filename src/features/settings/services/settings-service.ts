import { tauri } from "@/services/tauri";

export type ThemeSetting = "dark" | "light" | "system";
export type FocusMode = "fade" | "hide";

export interface AppSettings {
  theme?: ThemeSetting;
  schemaFilter?: string;
  focusMode?: FocusMode;
  focusExpandThreshold?: number;
}

export interface SettingsUpdate {
  theme?: ThemeSetting;
  schemaFilter?: string;
  focusMode?: FocusMode;
  focusExpandThreshold?: number;
}

export const settingsService = {
  getSettings: () => tauri.getSettings(),
  saveSettings: (settings: SettingsUpdate) => tauri.saveSettings(settings),
};
