import { save, open } from "@tauri-apps/plugin-dialog";
import { writeFile, readFile } from "@tauri-apps/plugin-fs";
import type { CanvasFile } from "../types";

const FILE_FILTER = {
  name: "Monocle Schema",
  extensions: ["monocle.json"],
};

export const canvasFileService = {
  async saveFile(
    data: CanvasFile,
    existingPath?: string
  ): Promise<string | null> {
    const path =
      existingPath ??
      (await save({
        defaultPath: "schema.monocle.json",
        filters: [FILE_FILTER],
      }));

    if (!path) return null;

    if (existingPath) {
      try {
        const bytes = await readFile(existingPath);
        const decoder = new TextDecoder();
        const json = decoder.decode(bytes);
        const existing = JSON.parse(json) as CanvasFile;
        if (existing?.metadata?.createdAt) {
          data.metadata.createdAt = existing.metadata.createdAt;
        }
        if (existing?.metadata?.version) {
          data.metadata.version = existing.metadata.version;
        }
      } catch {
        // Ignore read/parse failures; fall back to provided metadata
      }
    }

    data.metadata.lastModifiedAt = new Date().toISOString();
    const encoder = new TextEncoder();
    await writeFile(path, encoder.encode(JSON.stringify(data, null, 2)));
    return path;
  },

  async openFile(): Promise<{ path: string; data: CanvasFile } | null> {
    const result = await open({
      filters: [FILE_FILTER],
      multiple: false,
    });

    if (!result) return null;

    const path = typeof result === "string" ? result : result;
    const bytes = await readFile(path);
    const decoder = new TextDecoder();
    const json = decoder.decode(bytes);
    const data = JSON.parse(json) as CanvasFile;
    return { path, data };
  },
};
