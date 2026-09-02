import { describe, expect, it } from "vitest";
import {
  flattenTree,
  isPathInScope,
  matchesName,
  resultsMatchIndex,
  tintRunFlags,
  togglePathInScope,
  type FlattenTreeInput,
  type TreeRow,
  scopeTreeFilter,
} from "./selectors";
import type { TreeNode, ValidationStatus } from "../types";

function node(partial: Partial<TreeNode> & Pick<TreeNode, "id">): TreeNode {
  return {
    id: partial.id,
    path: partial.path ?? partial.id,
    name: partial.name ?? partial.id.split("/").pop() ?? partial.id,
    parentId: partial.parentId,
    type: partial.type ?? "folder",
    children: partial.children ?? null,
    loadState: partial.loadState ?? "idle",
    childCount: partial.childCount,
    isDir: partial.isDir ?? true,
    isFavorite: partial.isFavorite,
  };
}

function buildFixture() {
  const source = {
    id: "src-1",
    path: "/root",
    label: "Root",
    tag: "prod",
    favorites: [] as string[],
  };

  const fileA = node({
    id: "/root/a.xml",
    parentId: "src-1",
    type: "file",
    isDir: false,
  });
  const folder20240102 = node({
    id: "/root/20240102",
    parentId: "src-1",
    name: "20240102",
  });
  const folder20240101 = node({
    id: "/root/20240101",
    parentId: "src-1",
    name: "20240101",
  });
  const nested = node({
    id: "/root/20240101/nested.xml",
    parentId: "/root/20240101",
    type: "file",
    isDir: false,
  });

  const root = node({
    id: "src-1",
    path: "/root",
    name: "Root",
    type: "source",
    loadState: "loaded",
    children: [fileA, folder20240102, folder20240101],
  });
  folder20240101.children = [nested];
  folder20240101.loadState = "loaded";

  const treeNodes = new Map<string, TreeNode>([
    ["src-1", root],
    [fileA.id, fileA],
    [folder20240102.id, folder20240102],
    [folder20240101.id, folder20240101],
    [nested.id, nested],
  ]);

  const loadedFileIndex = new Map<string, string>();
  for (const [id, n] of treeNodes) loadedFileIndex.set(id, n.name.toLowerCase());

  const input: FlattenTreeInput = {
    treeNodes,
    folderSources: [source],
    expandedIds: new Set(["src-1"]),
    filterText: "",
    loadedFileIndex,
    dateSortOrder: "newest",
    dateRange: null,
    favoritesCollapsed: new Set(),
    folderBadgeCache: new Map(),
    validationCache: new Map(),
  };

  return { input, source };
}

function keys(rows: TreeRow[]): string[] {
  return rows.map((r) => r.key);
}

