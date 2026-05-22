import { tauri } from "@/services/tauri";
import type { FolderSource } from "@/features/explorer/types";

export type ThemeSetting = "dark" | "light" | "system";
export type EdgeLabelMode = "auto" | "never" | "always";

export interface AppSettings {
  theme?: ThemeSetting;
  schemaFilter?: string;
  focusExpandThreshold?: number;
  edgeLabelMode?: EdgeLabelMode;
  showMiniMap?: boolean;
  folderSources?: FolderSource[];
  explorerSidebarWidth?: number;
}

export interface SettingsUpdate {
  theme?: ThemeSetting;
  schemaFilter?: string;
  focusExpandThreshold?: number;
  edgeLabelMode?: EdgeLabelMode;
  showMiniMap?: boolean;
  folderSources?: FolderSource[];
  explorerSidebarWidth?: number;
}

export const settingsService = {
  getSettings: () => tauri.getSettings(),
  saveSettings: (settings: SettingsUpdate) => tauri.saveSettings(settings),
};
