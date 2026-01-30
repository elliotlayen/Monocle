import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useEffect } from "react";

type Callback<T> = (payload: T) => void;

// Creates a shared event hub - one native listener, many subscribers
export function createEventHub<T>(eventName: string) {
  const subscribers = new Set<Callback<T>>();
  let unlisten: UnlistenFn | null = null;

  const ensureListening = async () => {
    if (unlisten) return;
    unlisten = await listen<T>(eventName, (event) => {
      subscribers.forEach((cb) => cb(event.payload));
    });
  };

  return {
    subscribe: (callback: Callback<T>): (() => void) => {
      subscribers.add(callback);
      ensureListening();
      return () => {
        subscribers.delete(callback);
        if (subscribers.size === 0 && unlisten) {
          unlisten();
          unlisten = null;
        }
      };
    },
  };
}

// React hook for subscribing to Tauri events
export function useTauriEvent<T>(
  subscribe: (cb: Callback<T>) => () => void,
  callback: Callback<T>
) {
  useEffect(() => {
    return subscribe(callback);
  }, [subscribe, callback]);
}

// Event hubs (add as needed when backend emits events)
// Example:
// export const connectionStatusHub = createEventHub<{ connected: boolean }>("connection-status");

// Menu event hubs for cross-component communication
export const menuToggleSidebarHub = createEventHub<void>("menu:toggle-sidebar");
export const menuFitViewHub = createEventHub<void>("menu:fit-view");
export const menuActualSizeHub = createEventHub<void>("menu:actual-size");
export const menuExportPngHub = createEventHub<void>("menu:export-png");
export const menuExportPdfHub = createEventHub<void>("menu:export-pdf");
export const menuExportJsonHub = createEventHub<void>("menu:export-json");
export const menuCheckUpdatesHub = createEventHub<void>("menu:check-updates");