describe("flattenTree", () => {
  it("emits only expanded rows, folders before files, newest date first", () => {
    const { input } = buildFixture();
    const rows = flattenTree(input);

    expect(keys(rows)).toEqual([
      "src-1",
      "/root/20240102",
      "/root/20240101",
      "/root/a.xml",
    ]);
  });

  it("orders date folders oldest first when requested", () => {
    const { input } = buildFixture();
    const rows = flattenTree({ ...input, dateSortOrder: "oldest" });

    expect(keys(rows)).toEqual([
      "src-1",
      "/root/20240101",
      "/root/20240102",
      "/root/a.xml",
    ]);
  });

  it("descends into expanded folders with increasing depth", () => {
    const { input } = buildFixture();
    const rows = flattenTree({
      ...input,
      expandedIds: new Set(["src-1", "/root/20240101"]),
    });

    const nestedRow = rows.find((r) => r.key === "/root/20240101/nested.xml");
    expect(nestedRow).toBeDefined();
    expect(nestedRow?.kind === "node" && nestedRow.depth).toBe(2);
  });

  it("filters date folders by range without touching files", () => {
    const { input } = buildFixture();
    const rows = flattenTree({
      ...input,
      dateRange: { from: new Date(2024, 0, 2), to: new Date(2024, 0, 2) },
    });

    expect(keys(rows)).toEqual(["src-1", "/root/20240102", "/root/a.xml"]);
  });

  it("auto-expands ancestors of filename matches while filtering", () => {
    const { input } = buildFixture();
    // 20240101 is collapsed, but nested.xml matches the filter.
    const rows = flattenTree({ ...input, filterText: "nested" });

    expect(keys(rows)).toEqual([
      "src-1",
      "/root/20240101",
      "/root/20240101/nested.xml",
    ]);
  });

  it("returns no rows when the filter matches nothing", () => {
    const { input } = buildFixture();
    const rows = flattenTree({ ...input, filterText: "zzz-no-match" });
    expect(rows).toEqual([]);
  });

  it("renders a favorites section and hides the favorite from the main list", () => {
    const { input, source } = buildFixture();
    source.favorites = ["/root/20240101"];
    const favNode = input.treeNodes.get("/root/20240101");
    if (favNode) favNode.isFavorite = true;

    const rows = flattenTree(input);

    expect(keys(rows)).toEqual([
      "src-1",
      "favorites-header:src-1",
      "fav:src-1:/root/20240101",
      "/root/20240102",
      "/root/a.xml",
    ]);
    const favRow = rows.find((r) => r.key === "fav:src-1:/root/20240101");
    expect(favRow?.kind === "node" && favRow.inFavorites).toBe(true);
  });

  it("collapses the favorites section but keeps main-list exclusion", () => {
    const { input, source } = buildFixture();
    source.favorites = ["/root/20240101"];

    const rows = flattenTree({
      ...input,
      favoritesCollapsed: new Set(["src-1"]),
    });

    expect(keys(rows)).toEqual([
      "src-1",
      "favorites-header:src-1",
      "/root/20240102",
      "/root/a.xml",
    ]);
    const header = rows.find((r) => r.kind === "favorites-header");
    expect(header?.kind === "favorites-header" && header.collapsed).toBe(true);
  });

  it("emits favorite subtrees with namespaced keys when expanded", () => {
    const { input, source } = buildFixture();
    source.favorites = ["/root/20240101"];

    const rows = flattenTree({
      ...input,
      expandedIds: new Set(["src-1", "/root/20240101"]),
    });

    expect(keys(rows)).toContain("fav:src-1:/root/20240101/nested.xml");
  });

  it("maps folder badges and file validation status onto rows", () => {
    const { input } = buildFixture();
    const folderBadgeCache = new Map<string, ValidationStatus>([
      ["/root/20240102", "error"],
    ]);
    const validationCache = new Map([
      [
        "/root/a.xml",
        {
          problems: [
            {
              line: 1,
              column: 1,
              endColumn: 2,
              message: "bad",
              severity: "warning" as const,
              code: "bare-cr",
            },
          ],
        },
      ],
    ]);

    const rows = flattenTree({ ...input, folderBadgeCache, validationCache });

    const folderRow = rows.find((r) => r.key === "/root/20240102");
    const fileRow = rows.find((r) => r.key === "/root/a.xml");
    expect(folderRow?.kind === "node" && folderRow.badge).toBe("error");
    expect(fileRow?.kind === "node" && fileRow.badge).toBe("warning");
  });

  it("carries the source tag on source rows", () => {
    const { input } = buildFixture();
    const rows = flattenTree(input);
    const sourceRow = rows[0];
    expect(sourceRow.kind === "node" && sourceRow.tag).toBe("prod");
  });
});

describe("togglePathInScope", () => {
  it("adds and removes a path", () => {
    let scope = togglePathInScope(new Set(), "/root/a");
    expect([...scope]).toEqual(["/root/a"]);
    scope = togglePathInScope(scope, "/root/a");
    expect(scope.size).toBe(0);
  });

  it("checking a parent drops redundant descendants", () => {
    const scope = togglePathInScope(
      new Set(["/root/a/inbound", "/root/b"]),
      "/root/a"
    );
    expect([...scope].sort()).toEqual(["/root/a", "/root/b"]);
  });

  it("a path covered by a scoped ancestor is not added", () => {
    const scope = togglePathInScope(new Set(["/root/a"]), "/root/a/inbound");
    expect([...scope]).toEqual(["/root/a"]);
  });
});

describe("isPathInScope", () => {
  it("treats an empty scope as everything in scope", () => {
    expect(isPathInScope(new Set(), "/anything")).toBe(true);
  });

  it("matches exact paths and descendants only", () => {
    const scope = new Set(["/root/a"]);
    expect(isPathInScope(scope, "/root/a")).toBe(true);
    expect(isPathInScope(scope, "/root/a/inbound/x.xml")).toBe(true);
    expect(isPathInScope(scope, "/root/ab")).toBe(false);
    expect(isPathInScope(scope, "/root/b")).toBe(false);
  });
});

describe("tintRunFlags", () => {
  const nodeRow = (path: string): TreeRow => ({
    kind: "node",
    key: path,
    id: path,
    path,
    name: path,
    depth: 1,
    type: "folder",
    isDir: true,
    isExpanded: false,
    loadState: "idle",
    sourceId: "s",
    badge: undefined,
    inFavorites: false,
    childCount: undefined,
    isFavorite: undefined,
    tag: undefined,
  });
  const header: TreeRow = {
    kind: "favorites-header",
    key: "h",
    sourceId: "s",
    depth: 1,
    collapsed: false,
  };

  it("returns no tint when the scope is empty", () => {
    const flags = tintRunFlags([nodeRow("/a"), nodeRow("/b")], new Set());
    expect(flags.every((f) => !f.inScope)).toBe(true);
  });

  it("marks run boundaries for a single contiguous run", () => {
    const rows = [nodeRow("/x"), nodeRow("/a"), nodeRow("/a/1"), nodeRow("/y")];
    const flags = tintRunFlags(rows, new Set(["/a"]));
    expect(flags.map((f) => f.inScope)).toEqual([false, true, true, false]);
    expect(flags[1]).toEqual({ inScope: true, runStart: true, runEnd: false });
    expect(flags[2]).toEqual({ inScope: true, runStart: false, runEnd: true });
  });

  it("handles disjoint runs and list edges", () => {
    const rows = [nodeRow("/a"), nodeRow("/x"), header, nodeRow("/b")];
    const flags = tintRunFlags(rows, new Set(["/a", "/b"]));
    expect(flags[0]).toEqual({ inScope: true, runStart: true, runEnd: true });
    expect(flags[2].inScope).toBe(false);
    expect(flags[3]).toEqual({ inScope: true, runStart: true, runEnd: true });
  });
});

