import { tauri } from "@/services/tauri";
import type { FolderSource } from "@/features/explorer/types";

export type ThemeSetting = "dark" | "light" | "system";
export type EdgeLabelMode = "auto" | "never" | "always";
export type DetailViewMode = "inspector" | "drawer";
export type NodeStyle = "tinted" | "surface" | "adaptive" | "solid";

export const NODE_STYLES: readonly NodeStyle[] = [
  "tinted",
  "surface",
  "adaptive",
  "solid",
];
export const DEFAULT_NODE_STYLE: NodeStyle = "adaptive";

export function isNodeStyle(value: unknown): value is NodeStyle {
  return (
    typeof value === "string" &&
    (NODE_STYLES as readonly string[]).includes(value)
  );
}

export interface AppSettings {
  theme?: ThemeSetting;
  schemaFilter?: string;
  focusExpandThreshold?: number;
  browseThreshold?: number;
  edgeLabelMode?: EdgeLabelMode;
  showMiniMap?: boolean;
  detailViewMode?: DetailViewMode;
  nodeStyle?: NodeStyle;
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
  nodeStyle?: NodeStyle;
  folderSources?: FolderSource[];
  explorerSidebarWidth?: number;
}

export const settingsService = {
  getSettings: () => tauri.getSettings(),
  saveSettings: (settings: SettingsUpdate) => tauri.saveSettings(settings),
};
