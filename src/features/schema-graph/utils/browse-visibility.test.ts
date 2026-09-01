import { describe, expect, it } from "vitest";

import {
  computeBrowseVisibleIds,
  countHiddenNeighbors,
} from "./browse-visibility";
import { buildSchemaIndex } from "@/lib/schema-index";
import type { SchemaGraph } from "../types";

function makeTable(id: string) {
  const [schema, name] = id.split(".");
  return { id, name, schema, columns: [] };
}

// Chain: A -> B -> C -> D, plus isolated E.
const schema: SchemaGraph = {
  tables: ["dbo.A", "dbo.B", "dbo.C", "dbo.D", "dbo.E"].map(makeTable),
  views: [],
  relationships: [
    { id: "ab", from: "dbo.A", to: "dbo.B" },
    { id: "bc", from: "dbo.B", to: "dbo.C" },
    { id: "cd", from: "dbo.C", to: "dbo.D" },
  ],
  triggers: [],
  storedProcedures: [],
  scalarFunctions: [],
};

const index = buildSchemaIndex(schema);

describe("computeBrowseVisibleIds", () => {
  it("returns null outside browse mode", () => {
    expect(
      computeBrowseVisibleIds("full", new Set(["dbo.A"]), new Set(), index)
    ).toBeNull();
  });

  it("shows roots plus direct neighbors", () => {
    const visible = computeBrowseVisibleIds(
      "browse",
      new Set(["dbo.B"]),
      new Set(),
      index
    );
    expect([...visible!].sort()).toEqual(["dbo.A", "dbo.B", "dbo.C"]);
  });

  it("walks outward through expansions", () => {
    const visible = computeBrowseVisibleIds(
      "browse",
      new Set(["dbo.A"]),
      new Set(["dbo.B", "dbo.C"]),
      index
    );
    expect([...visible!].sort()).toEqual(["dbo.A", "dbo.B", "dbo.C", "dbo.D"]);
  });

  it("ignores expansions whose node is not visible", () => {
    const visible = computeBrowseVisibleIds(
      "browse",
      new Set(["dbo.A"]),
      new Set(["dbo.D"]),
      index
    );
    expect([...visible!].sort()).toEqual(["dbo.A", "dbo.B"]);
  });

  it("is empty with no roots", () => {
    const visible = computeBrowseVisibleIds(
      "browse",
      new Set(),
      new Set(),
      index
    );
    expect(visible!.size).toBe(0);
  });
});

describe("countHiddenNeighbors", () => {
  it("counts neighbors outside the visible set", () => {
    const visible = computeBrowseVisibleIds(
      "browse",
      new Set(["dbo.A"]),
      new Set(),
      index
    )!;
    // B is visible; its neighbor C is not.
    expect(countHiddenNeighbors("dbo.B", visible, index)).toBe(1);
    expect(countHiddenNeighbors("dbo.A", visible, index)).toBe(0);
  });
});
