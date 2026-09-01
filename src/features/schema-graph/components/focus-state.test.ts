import { describe, expect, it } from "vitest";

import { computeFocusState } from "./focus-state";
import { getFilteredObjectBuckets } from "../utils/object-filtering";
import { buildSchemaIndex } from "@/lib/schema-index";
import type { SchemaGraph } from "../types";

function makeTable(id: string) {
  const [schema, name] = id.split(".");
  return { id, name, schema, columns: [] };
}

const schema: SchemaGraph = {
  tables: [makeTable("dbo.Child"), makeTable("dbo.Parent"), makeTable("dbo.Island")],
  views: [],
  relationships: [
    {
      id: "fk-child-parent",
      from: "dbo.Child",
      to: "dbo.Parent",
    },
  ],
  triggers: [
    {
      id: "dbo.Island.trg_island",
      name: "trg_island",
      schema: "dbo",
      tableId: "dbo.Island",
      triggerType: "AFTER",
      isDisabled: false,
      firesOnInsert: true,
      firesOnUpdate: false,
      firesOnDelete: false,
      definition: "",
      referencedTables: [],
      affectedTables: [],
    },
  ],
  storedProcedures: [
    {
      id: "dbo.usp_touch_parent",
      name: "usp_touch_parent",
      schema: "dbo",
      procedureType: "SQL_STORED_PROCEDURE",
      parameters: [],
      definition: "",
      referencedTables: ["dbo.Parent"],
      affectedTables: [],
    },
  ],
  scalarFunctions: [],
};

function stateFor(focusedTableId: string | null) {
  const schemaIndex = buildSchemaIndex(schema);
  const visibility = getFilteredObjectBuckets({
    schema,
    searchFilter: "",
    schemaFilter: "",
    objectTypeFilter: new Set([
      "tables",
      "views",
      "triggers",
      "storedProcedures",
      "scalarFunctions",
    ]),
    excludedObjectIds: new Set(),
    focusedTableId: null,
    schemaIndex,
  });
  return computeFocusState(visibility, focusedTableId, schemaIndex);
}

describe("computeFocusState", () => {
  it("dims nothing without a focused node", () => {
    const state = stateFor(null);
    expect(state.dimmedNodeIds.size).toBe(0);
    expect(state.renderableNodeIds.has("dbo.Island")).toBe(true);
    expect(state.visibleNonDimmedCount).toBe(3);
  });

  it("dims non-neighbors of the focused node", () => {
    const state = stateFor("dbo.Child");
    expect(state.dimmedNodeIds.has("dbo.Island")).toBe(true);
    expect(state.dimmedNodeIds.has("dbo.Parent")).toBe(false);
    expect(state.dimmedNodeIds.has("dbo.Child")).toBe(false);
    expect(state.renderableNodeIds.has("dbo.Island")).toBe(false);
    expect(state.visibleNonDimmedCount).toBe(2);
  });

  it("dims triggers of non-neighbor tables and keeps procedures touching the neighborhood", () => {
    const state = stateFor("dbo.Child");
    expect(state.dimmedNodeIds.has("dbo.Island.trg_island")).toBe(true);
    // usp_touch_parent references dbo.Parent, a neighbor of the focus.
    expect(state.dimmedNodeIds.has("dbo.usp_touch_parent")).toBe(false);
  });

  it("dims procedures with no reference into the neighborhood", () => {
    const state = stateFor("dbo.Island");
    expect(state.dimmedNodeIds.has("dbo.usp_touch_parent")).toBe(true);
  });
});
