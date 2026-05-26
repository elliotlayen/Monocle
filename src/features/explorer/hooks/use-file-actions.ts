import { useCallback } from "react";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { openPath } from "@tauri-apps/plugin-opener";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { showToast } from "@/features/notifications/store";

export function useFileActions() {
  const copyPath = useCallback(async (filePath: string) => {
    try {
      await writeText(filePath);
      showToast({ type: "success", title: "Path copied to clipboard", duration: 2000 });
    } catch {
      showToast({ type: "error", title: "Failed to copy path", duration: 3000 });
    }
  }, []);

  const copyContent = useCallback(async (content: string) => {
    try {
      await writeText(content);
      showToast({ type: "success", title: "Content copied to clipboard", duration: 2000 });
    } catch {
      showToast({ type: "error", title: "Failed to copy content", duration: 3000 });
    }
  }, []);

  const openExternal = useCallback(async (filePath: string) => {
    try {
      await openPath(filePath);
    } catch {
      showToast({ type: "error", title: "Failed to open file", duration: 3000 });
    }
  }, []);

  const saveCopy = useCallback(async (fileName: string, content: string) => {
    try {
      const destPath = await save({ defaultPath: fileName });
      if (!destPath) return;

      const encoder = new TextEncoder();
      await writeFile(destPath, encoder.encode(content));
      showToast({ type: "success", title: `File saved to ${destPath}`, duration: 2000 });
    } catch {
      showToast({ type: "error", title: "Failed to save file", duration: 3000 });
    }
  }, []);

  return { copyPath, copyContent, openExternal, saveCopy };
}
