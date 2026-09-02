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

/** Integration Explorer XML tree node looks; independent of the graph styles. */
export type ExplorerNodeStyle = "soft" | "capsule" | "outline" | "depth";

export const EXPLORER_NODE_STYLES: readonly ExplorerNodeStyle[] = [
  "soft",
  "capsule",
  "outline",
  "depth",
];
export const DEFAULT_EXPLORER_NODE_STYLE: ExplorerNodeStyle = "soft";

export function isExplorerNodeStyle(
  value: unknown
): value is ExplorerNodeStyle {
  return (
    typeof value === "string" &&
    (EXPLORER_NODE_STYLES as readonly string[]).includes(value)
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
  explorerNodeStyle?: ExplorerNodeStyle;
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
  explorerNodeStyle?: ExplorerNodeStyle;
}

export const settingsService = {
  getSettings: () => tauri.getSettings(),
  saveSettings: (settings: SettingsUpdate) => tauri.saveSettings(settings),
};
