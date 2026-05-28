export interface FolderSource {
  id: string;
  path: string;
  label: string;
  tag: string;
  favorites: string[];
}

export type TreeNodeType = "source" | "folder" | "file";

export type LoadState = "idle" | "loading" | "loaded" | "error";

export interface TreeNode {
  id: string;
  path: string;
  name: string;
  type: TreeNodeType;
  children: TreeNode[] | null;
  loadState: LoadState;
  childCount?: number;
  isDir: boolean;
  isFavorite?: boolean;
}

export interface DirEntry {
  name: string;
  isDir: boolean;
  path: string;
}

export type ViewMode = "source" | "tree";

export interface ValidationProblem {
  line: number;
  column: number;
  endColumn: number;
  message: string;
  severity: "error" | "warning";
  code: string;
}

export type ValidationStatus = "error" | "warning" | "clean";

export interface FileContent {
  content: string;
  size: number;
  problems: ValidationProblem[];
  encoding: string;
  hasBom: boolean;
}

export interface FileTab {
  id: string;
  filePath: string;
  fileName: string;
  content: string;
  fileSize: number;
  viewMode: ViewMode;
  scrollPosition: { source: number; tree: number };
  treeExpandedIds: string[];
  monacoViewState: unknown | null;
  isXml: boolean;
  parseError: boolean;
  isLoading: boolean;
  problems: ValidationProblem[];
  encoding: string;
  hasBom: boolean;
  isScanResult?: boolean;
}

// Bulk scan types

export interface ScanProgressPayload {
  filePath: string;
  fileName: string;
  status: "clean" | "error" | "warning";
  errorCount: number;
  warningCount: number;
  filesProcessed: number;
  totalFiles: number;
  totalErrors: number;
  totalWarnings: number;
  totalClean: number;
}

export interface ScanFileResult {
  filePath: string;
  fileName: string;
  relativePath: string;
  status: "clean" | "error" | "warning";
  problems: ValidationProblem[];
  encoding: string;
  hasBom: boolean;
}

export interface ScanSummary {
  folderPath: string;
  filePattern: string;
  totalFiles: number;
  errorFiles: number;
  warningFiles: number;
  cleanFiles: number;
  totalErrors: number;
  totalWarnings: number;
  files: ScanFileResult[];
  cancelled: boolean;
}

export type ScanStatus = "idle" | "scanning" | "completed" | "cancelled";

// Content search types

export type SearchMode = "filename" | "content";

export type SearchStatus = "idle" | "searching" | "completed" | "cancelled";

export interface SearchResultFile {
  filePath: string;
  fileName: string;
  parentFolder: string;
  matchCount: number;
  operationId: string;
}

export interface SearchErrorFile {
  filePath: string;
  fileName: string;
  parentFolder: string;
  errorMessage: string;
}

export interface SearchProgressPayload {
  filesScanned: number;
  totalFiles: number;
  matchesFound: number;
  filesMatched: number;
  operationId: string;
}

export interface SearchSummary {
  query: string;
  scopeLabel: string;
  filePattern: string;
  totalFilesScanned: number;
  totalFilesMatched: number;
  totalMatches: number;
  cancelled: boolean;
}
