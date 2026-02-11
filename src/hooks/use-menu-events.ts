import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";

export type MenuEventType =
  | "menu:new-connection"
  | "menu:disconnect"
  | "menu:export-png"
  | "menu:export-pdf"
  | "menu:export-json"
  | "menu:settings"
  | "menu:toggle-sidebar"
  | "menu:fit-view"
  | "menu:actual-size"
  | "menu:zoom-in"
  | "menu:zoom-out"
  | "menu:reset-filters"
  | "menu:clear-focus"
  | "menu:about"
  | "menu:documentation"
  | "menu:check-updates"
  | "menu:enter-canvas"
  | "menu:canvas-open"
  | "menu:canvas-save"
  | "menu:exit-canvas"
  | "menu:canvas-import"
  | "menu:delete-selection";

export interface MenuEventHandlers {
  onNewConnection?: () => void;
  onDisconnect?: () => void;
  onExportPng?: () => void;
  onExportPdf?: () => void;
  onExportJson?: () => void;
  onSettings?: () => void;
  onToggleSidebar?: () => void;
  onFitView?: () => void;
  onActualSize?: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetFilters?: () => void;
  onClearFocus?: () => void;
  onAbout?: () => void;
  onDocumentation?: () => void;
  onCheckUpdates?: () => void;
  onEnterCanvas?: () => void;
  onCanvasOpen?: () => void;
  onCanvasSave?: () => void;
  onExitCanvas?: () => void;
  onCanvasImport?: () => void;
  onDeleteSelection?: () => void;
}

export function useMenuEvents(handlers: MenuEventHandlers) {
  useEffect(() => {
    const unlisteners: (() => void)[] = [];

    const setupListeners = async () => {
      const events: Array<[MenuEventType, (() => void) | undefined]> = [
        ["menu:new-connection", handlers.onNewConnection],
        ["menu:disconnect", handlers.onDisconnect],
        ["menu:export-png", handlers.onExportPng],
        ["menu:export-pdf", handlers.onExportPdf],
        ["menu:export-json", handlers.onExportJson],
        ["menu:settings", handlers.onSettings],
        ["menu:toggle-sidebar", handlers.onToggleSidebar],
        ["menu:fit-view", handlers.onFitView],
        ["menu:actual-size", handlers.onActualSize],
        ["menu:zoom-in", handlers.onZoomIn],
        ["menu:zoom-out", handlers.onZoomOut],
        ["menu:reset-filters", handlers.onResetFilters],
        ["menu:clear-focus", handlers.onClearFocus],
        ["menu:about", handlers.onAbout],
        ["menu:documentation", handlers.onDocumentation],
        ["menu:check-updates", handlers.onCheckUpdates],
        ["menu:enter-canvas", handlers.onEnterCanvas],
        ["menu:canvas-open", handlers.onCanvasOpen],
        ["menu:canvas-save", handlers.onCanvasSave],
        ["menu:exit-canvas", handlers.onExitCanvas],
        ["menu:canvas-import", handlers.onCanvasImport],
        ["menu:delete-selection", handlers.onDeleteSelection],
      ];

      for (const [eventName, handler] of events) {
        if (handler) {
          const unlisten = await listen(eventName, () => {
            handler();
          });
          unlisteners.push(unlisten);
        }
      }
    };

    setupListeners();

    return () => {
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, [handlers]);
}
