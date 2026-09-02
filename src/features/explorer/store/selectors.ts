import type {
  FolderSource,
  TreeNode,
  ValidationProblem,
  ValidationStatus,
} from "../types";
import { formatDateFolder } from "../utils/date-format";
import type { DateRange } from "./store-types";

export interface TreeNodeRow {
  kind: "node";
  /** Globally unique row key; favorites-section rows are namespaced. */
  key: string;
  id: string;
  path: string;
  name: string;
  depth: number;
  type: TreeNode["type"];
  isDir: boolean;
  isExpanded: boolean;
  loadState: TreeNode["loadState"];
  childCount?: number;
  isFavorite?: boolean;
  sourceId: string;
  /** Source tag badge (source rows only). */
  tag?: string;
  /** Aggregated folder badge or per-file validation status. */
  badge?: ValidationStatus;
  /** True for rows rendered inside a Favorites section. */
  inFavorites: boolean;
}

export interface FavoritesHeaderRow {
  kind: "favorites-header";
  key: string;
  sourceId: string;
  depth: number;
  collapsed: boolean;
}

export type TreeRow = TreeNodeRow | FavoritesHeaderRow;

export interface FlattenTreeInput {
  treeNodes: Map<string, TreeNode>;
  folderSources: FolderSource[];
  expandedIds: Set<string>;
  filterText: string;
  loadedFileIndex: Map<string, string>;
  dateSortOrder: "newest" | "oldest";
  dateRange: DateRange;
  favoritesCollapsed: Set<string>;
  folderBadgeCache: Map<string, ValidationStatus>;
  validationCache: Map<string, { problems: ValidationProblem[] }>;
}

const DATE_FOLDER_RE = /^\d{8}$/;

function validationStatusFor(
  problems: ValidationProblem[]
): ValidationStatus {
  if (problems.some((p) => p.severity === "error")) return "error";
  if (problems.some((p) => p.severity === "warning")) return "warning";
  return "clean";
}

interface FilterState {
  /** Nodes allowed to render (matches, their ancestors, and loaded descendants of matched dirs). */
  visibleIds: Set<string>;
  /** Ancestors of matches, force-expanded while the filter is active. */
  autoExpandedIds: Set<string>;
}

function computeFilterState(
  input: Pick<FlattenTreeInput, "treeNodes" | "loadedFileIndex">,
  lowerFilter: string
): FilterState {
  const { treeNodes, loadedFileIndex } = input;
  const visibleIds = new Set<string>();
  const autoExpandedIds = new Set<string>();

  const addAncestors = (node: TreeNode) => {
    let current: TreeNode | undefined = node;
    while (current) {
      visibleIds.add(current.id);
      if (current.id !== node.id && current.isDir) {
        autoExpandedIds.add(current.id);
      }
      current = current.parentId ? treeNodes.get(current.parentId) : undefined;
    }
  };
  const addLoadedDescendants = (node: TreeNode) => {
    for (const child of node.children ?? []) {
      const current = treeNodes.get(child.id) ?? child;
      visibleIds.add(current.id);
      if (current.children) addLoadedDescendants(current);
    }
  };

  for (const [id, lowerName] of loadedFileIndex) {
    if (!lowerName.includes(lowerFilter)) continue;
    const node = treeNodes.get(id);
    if (!node) continue;
    addAncestors(node);
    if (node.isDir) addLoadedDescendants(node);
  }

  return { visibleIds, autoExpandedIds };
}

function inDateRange(name: string, range: DateRange): boolean {
  if (!range?.from) return true;
  const from = new Date(range.from);
  from.setHours(0, 0, 0, 0);
  const to = range.to ? new Date(range.to) : new Date(from);
  to.setHours(23, 59, 59, 999);

  const dateInfo = formatDateFolder(name);
  if (!dateInfo.formatted) return true;
  const year = parseInt(name.slice(0, 4), 10);
  const month = parseInt(name.slice(4, 6), 10);
  const day = parseInt(name.slice(6, 8), 10);
  const folderDate = new Date(year, month - 1, day);
  return folderDate >= from && folderDate <= to;
}

/**
 * Flatten the lazily loaded folder tree into the ordered list of rows the
 * virtualized tree renders. Pure: same inputs, same output.
 *
 * While a filename filter is active, ancestors of matches are treated as
 * expanded so matches inside collapsed folders become reachable.
 */
