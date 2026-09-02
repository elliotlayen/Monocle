import { useEffect } from "react";
import { useExplorerStore } from "../store";

function focusById(id: string, attempts = 5) {
  requestAnimationFrame(() => {
    const el = document.getElementById(id);
    if (el) {
      el.focus();
    } else if (attempts > 1) {
      // The target view may still be mounting; retry a few frames.
      focusById(id, attempts - 1);
    }
  });
}

/**
 * Explorer-wide keyboard shortcuts:
 * - Cmd/Ctrl+B toggles the sidebar
 * - Cmd/Ctrl+Shift+E / +F / +S switch to the Explorer / Search / Scan views
 * - Cmd/Ctrl+F focuses the filename filter (Explorer view)
 */
export function useExplorerKeyboard() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Do not intercept when Monaco editor has focus
      if (document.activeElement?.closest(".monaco-editor")) return;
      if (!(e.metaKey || e.ctrlKey)) return;

      const store = useExplorerStore.getState();
      const key = e.key.toLowerCase();

      if (key === "b" && !e.shiftKey) {
        e.preventDefault();
        store.setSidebarOpen(!store.sidebarOpen);
      } else if (key === "e" && e.shiftKey) {
        e.preventDefault();
        store.setActiveView("explorer");
      } else if (key === "f" && e.shiftKey) {
        e.preventDefault();
        store.setActiveView("search");
        focusById("explorer-content-search-input");
      } else if (key === "f") {
        e.preventDefault();
        store.setActiveView("explorer");
        focusById("explorer-filter-input");
      } else if (key === "s" && e.shiftKey) {
        e.preventDefault();
        store.setActiveView("scan");
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
}