describe("matchesName", () => {
  it("substring, case, and regex modes", () => {
    expect(
      matchesName("ORD_1.xml", "ord", { regex: false, caseSensitive: false })
    ).toBe(true);
    expect(
      matchesName("ORD_1.xml", "ord", { regex: false, caseSensitive: true })
    ).toBe(false);
    expect(
      matchesName("ORD_1.xml", "^ord_\\d", { regex: true, caseSensitive: false })
    ).toBe(true);
    expect(
      matchesName("ORD_1.xml", "[bad", { regex: true, caseSensitive: false })
    ).toBe(false);
    expect(
      matchesName("ORD_1.xml", "  ", { regex: false, caseSensitive: false })
    ).toBe(false);
  });
});

describe("resultsMatchIndex", () => {
  const fileResult = (path: string): { path: string; name: string; isDir: boolean; parentFolder: string } => ({
    path,
    name: path.split("/").pop() ?? path,
    isDir: false,
    parentFolder: "/root",
  });

  it("labels content results with match counts", () => {
    const index = resultsMatchIndex({
      lastRun: "content",
      searchResults: [
        {
          filePath: "/root/a.xml",
          fileName: "a.xml",
          parentFolder: "/root",
          matchCount: 3,
          matches: [],
          operationId: "op",
        },
      ],
      filenameResults: [],
      loadedMatches: [],
    });
    expect(index.get("/root/a.xml")).toBe("3 matches");
  });

  it("labels filename results from loaded and streamed sets, skipping dirs", () => {
    const index = resultsMatchIndex({
      lastRun: "filename",
      searchResults: [],
      filenameResults: [
        fileResult("/root/b.xml"),
        { ...fileResult("/root/dir"), isDir: true },
      ],
      loadedMatches: [fileResult("/root/a.xml")],
    });
    expect(index.get("/root/a.xml")).toBe("match");
    expect(index.get("/root/b.xml")).toBe("match");
    expect(index.has("/root/dir")).toBe(false);
  });

  it("is empty with no active run", () => {
    const index = resultsMatchIndex({
      lastRun: null,
      searchResults: [],
      filenameResults: [],
      loadedMatches: [],
    });
    expect(index.size).toBe(0);
  });
});

describe("scopeTreeFilter", () => {
  const folder = (
    id: string,
    name: string,
    children: TreeNode[] = []
  ): TreeNode => ({
    id,
    path: id,
    name,
    type: "folder",
    children,
    loadState: "loaded",
    isDir: true,
  });

  const buildTree = () => {
    const inbound = folder("/r/a/inbound", "inbound");
    const errors = folder("/r/a/errors", "errors");
    const a = folder("/r/a", "20260901", [inbound, errors]);
    const b = folder("/r/b", "20260831");
    const root = folder("root", "Root", [a, b]);
    const nodes = new Map<string, TreeNode>(
      [root, a, b, inbound, errors].map((n) => [n.id, n])
    );
    return { root, nodes };
  };

  it("returns null for an empty filter", () => {
    const { root, nodes } = buildTree();
    expect(scopeTreeFilter(nodes, root, "  ")).toBeNull();
  });

  it("keeps matches and their ancestors, expanding the ancestors", () => {
    const { root, nodes } = buildTree();
    const result = scopeTreeFilter(nodes, root, "inbound");
    expect(result).not.toBeNull();
    expect(result?.visibleIds.has("/r/a/inbound")).toBe(true);
    expect(result?.visibleIds.has("/r/a")).toBe(true);
    expect(result?.visibleIds.has("/r/b")).toBe(false);
    expect(result?.expandIds.has("/r/a")).toBe(true);
    expect(result?.expandIds.has("/r/a/inbound")).toBe(false);
  });

  it("matches case-insensitively on partial names", () => {
    const { root, nodes } = buildTree();
    const result = scopeTreeFilter(nodes, root, "2026");
    expect(result?.visibleIds.has("/r/a")).toBe(true);
    expect(result?.visibleIds.has("/r/b")).toBe(true);
  });
});
