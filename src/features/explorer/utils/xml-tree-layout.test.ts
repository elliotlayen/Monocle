import { describe, expect, it } from "vitest";
import {
  estimateXmlNodeWidth,
  layoutXmlTree,
  XML_GAP_X,
  XML_GAP_Y,
  XML_NODE_HEIGHT,
  XML_NODE_MAX_WIDTH,
  XML_NODE_MIN_WIDTH,
} from "./xml-tree-layout";
import type { VisibleXmlNode } from "./xml-tree-model";

function node(
  id: string,
  parentId: string | null,
  depth: number,
  extra: Partial<VisibleXmlNode> = {}
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
    ...extra,
  };
}

const FIXED = { getWidth: () => 200 };

describe("estimateXmlNodeWidth", () => {
  it("grows with label and attribute content", () => {
    const short = estimateXmlNodeWidth(node("0", null, 0, { label: "a" }));
    const long = estimateXmlNodeWidth(
      node("0", null, 0, {
        label: "VeryLongElementNameForMeasurement",
        attrs: [{ name: "currency", value: "USD" }],
      })
    );
    expect(long).toBeGreaterThan(short);
  });

  it("clamps to min and max", () => {
    const tiny = estimateXmlNodeWidth(node("0", null, 0, { label: "" }));
    expect(tiny).toBe(XML_NODE_MIN_WIDTH);
    const huge = estimateXmlNodeWidth(
      node("0", null, 0, { label: "x".repeat(500) })
    );
    expect(huge).toBe(XML_NODE_MAX_WIDTH);
  });
});

describe("layoutXmlTree", () => {
  it("returns empty bounds for no nodes", () => {
    const { positions, bounds } = layoutXmlTree([]);
    expect(positions).toEqual({});
    expect(bounds).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it("stacks leaves in document order on y", () => {
    const nodes = [
      node("0", null, 0),
      node("0.0", "0", 1),
      node("0.1", "0", 1),
    ];
    const { positions } = layoutXmlTree(nodes, FIXED);
    expect(positions["0.0"].x).toBe(200 + XML_GAP_X);
    expect(positions["0.0"].y).toBe(0);
    expect(positions["0.1"].y).toBe(XML_NODE_HEIGHT + XML_GAP_Y);
  });

  it("sizes each depth column to its widest node", () => {
    const nodes = [
      node("0", null, 0),
      node("0.0", "0", 1),
      node("0.1", "0", 1),
      node("0.1.0", "0.1", 2),
    ];
    const widthsById: Record<string, number> = {
      "0": 150,
      "0.0": 300,
      "0.1": 180,
      "0.1.0": 220,
    };
    const { positions, widths } = layoutXmlTree(nodes, {
      getWidth: (n) => widthsById[n.id],
    });
    expect(widths["0.0"]).toBe(300);
    // depth-1 column starts after depth-0 column (150) + gap
    expect(positions["0.0"].x).toBe(150 + XML_GAP_X);
    // depth-2 column starts after depth-1's widest node (300) + gap
    expect(positions["0.1.0"].x).toBe(150 + XML_GAP_X + 300 + XML_GAP_X);
  });

  it("centers parents on their first and last child", () => {
    const nodes = [
      node("0", null, 0),
      node("0.0", "0", 1),
      node("0.1", "0", 1),
      node("0.2", "0", 1),
    ];
    const { positions } = layoutXmlTree(nodes, FIXED);
    expect(positions["0"].y).toBe(
      (positions["0.0"].y + positions["0.2"].y) / 2
    );
  });

  it("keeps collapsed nodes as leaves occupying one row", () => {
    const nodes = [
      node("0", null, 0),
      node("0.0", "0", 1, { hasChildren: true, isExpanded: false }),
      node("0.1", "0", 1),
    ];
    const { positions } = layoutXmlTree(nodes, FIXED);
    expect(positions["0.1"].y - positions["0.0"].y).toBe(
      XML_NODE_HEIGHT + XML_GAP_Y
    );
  });

  it("computes bounds spanning the column run and the row stack", () => {
    const nodes = [
      node("0", null, 0),
      node("0.0", "0", 1),
      node("0.0.0", "0.0", 2),
      node("0.1", "0", 1),
    ];
    const { bounds } = layoutXmlTree(nodes, FIXED);
    expect(bounds.width).toBe(3 * 200 + 2 * XML_GAP_X);
    expect(bounds.height).toBe(2 * XML_NODE_HEIGHT + XML_GAP_Y);
  });
});
