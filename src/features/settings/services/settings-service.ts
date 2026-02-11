import { tauri } from "@/services/tauri";

export type ThemeSetting = "dark" | "light" | "system";
export type EdgeLabelMode = "auto" | "never" | "always";

export interface AppSettings {
  theme?: ThemeSetting;
  schemaFilter?: string;
  focusExpandThreshold?: number;
  edgeLabelMode?: EdgeLabelMode;
  showMiniMap?: boolean;
}

export interface SettingsUpdate {
  theme?: ThemeSetting;
  schemaFilter?: string;
  focusExpandThreshold?: number;
  edgeLabelMode?: EdgeLabelMode;
  showMiniMap?: boolean;
}

export const settingsService = {
  getSettings: () => tauri.getSettings(),
  saveSettings: (settings: SettingsUpdate) => tauri.saveSettings(settings),
};
