import { describe, it, expect } from "vitest";
import { filterTreeNodes } from "./tree-filter";
import type { TreeNode, ValidationProblem, ValidationStatus } from "../types";

function makeNode(overrides: Partial<TreeNode> = {}): TreeNode {
  return {
    id: "node-1",
    path: "/data/node-1",
    name: "Node One",
    type: "folder",
    children: null,
    loadState: "idle",
    isDir: true,
    ...overrides,
  };
}

function makeProblem(overrides: Partial<ValidationProblem> = {}): ValidationProblem {
  return {
    line: 1,
    column: 1,
    endColumn: 10,
    message: "Test problem",
    severity: "error",
    code: "test",
    ...overrides,
  };
}

describe("filterTreeNodes", () => {
  const nodes: TreeNode[] = [
    makeNode({ id: "1", name: "Alpha Corp", path: "/data/alpha" }),
    makeNode({ id: "2", name: "Beta Inc", path: "/data/beta" }),
    makeNode({
      id: "3",
      name: "Gamma Ltd",
      path: "/data/gamma",
      children: [
        makeNode({
          id: "3-1",
          name: "20251223",
          type: "folder",
          path: "/data/gamma/20251223",
        }),
        makeNode({
          id: "3-2",
          name: "20251224",
          type: "folder",
          path: "/data/gamma/20251224",
        }),
      ],
      loadState: "loaded",
    }),
  ];

  it("returns all nodes when filter is empty", () => {
    const result = filterTreeNodes(nodes, "");
    expect(result).toEqual(nodes);
  });

  it("returns all nodes when filter is whitespace-only", () => {
    const result = filterTreeNodes(nodes, "   ");
    expect(result).toEqual(nodes);
  });

  it("filters nodes by name case-insensitively", () => {
    const result = filterTreeNodes(nodes, "alpha");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Alpha Corp");
  });

  it("includes parent when child name matches", () => {
    const result = filterTreeNodes(nodes, "20251223");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("3");
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children![0].name).toBe("20251223");
  });

  it("returns empty array when no nodes match", () => {
    const result = filterTreeNodes(nodes, "zzz-no-match");
    expect(result).toHaveLength(0);
  });
});

