import {
  settingsService,
  type ExplorerNodeStyle,
  DEFAULT_EXPLORER_NODE_STYLE,
} from "@/features/settings/services/settings-service";
import type { SliceCreator } from "./store-types";

export type ResultsPanelMode = "results" | "browse";

export interface UiSlice {
  /** Results panel width (persisted as explorerSidebarWidth). */
  sidebarWidth: number;
  explorerNodeStyle: ExplorerNodeStyle;
  resultsPanelMode: ResultsPanelMode;

  setSidebarWidth: (width: number) => void;
  setExplorerNodeStyle: (style: ExplorerNodeStyle) => void;
  setResultsPanelMode: (mode: ResultsPanelMode) => void;
}

export const createUiSlice: SliceCreator<UiSlice> = (set) => ({
  sidebarWidth: 380,
  explorerNodeStyle: DEFAULT_EXPLORER_NODE_STYLE,
  resultsPanelMode: "browse",

  setSidebarWidth: (width: number) => {
    set({ sidebarWidth: width });
    // Deliberately silent: a failed width persist is cosmetic and this fires
    // on every drag-resize commit.
    settingsService
      .saveSettings({ explorerSidebarWidth: width })
      .catch(() => {});
  },

  setExplorerNodeStyle: (style: ExplorerNodeStyle) => {
    set({ explorerNodeStyle: style });
    // Deliberately silent: the in-memory style still applies for the session.
    settingsService.saveSettings({ explorerNodeStyle: style }).catch(() => {});
  },

  setResultsPanelMode: (mode: ResultsPanelMode) => {
    set({ resultsPanelMode: mode });
  },
});
