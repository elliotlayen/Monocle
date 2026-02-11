import { describe, expect, it } from "vitest";
import {
  isEdgeRenderable,
  isHandleRenderable,
} from "./edge-visibility";
import {
  buildColumnHandleBase,
  buildNodeHandleBase,
} from "@/features/schema-graph/utils/handle-ids";

describe("edge visibility helpers", () => {
  const columnsByNode = new Map<string, Set<string>>([
    ["dbo.orders", new Set(["id", "customer_id"])],
    ["dbo.customers", new Set(["id"])],
  ]);

  it("hides edges if source node is not renderable", () => {
    const renderableNodes = new Set(["dbo.customers"]);
    const edge = {
      source: "dbo.orders",
      target: "dbo.customers",
      sourceHandle: `${buildNodeHandleBase("dbo.orders")}-source`,
      targetHandle: `${buildNodeHandleBase("dbo.customers")}-target`,
    };
    expect(isEdgeRenderable(edge, renderableNodes, columnsByNode)).toBe(false);
  });

  it("hides edges if target node is not renderable", () => {
    const renderableNodes = new Set(["dbo.orders"]);
    const edge = {
      source: "dbo.orders",
      target: "dbo.customers",
      sourceHandle: `${buildNodeHandleBase("dbo.orders")}-source`,
      targetHandle: `${buildNodeHandleBase("dbo.customers")}-target`,
    };
    expect(isEdgeRenderable(edge, renderableNodes, columnsByNode)).toBe(false);
  });

  it("hides edges when source column handle is missing", () => {
    const renderableNodes = new Set(["dbo.orders", "dbo.customers"]);
    const edge = {
      source: "dbo.orders",
      target: "dbo.customers",
      sourceHandle: `${buildColumnHandleBase("dbo.orders", "unknown")}-source`,
      targetHandle: `${buildColumnHandleBase("dbo.customers", "id")}-target`,
    };
    expect(isEdgeRenderable(edge, renderableNodes, columnsByNode)).toBe(false);
  });

  it("renders edges when nodes and handles are valid", () => {
    const renderableNodes = new Set(["dbo.orders", "dbo.customers"]);
    const edge = {
      source: "dbo.orders",
      target: "dbo.customers",
      sourceHandle: `${buildColumnHandleBase("dbo.orders", "customer_id")}-source`,
      targetHandle: `${buildColumnHandleBase("dbo.customers", "id")}-target`,
    };
    expect(isEdgeRenderable(edge, renderableNodes, columnsByNode)).toBe(true);
  });

  it("supports node-level handles", () => {
    const renderableNodes = new Set(["dbo.orders"]);
    const handle = `${buildNodeHandleBase("dbo.orders")}-source`;
    expect(isHandleRenderable(handle, renderableNodes, columnsByNode)).toBe(
      true
    );
  });
});
