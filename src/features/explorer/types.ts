export interface FolderSource {
  id: string;
  path: string;
  label: string;
  tag: string;
  favorites: string[];
}

export type TreeNodeType = "source" | "client" | "date" | "file";

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
