import {
  settingsService,
  type ExplorerNodeStyle,
  DEFAULT_EXPLORER_NODE_STYLE,
} from "@/features/settings/services/settings-service";
import type { SliceCreator } from "./store-types";

export interface UiSlice {
  sidebarOpen: boolean;
  sidebarWidth: number;
  explorerNodeStyle: ExplorerNodeStyle;

  setSidebarOpen: (open: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setExplorerNodeStyle: (style: ExplorerNodeStyle) => void;
}

export const createUiSlice: SliceCreator<UiSlice> = (set) => ({
  sidebarOpen: true,
  sidebarWidth: 280,
  explorerNodeStyle: DEFAULT_EXPLORER_NODE_STYLE,

  setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),

  setSidebarWidth: (width: number) => {
    set({ sidebarWidth: width });
    settingsService
      .saveSettings({ explorerSidebarWidth: width })
      .catch(() => {});
  },

  setExplorerNodeStyle: (style: ExplorerNodeStyle) => {
    set({ explorerNodeStyle: style });
    settingsService.saveSettings({ explorerNodeStyle: style }).catch(() => {});
  },
});
