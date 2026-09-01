import { tauri } from "@/services/tauri";
import type { FolderSource } from "@/features/explorer/types";

export type ThemeSetting = "dark" | "light" | "system";
export type EdgeLabelMode = "auto" | "never" | "always";
export type DetailViewMode = "inspector" | "drawer";

export interface AppSettings {
  theme?: ThemeSetting;
  schemaFilter?: string;
  focusExpandThreshold?: number;
  browseThreshold?: number;
  edgeLabelMode?: EdgeLabelMode;
  showMiniMap?: boolean;
  detailViewMode?: DetailViewMode;
  folderSources?: FolderSource[];
  explorerSidebarWidth?: number;
}

export interface SettingsUpdate {
  theme?: ThemeSetting;
  schemaFilter?: string;
  focusExpandThreshold?: number;
  browseThreshold?: number;
  edgeLabelMode?: EdgeLabelMode;
  showMiniMap?: boolean;
  detailViewMode?: DetailViewMode;
  folderSources?: FolderSource[];
  explorerSidebarWidth?: number;
}

export const settingsService = {
  getSettings: () => tauri.getSettings(),
  saveSettings: (settings: SettingsUpdate) => tauri.saveSettings(settings),
};
