import { describe, expect, it } from "vitest";
import { layoutXmlTree, XML_GAP_X, XML_GAP_Y, XML_NODE_HEIGHT, XML_NODE_WIDTH } from "./xml-tree-layout";
import type { VisibleXmlNode } from "./xml-tree-model";

function node(
  id: string,
  parentId: string | null,
  depth: number
): VisibleXmlNode {
  return {
    id,
    parentId,
    depth,
    kind: "element",
    label: id,
    attrs: [],
    childCount: 0,
    hasChildren: false,
    isExpanded: true,
  };
}

describe("layoutXmlTree", () => {
  it("returns empty bounds for no nodes", () => {
    const { positions, bounds } = layoutXmlTree([]);
    expect(positions).toEqual({});
    expect(bounds).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it("places depth on x and stacks leaves in document order on y", () => {
    const nodes = [
      node("0", null, 0),
      node("0.0", "0", 1),
      node("0.1", "0", 1),
    ];
    const { positions } = layoutXmlTree(nodes);
    expect(positions["0.0"].x).toBe(XML_NODE_WIDTH + XML_GAP_X);
    expect(positions["0.1"].x).toBe(XML_NODE_WIDTH + XML_GAP_X);
    expect(positions["0.0"].y).toBe(0);
    expect(positions["0.1"].y).toBe(XML_NODE_HEIGHT + XML_GAP_Y);
  });

  it("centers parents on their first and last child", () => {
    const nodes = [
      node("0", null, 0),
      node("0.0", "0", 1),
      node("0.1", "0", 1),
      node("0.2", "0", 1),
    ];
    const { positions } = layoutXmlTree(nodes);
    expect(positions["0"].y).toBe(
      (positions["0.0"].y + positions["0.2"].y) / 2
    );
  });

  it("keeps collapsed nodes as leaves occupying one row", () => {
    const nodes = [
      node("0", null, 0),
      { ...node("0.0", "0", 1), hasChildren: true, isExpanded: false },
      node("0.1", "0", 1),
    ];
    const { positions } = layoutXmlTree(nodes);
    expect(positions["0.1"].y - positions["0.0"].y).toBe(
      XML_NODE_HEIGHT + XML_GAP_Y
    );
  });

  it("computes bounds spanning the deepest column and the row stack", () => {
    const nodes = [
      node("0", null, 0),
      node("0.0", "0", 1),
      node("0.0.0", "0.0", 2),
      node("0.1", "0", 1),
    ];
    const { bounds } = layoutXmlTree(nodes);
    expect(bounds.width).toBe(2 * (XML_NODE_WIDTH + XML_GAP_X) + XML_NODE_WIDTH);
    expect(bounds.height).toBe(2 * XML_NODE_HEIGHT + XML_GAP_Y);
  });

  it("respects option overrides", () => {
    const nodes = [node("0", null, 0), node("0.0", "0", 1)];
    const { positions } = layoutXmlTree(nodes, {
      nodeWidth: 100,
      gapX: 20,
      nodeHeight: 30,
      gapY: 10,
    });
    expect(positions["0.0"].x).toBe(120);
  });
});
