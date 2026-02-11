import { describe, expect, it } from "vitest";
import { deriveEdgeState, type EdgeMeta } from "./edge-state";
import {
  buildColumnHandleBase,
  buildNodeHandleBase,
} from "@/features/schema-graph/utils/handle-ids";

const columnsByNode = new Map<string, Set<string>>([
  ["dbo.orders", new Set(["id", "customer_id"])],
  ["dbo.customers", new Set(["id"])],
  ["dbo.invoices", new Set(["id"])],
]);

const baseEdges: EdgeMeta[] = [
  {
    id: "edge-orders-customers",
    type: "relationships",
    source: "dbo.orders",
    target: "dbo.customers",
    sourceHandle: `${buildNodeHandleBase("dbo.orders")}-source`,
    targetHandle: `${buildNodeHandleBase("dbo.customers")}-target`,
    label: "orders->customers",
  },
  {
    id: "edge-customers-invoices",
    type: "relationships",
    source: "dbo.customers",
    target: "dbo.invoices",
    sourceHandle: `${buildNodeHandleBase("dbo.customers")}-source`,
    targetHandle: `${buildNodeHandleBase("dbo.invoices")}-target`,
    label: "customers->invoices",
  },
  {
    id: "edge-orders-column-customers-column",
    type: "relationships",
    source: "dbo.orders",
    target: "dbo.customers",
    sourceHandle: `${buildColumnHandleBase("dbo.orders", "customer_id")}-source`,
    targetHandle: `${buildColumnHandleBase("dbo.customers", "id")}-target`,
    sourceColumn: "customer_id",
    targetColumn: "id",
    label: "customer_id -> id",
  },
];

function deriveFor(renderableNodeIds: Set<string>) {
  return deriveEdgeState({
    edges: baseEdges,
    edgeTypeFilter: new Set(["relationships"]),
    renderableNodeIds,
    columnsByNodeId: columnsByNode,
    focusedTableId: null,
    selectedEdgeIds: new Set<string>(),
    hoveredEdgeId: null,
    showLabels: false,
    showInlineLabelOnHover: false,
  });
}

describe("deriveEdgeState", () => {
  it("removes edges if source node is not renderable", () => {
    const result = deriveFor(new Set(["dbo.customers", "dbo.invoices"]));
    expect(result.edges.map((edge) => edge.id)).toEqual([
      "edge-customers-invoices",
    ]);
  });

  it("removes edges if target node is not renderable", () => {
    const result = deriveFor(new Set(["dbo.orders", "dbo.customers"]));
    expect(result.edges.map((edge) => edge.id)).toEqual([
      "edge-orders-customers",
      "edge-orders-column-customers-column",
    ]);
  });

  it("removes edges when a column handle is not renderable", () => {
    const result = deriveEdgeState({
      edges: [
        {
          id: "invalid-column-edge",
          type: "relationships",
          source: "dbo.orders",
          target: "dbo.customers",
          sourceHandle: `${buildColumnHandleBase("dbo.orders", "missing")}-source`,
          targetHandle: `${buildColumnHandleBase("dbo.customers", "id")}-target`,
        },
      ],
      edgeTypeFilter: new Set(["relationships"]),
      renderableNodeIds: new Set(["dbo.orders", "dbo.customers"]),
      columnsByNodeId: columnsByNode,
      focusedTableId: null,
      selectedEdgeIds: new Set<string>(),
      hoveredEdgeId: null,
      showLabels: false,
      showInlineLabelOnHover: false,
    });

    expect(result.edges).toEqual([]);
    expect(result.visibleEdgeIds.size).toBe(0);
  });

  it("keeps valid edges and never emits hidden edge objects", () => {
    const result = deriveEdgeState({
      edges: [baseEdges[2]],
      edgeTypeFilter: new Set(["relationships"]),
      renderableNodeIds: new Set(["dbo.orders", "dbo.customers"]),
      columnsByNodeId: columnsByNode,
      focusedTableId: null,
      selectedEdgeIds: new Set(["edge-orders-column-customers-column"]),
      hoveredEdgeId: null,
      showLabels: false,
      showInlineLabelOnHover: false,
    });

    expect(result.edges).toHaveLength(1);
    const edge = result.edges[0];
    expect(edge.id).toBe("edge-orders-column-customers-column");
    expect(edge.style).toMatchObject({ strokeWidth: 4, opacity: 1 });
    expect(edge.markerEnd).toMatchObject({ color: "#2563eb" });
    expect(Object.prototype.hasOwnProperty.call(edge, "hidden")).toBe(false);
  });

  it("stays consistent through full -> focus -> full transitions", () => {
    const allNodes = new Set(["dbo.orders", "dbo.customers", "dbo.invoices"]);
    const full = deriveFor(allNodes);
    expect(full.edges.map((edge) => edge.id)).toEqual([
      "edge-orders-customers",
      "edge-customers-invoices",
      "edge-orders-column-customers-column",
    ]);

    const focused = deriveFor(new Set(["dbo.orders", "dbo.customers"]));
    expect(focused.edges.map((edge) => edge.id)).toEqual([
      "edge-orders-customers",
      "edge-orders-column-customers-column",
    ]);

    const fullAgain = deriveFor(allNodes);
    expect(fullAgain.edges.map((edge) => edge.id)).toEqual([
      "edge-orders-customers",
      "edge-customers-invoices",
      "edge-orders-column-customers-column",
    ]);

    for (const edge of fullAgain.edges) {
      expect(allNodes.has(edge.source)).toBe(true);
      expect(allNodes.has(edge.target)).toBe(true);
    }
  });

  it("does not show inline labels on hover when disabled", () => {
    const result = deriveEdgeState({
      edges: baseEdges,
      edgeTypeFilter: new Set(["relationships"]),
      renderableNodeIds: new Set(["dbo.orders", "dbo.customers", "dbo.invoices"]),
      columnsByNodeId: columnsByNode,
      focusedTableId: null,
      selectedEdgeIds: new Set<string>(),
      hoveredEdgeId: "edge-orders-customers",
      showLabels: false,
      showInlineLabelOnHover: false,
    });

    const hovered = result.edges.find((edge) => edge.id === "edge-orders-customers");
    expect(hovered?.label).toBeUndefined();
  });

  it("shows inline labels on hover when enabled", () => {
    const result = deriveEdgeState({
      edges: baseEdges,
      edgeTypeFilter: new Set(["relationships"]),
      renderableNodeIds: new Set(["dbo.orders", "dbo.customers", "dbo.invoices"]),
      columnsByNodeId: columnsByNode,
      focusedTableId: null,
      selectedEdgeIds: new Set<string>(),
      hoveredEdgeId: "edge-orders-customers",
      showLabels: false,
      showInlineLabelOnHover: true,
    });

    const hovered = result.edges.find((edge) => edge.id === "edge-orders-customers");
    expect(hovered?.label).toBe("orders->customers");
  });
});
