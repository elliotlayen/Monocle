import { describe, it, expect } from "vitest";
import { filterTreeNodes } from "./tree-filter";
import type { TreeNode } from "../types";

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
