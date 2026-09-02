import {
  settingsService,
  type ExplorerNodeStyle,
  DEFAULT_EXPLORER_NODE_STYLE,
} from "@/features/settings/services/settings-service";
import type { SliceCreator } from "./store-types";

export type ExplorerView = "explorer" | "search" | "scan";

export interface UiSlice {
  sidebarOpen: boolean;
  sidebarWidth: number;
  explorerNodeStyle: ExplorerNodeStyle;
  activeView: ExplorerView;

  setSidebarOpen: (open: boolean) => void;
  setSidebarWidth: (width: number) => void;
  setExplorerNodeStyle: (style: ExplorerNodeStyle) => void;
  setActiveView: (view: ExplorerView) => void;
}

export const createUiSlice: SliceCreator<UiSlice> = (set, get) => ({
  sidebarOpen: true,
  sidebarWidth: 280,
  explorerNodeStyle: DEFAULT_EXPLORER_NODE_STYLE,
  activeView: "explorer",

  setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),

  setActiveView: (view: ExplorerView) => {
    set({ activeView: view, sidebarOpen: true });
    // Keep searchMode in sync so content-search scoping (checkboxes,
    // result panes) stays gated correctly during the transition period.
    if (view === "search") {
      get().setSearchMode("content");
    } else if (view === "explorer") {
      get().setSearchMode("filename");
    }
  },

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
});
