import { useEffect } from "react";
import {
  CONTENT_INPUT_ID,
  FILENAME_INPUT_ID,
} from "../components/search-panel";

function focusById(id: string, attempts = 5) {
  requestAnimationFrame(() => {
    const el = document.getElementById(id);
    if (el) {
      el.focus();
    } else if (attempts > 1) {
      // The target may still be mounting; retry a few frames.
      focusById(id, attempts - 1);
    }
  });
}

/**
 * Explorer-wide keyboard shortcuts:
 * - Cmd/Ctrl+F focuses the filename field
 * - Cmd/Ctrl+Shift+F focuses the content field
 * (Cmd+P quick-open registers its own listener.)
 */
export function useExplorerKeyboard() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Do not intercept when Monaco editor has focus
      if (document.activeElement?.closest(".monaco-editor")) return;
      if (!(e.metaKey || e.ctrlKey)) return;

      const key = e.key.toLowerCase();
      if (key === "f" && e.shiftKey) {
        e.preventDefault();
        focusById(CONTENT_INPUT_ID);
      } else if (key === "f") {
        e.preventDefault();
        focusById(FILENAME_INPUT_ID);
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);
}
