import { tauri } from "@/services/tauri";
import type {
  DirEntry,
  FileContent,
  FileStat,
  FilenameSearchSummary,
  ScanSummary,
  SearchSummary,
} from "../types";
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

  fileStat: (path: string): Promise<FileStat> => tauri.fileStat(path),

  bulkScan: (
    folderPath: string,
    filePattern: string,
    operationId: string
  ): Promise<ScanSummary> => tauri.bulkScan(folderPath, filePattern, operationId),

  cancelScan: (operationId: string): Promise<void> =>
    tauri.cancelScan(operationId),

  // cancelContentSearch shares the active_listings map with cancelScan —
  // both scan and content-search operations are keyed by operationId in the
  // same backend HashMap, so cancel_scan_cmd correctly cancels either.
  cancelContentSearch: (operationId: string): Promise<void> =>
    tauri.cancelScan(operationId),

  contentSearch: (
    query: string,
    folderPaths: string,
    filePattern: string,
    scopeLabel: string,
    regex: boolean,
    caseSensitive: boolean,
    dateFrom: string | null,
    dateTo: string | null,
    operationId: string
  ): Promise<SearchSummary> =>
    tauri.contentSearch(
      query,
      folderPaths,
      filePattern,
      scopeLabel,
      regex,
      caseSensitive,
      dateFrom,
      dateTo,
      operationId
    ),

  filenameSearch: (
    query: string,
    folderPaths: string,
    filePattern: string,
    operationId: string
  ): Promise<FilenameSearchSummary> =>
    tauri.filenameSearch(query, folderPaths, filePattern, operationId),

  // Shares the backend cancellation map with cancelScan (see above).
  cancelFilenameSearch: (operationId: string): Promise<void> =>
    tauri.cancelScan(operationId),
};
