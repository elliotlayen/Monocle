import { tauri } from "@/services/tauri";
import type { DirEntry, FileContent, ScanSummary } from "../types";
import type { AppSettings } from "@/features/settings/services/settings-service";

export const explorerService = {
  listDirectory: (path: string, operationId: string): Promise<DirEntry[]> =>
    tauri.listDirectory(path, operationId),

  cancelDirectory: (operationId: string): Promise<void> =>
    tauri.cancelDirectory(operationId),

  checkPathReachable: (path: string): Promise<boolean> =>
    tauri.checkPathReachable(path),

  toggleFavorite: (
    sourceId: string,
    clientName: string
  ): Promise<AppSettings> => tauri.toggleFavorite(sourceId, clientName),

  readFile: (path: string): Promise<FileContent> => tauri.readFile(path),

  bulkScan: (
    folderPath: string,
    filePattern: string,
    operationId: string
  ): Promise<ScanSummary> => tauri.bulkScan(folderPath, filePattern, operationId),

  cancelScan: (operationId: string): Promise<void> =>
    tauri.cancelScan(operationId),
};
