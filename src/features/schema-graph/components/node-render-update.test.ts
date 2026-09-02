import { type Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";
import { applyNodeRenderPatch } from "./node-render-update";

function buildNode(): Node {
  return {
    id: "dbo.orders",
    type: "tableNode",
    position: { x: 10, y: 20 },
    data: {
      isFocused: false,
      isDimmed: false,
      isCompact: false,
      nodeWidth: 320,
    },
  };
}

describe("applyNodeRenderPatch", () => {
  it("restyles routine nodes on compact change without a geometry change", () => {
    const node: Node = {
      ...buildNode(),
      id: "dbo.trg_audit",
      type: "triggerNode",
    };
    const result = applyNodeRenderPatch(node, {
      position: { x: 10, y: 20 },
      hidden: false,
      isFocused: false,
      isDimmed: false,
      nodeWidth: 320,
      isCompact: true,
      includeTableViewFields: false,
    });

    expect(result.changed).toBe(true);
    expect(result.geometryChanged).toBe(false);
    expect(result.node.data.isCompact).toBe(true);
  });

  it("returns the same node reference for no-op updates", () => {
    const node = buildNode();
    const result = applyNodeRenderPatch(node, {
      position: { x: 10, y: 20 },
      hidden: false,
      isFocused: false,
      isDimmed: false,
      nodeWidth: 320,
      isCompact: false,
      includeTableViewFields: true,
    });

    expect(result.node).toBe(node);
    expect(result.changed).toBe(false);
    expect(result.geometryChanged).toBe(false);
  });

  it("preserves data reference when only hidden/position changes", () => {
    const node = buildNode();
    const result = applyNodeRenderPatch(node, {
      position: { x: 20, y: 30 },
      hidden: true,
      isFocused: false,
      isDimmed: false,
      nodeWidth: 320,
      isCompact: false,
      includeTableViewFields: true,
    });

    expect(result.node).not.toBe(node);
    expect(result.node.data).toBe(node.data);
    expect(result.changed).toBe(true);
    expect(result.geometryChanged).toBe(true);
  });

  it("marks non-geometry data updates correctly", () => {
    const node = buildNode();
    const result = applyNodeRenderPatch(node, {
      position: { x: 10, y: 20 },
      hidden: false,
      isFocused: false,
      isDimmed: false,
      nodeWidth: 320,
      isCompact: false,
      columnsWithHandles: new Set(["dbo.orders:id"]),
      includeTableViewFields: true,
    });

    expect(result.node).not.toBe(node);
    expect(result.changed).toBe(true);
    expect(result.geometryChanged).toBe(false);
  });
});