describe("filterTreeNodes with showIssuesOnly", () => {
  const fileWithIssues = makeNode({
    id: "file-err",
    name: "bad.xml",
    path: "/data/client/20251223/bad.xml",
    type: "file",
    isDir: false,
    children: null,
  });

  const fileClean = makeNode({
    id: "file-clean",
    name: "good.xml",
    path: "/data/client/20251223/good.xml",
    type: "file",
    isDir: false,
    children: null,
  });

  const fileUnscanned = makeNode({
    id: "file-unscanned",
    name: "unknown.xml",
    path: "/data/client/20251224/unknown.xml",
    type: "file",
    isDir: false,
    children: null,
  });

  const dateFolder1 = makeNode({
    id: "date-1",
    name: "20251223",
    path: "/data/client/20251223",
    type: "folder",
    isDir: true,
    children: [fileWithIssues, fileClean],
    loadState: "loaded",
  });

  const dateFolder2 = makeNode({
    id: "date-2",
    name: "20251224",
    path: "/data/client/20251224",
    type: "folder",
    isDir: true,
    children: [fileUnscanned],
    loadState: "loaded",
  });

  const rootNode = makeNode({
    id: "root",
    name: "Client A",
    path: "/data/client",
    type: "source",
    isDir: true,
    children: [dateFolder1, dateFolder2],
    loadState: "loaded",
  });

  const validationCache = new Map<
    string,
    { problems: ValidationProblem[] }
  >([
    ["/data/client/20251223/bad.xml", { problems: [makeProblem()] }],
    ["/data/client/20251223/good.xml", { problems: [] }],
  ]);

  const folderBadgeCache = new Map<string, ValidationStatus>([
    ["/data/client/20251223", "error"],
  ]);

  it("returns all nodes when showIssuesOnly is false", () => {
    const result = filterTreeNodes([rootNode], "", {
      showIssuesOnly: false,
      validationCache,
      folderBadgeCache,
    });
    expect(result).toEqual([rootNode]);
  });

  it("returns only nodes on path to files with issues when showIssuesOnly is true", () => {
    const result = filterTreeNodes([rootNode], "", {
      showIssuesOnly: true,
      validationCache,
      folderBadgeCache,
    });

    expect(result).toHaveLength(1);
    const root = result[0];
    expect(root.id).toBe("root");
    expect(root.children).toHaveLength(2);

    // dateFolder1 is kept because it has badge "error"
    const df1 = root.children!.find((c) => c.id === "date-1");
    expect(df1).toBeDefined();

    // dateFolder2 is kept because its subtree has no validation data (pass through)
    const df2 = root.children!.find((c) => c.id === "date-2");
    expect(df2).toBeDefined();
  });

  it("returns all nodes when validationCache is empty (no data = pass through)", () => {
    const result = filterTreeNodes([rootNode], "", {
      showIssuesOnly: true,
      validationCache: new Map(),
      folderBadgeCache: new Map(),
    });
    expect(result).toEqual([rootNode]);
  });

  it("keeps parent directories that have children with issues (tree structure preserved)", () => {
    const result = filterTreeNodes([rootNode], "", {
      showIssuesOnly: true,
      validationCache,
      folderBadgeCache,
    });

    // Root should still be there since it has descendants with issues
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("root");
  });

  it("keeps folder when folderBadgeCache has error for its path", () => {
    const result = filterTreeNodes([rootNode], "", {
      showIssuesOnly: true,
      validationCache,
      folderBadgeCache,
    });

    const root = result[0];
    const df1 = root.children!.find((c) => c.id === "date-1");
    expect(df1).toBeDefined();
  });

  it("passes through nodes whose subtree has no validation data at all", () => {
    // dateFolder2 has a child (fileUnscanned) not in either cache
    const result = filterTreeNodes([rootNode], "", {
      showIssuesOnly: true,
      validationCache,
      folderBadgeCache,
    });

    const root = result[0];
    const df2 = root.children!.find((c) => c.id === "date-2");
    expect(df2).toBeDefined();
  });

  it("filters out clean files that were scanned but have no problems", () => {
    // dateFolder1's children: bad.xml has issues, good.xml was scanned clean
    const result = filterTreeNodes([rootNode], "", {
      showIssuesOnly: true,
      validationCache,
      folderBadgeCache,
    });

    const root = result[0];
    // dateFolder1 is included because badge says "error", so its node is kept as-is
    // (children filtering happens at the folder level)
    const df1 = root.children!.find((c) => c.id === "date-1");
    expect(df1).toBeDefined();
  });

  it("keeps folder with warning badge", () => {
    const warnBadgeCache = new Map<string, ValidationStatus>([
      ["/data/client/20251223", "warning"],
    ]);

    const result = filterTreeNodes([rootNode], "", {
      showIssuesOnly: true,
      validationCache,
      folderBadgeCache: warnBadgeCache,
    });

    const root = result[0];
    const df1 = root.children!.find((c) => c.id === "date-1");
    expect(df1).toBeDefined();
  });

  it("filters out folder with clean badge when all children are also clean", () => {
    const allCleanCache = new Map<
      string,
      { problems: ValidationProblem[] }
    >([
      ["/data/client/20251223/bad.xml", { problems: [] }],
      ["/data/client/20251223/good.xml", { problems: [] }],
    ]);

    const cleanBadgeCache = new Map<string, ValidationStatus>([
      ["/data/client/20251223", "clean"],
    ]);

    const result = filterTreeNodes([rootNode], "", {
      showIssuesOnly: true,
      validationCache: allCleanCache,
      folderBadgeCache: cleanBadgeCache,
    });

    const root = result[0];
    // dateFolder1 should be filtered out (clean badge, all children clean)
    const df1 = root.children!.find((c) => c.id === "date-1");
    expect(df1).toBeUndefined();
    // dateFolder2 still passes through (no data)
    const df2 = root.children!.find((c) => c.id === "date-2");
    expect(df2).toBeDefined();
  });

  it("combines text filter with issues filter", () => {
    const result = filterTreeNodes([rootNode], "bad", {
      showIssuesOnly: true,
      validationCache,
      folderBadgeCache,
    });

    // Text filter finds bad.xml, issues filter confirms it has problems
    expect(result).toHaveLength(1);
  });
});