export function flattenTree(input: FlattenTreeInput): TreeRow[] {
  const {
    treeNodes,
    folderSources,
    expandedIds,
    filterText,
    dateSortOrder,
    dateRange,
    favoritesCollapsed,
    folderBadgeCache,
    validationCache,
  } = input;

  const lowerFilter = filterText.trim().toLowerCase();
  const filter = lowerFilter ? computeFilterState(input, lowerFilter) : null;

  const isExpanded = (id: string) =>
    expandedIds.has(id) || (filter?.autoExpandedIds.has(id) ?? false);

  const rows: TreeRow[] = [];

  const badgeFor = (node: TreeNode): ValidationStatus | undefined => {
    if (node.isDir) {
      if (node.type === "source") return undefined;
      return folderBadgeCache.get(node.path);
    }
    const cached = validationCache.get(node.path);
    return cached ? validationStatusFor(cached.problems) : undefined;
  };

  const pushNode = (
    node: TreeNode,
    depth: number,
    sourceId: string,
    options: { keyPrefix?: string; tag?: string; inFavorites?: boolean } = {}
  ) => {
    rows.push({
      kind: "node",
      key: `${options.keyPrefix ?? ""}${node.id}`,
      id: node.id,
      path: node.path,
      name: node.name,
      depth,
      type: node.type,
      isDir: node.isDir,
      isExpanded: isExpanded(node.id),
      loadState: node.loadState,
      childCount: node.childCount,
      isFavorite: node.isFavorite,
      sourceId,
      tag: options.tag,
      badge: badgeFor(node),
      inFavorites: options.inFavorites ?? false,
    });
  };

  const sortChildren = (children: TreeNode[]): TreeNode[] =>
    [...children].sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
      if (
        a.isDir &&
        b.isDir &&
        DATE_FOLDER_RE.test(a.name) &&
        DATE_FOLDER_RE.test(b.name)
      ) {
        return dateSortOrder === "newest"
          ? b.name.localeCompare(a.name)
          : a.name.localeCompare(b.name);
      }
      return a.name.localeCompare(b.name);
    });

  const emitChildren = (
    node: TreeNode,
    depth: number,
    source: FolderSource,
    options: { keyPrefix?: string; inFavorites?: boolean } = {}
  ) => {
    const current = treeNodes.get(node.id) ?? node;
    if (!isExpanded(current.id) || !current.children) return;

    const children = sortChildren(
      current.children
        .map((child) => treeNodes.get(child.id) ?? child)
        .filter((child) => !filter || filter.visibleIds.has(child.id))
    ).filter((child) => !child.isDir || inDateRange(child.name, dateRange));

    // Favorites section under an expanded source root
    const favoritedChildIds = new Set<string>();
    if (current.type === "source" && source.favorites.length > 0) {
      const favoritedNodes: TreeNode[] = [];
      for (const favPath of source.favorites) {
        const favNode = treeNodes.get(favPath);
        if (!favNode) continue;
        if (filter && !filter.visibleIds.has(favNode.id)) continue;
        favoritedNodes.push(favNode);
      }
      favoritedNodes.sort((a, b) => a.name.localeCompare(b.name));

      if (favoritedNodes.length > 0) {
        const collapsed = favoritesCollapsed.has(source.id);
        rows.push({
          kind: "favorites-header",
          key: `favorites-header:${source.id}`,
          sourceId: source.id,
          depth: depth + 1,
          collapsed,
        });
        for (const favNode of favoritedNodes) {
          favoritedChildIds.add(favNode.id);
          if (collapsed) continue;
          const keyPrefix = `fav:${source.id}:`;
          pushNode(favNode, depth + 1, source.id, {
            keyPrefix,
            inFavorites: true,
          });
          emitChildren(favNode, depth + 1, source, {
            keyPrefix,
            inFavorites: true,
          });
        }
      }
    }

    for (const child of children) {
      if (current.type === "source" && favoritedChildIds.has(child.id)) {
        continue;
      }
      pushNode(child, depth + 1, source.id, {
        keyPrefix: options.keyPrefix,
        inFavorites: options.inFavorites,
      });
      emitChildren(child, depth + 1, source, options);
    }
  };

  for (const source of folderSources) {
    const root = treeNodes.get(source.id);
    if (!root) continue;
    if (filter && !filter.visibleIds.has(root.id)) continue;
    pushNode(root, 0, source.id, { tag: source.tag });
    emitChildren(root, 0, source);
  }

  return rows;
}
