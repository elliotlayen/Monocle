import { tauri } from "@/services/tauri";

export const canvasMenuService = {
  setMenuUiState: (state: {
    isCanvasMode: boolean;
    hasFocus: boolean;
    hasActiveFilters: boolean;
  }): Promise<void> => tauri.setMenuUiState(state),
};
