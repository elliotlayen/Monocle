import { describe, expect, it } from "vitest";

import { calculateCompactLayout } from "./focus-layout";
import type { DirectedEdge } from "./layout";
import type { SchemaGraph } from "../types";

function makeTable(id: string) {
  const [schema, name] = id.split(".");
  return { id, name, schema, columns: [] };
}

function makeSchema(tableIds: string[]): SchemaGraph {
  return {
    tables: tableIds.map(makeTable),
    views: [],
    relationships: [],
    triggers: [],
    storedProcedures: [],
    scalarFunctions: [],
  };
}

function layout(
  focusedId: string,
  schema: SchemaGraph,
  directedEdges: DirectedEdge[]
) {
  const allIds = schema.tables.map((t) => t.id);
  const neighbors = new Set(allIds.filter((id) => id !== focusedId));
  return calculateCompactLayout(
    focusedId,
    new Set(allIds),
    neighbors,
    schema,
    new Map(),
    new Map(),
    directedEdges
  );
}

describe("calculateCompactLayout direction", () => {
  const schema = makeSchema(["dbo.Child", "dbo.Parent"]);
  // Directed edges flow child -> parent, same as relationship edges.
  const edges: DirectedEdge[] = [{ from: "dbo.Child", to: "dbo.Parent" }];

  it("places nodes the focused node points at on the right", () => {
    const positions = layout("dbo.Child", schema, edges);
    expect(positions.get("dbo.Child")).toEqual({ x: 0, y: 0 });
    expect(positions.get("dbo.Parent")!.x).toBeGreaterThan(0);
  });

  it("places nodes pointing at the focused node on the left", () => {
    const positions = layout("dbo.Parent", schema, edges);
    expect(positions.get("dbo.Parent")).toEqual({ x: 0, y: 0 });
    expect(positions.get("dbo.Child")!.x).toBeLessThan(0);
  });

  it("places bidirectional neighbors on the right", () => {
    const cyclic: DirectedEdge[] = [
      { from: "dbo.Child", to: "dbo.Parent" },
      { from: "dbo.Parent", to: "dbo.Child" },
    ];
    const positions = layout("dbo.Child", schema, cyclic);
    expect(positions.get("dbo.Parent")!.x).toBeGreaterThan(0);
  });
});
