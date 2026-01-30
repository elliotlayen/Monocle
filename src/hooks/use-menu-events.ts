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
  | "menu:about"
  | "menu:documentation"
  | "menu:check-updates";

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
  onAbout?: () => void;
  onDocumentation?: () => void;
  onCheckUpdates?: () => void;
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
        ["menu:about", handlers.onAbout],
        ["menu:documentation", handlers.onDocumentation],
        ["menu:check-updates", handlers.onCheckUpdates],
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
