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
}
