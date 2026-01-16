import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

export interface ExportOptions {
  filename: string;
  filters: { name: string; extensions: string[] }[];
}

export const exportService = {
  async saveBinaryFile(
    data: Uint8Array,
    options: ExportOptions
  ): Promise<string | null> {
    const path = await save({
      defaultPath: options.filename,
      filters: options.filters,
    });

    if (path) {
      await writeFile(path, data);
      return path;
    }
    return null;
  },

  async saveTextFile(
    content: string,
    options: ExportOptions
  ): Promise<string | null> {
    const path = await save({
      defaultPath: options.filename,
      filters: options.filters,
    });

    if (path) {
      const encoder = new TextEncoder();
      await writeFile(path, encoder.encode(content));
      return path;
    }
    return null;
  },
};
