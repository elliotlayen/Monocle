import { describe, expect, it } from "vitest";
import { type Edge } from "@xyflow/react";
import { buildEdgeHoverCardContent } from "./edge-hover-card";

describe("buildEdgeHoverCardContent", () => {
  it("returns title and column-qualified endpoints when label and columns are present", () => {
    const edge = {
      id: "fk-orders-customers",
      source: "dbo.orders",
      target: "dbo.customers",
      data: {
        edgeLabel: "customer_id -> id",
        sourceColumn: "customer_id",
        targetColumn: "id",
      },
    } as unknown as Edge;

    expect(buildEdgeHoverCardContent(edge)).toEqual({
      title: "customer_id -> id",
      from: { objectId: "dbo.orders", column: "customer_id" },
      to: { objectId: "dbo.customers", column: "id" },
    });
  });

  it("returns object-level endpoints and no title when label/columns are absent", () => {
    const edge = {
      id: "proc-edge",
      source: "dbo.orders",
      target: "dbo.sp_refresh_orders",
      data: {},
    } as unknown as Edge;

    expect(buildEdgeHoverCardContent(edge)).toEqual({
      title: undefined,
      from: { objectId: "dbo.orders", column: undefined },
      to: { objectId: "dbo.sp_refresh_orders", column: undefined },
    });
  });

  it("trims label and column names before formatting", () => {
    const edge = {
      id: "fk-orders-customers",
      source: "dbo.orders",
      target: "dbo.customers",
      data: {
        edgeLabel: "  customer_id -> id  ",
        sourceColumn: " customer_id ",
        targetColumn: " id ",
      },
    } as unknown as Edge;

    expect(buildEdgeHoverCardContent(edge)).toEqual({
      title: "customer_id -> id",
      from: { objectId: "dbo.orders", column: "customer_id" },
      to: { objectId: "dbo.customers", column: "id" },
    });
  });
});
