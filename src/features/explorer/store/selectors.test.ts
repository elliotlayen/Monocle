import { describe, expect, it } from "vitest";
import { flattenTree, type FlattenTreeInput, type TreeRow } from "./selectors";
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
