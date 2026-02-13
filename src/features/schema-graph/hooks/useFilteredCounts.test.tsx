import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { useFilteredCounts, type FilteredCounts } from "./useFilteredCounts";
import type { SchemaGraph } from "../types";
import type { ObjectType, EdgeType } from "../store";

const schema: SchemaGraph = {
  tables: [
    {
      id: "dbo.orders",
      name: "orders",
      schema: "dbo",
      columns: [
        {
          name: "id",
          dataType: "int",
          isNullable: false,
          isPrimaryKey: true,
        },
      ],
    },
    {
      id: "dbo.customers",
      name: "customers",
      schema: "dbo",
      columns: [
        {
          name: "id",
          dataType: "int",
          isNullable: false,
          isPrimaryKey: true,
        },
      ],
    },
  ],
  views: [],
  relationships: [
    {
      id: "FK_dbo.orders__dbo.customers",
      from: "dbo.orders",
      to: "dbo.customers",
    },
  ],
  triggers: [],
  storedProcedures: [],
  scalarFunctions: [],
};

function evaluateCounts(params: {
  objectTypeFilter: Set<ObjectType>;
  excludedObjectIds: Set<string>;
  edgeTypeFilter?: Set<EdgeType>;
  searchFilter?: string;
  schemaFilter?: string;
  focusedTableId?: string | null;
}) {
  let value: FilteredCounts | null = null;

  function Test() {
    value = useFilteredCounts(
      schema,
      params.searchFilter ?? "",
      params.schemaFilter ?? "all",
      params.objectTypeFilter,
      params.excludedObjectIds,
      params.edgeTypeFilter ?? new Set(["relationships"]),
      params.focusedTableId ?? null
    );
    return null;
  }

  renderToString(<Test />);
  return value as unknown as FilteredCounts;
}

describe("useFilteredCounts object exclusion", () => {
  it("hides a type even when specific objects are excluded", () => {
    const counts = evaluateCounts({
      objectTypeFilter: new Set(["views"]),
      excludedObjectIds: new Set(["dbo.orders"]),
    });

    expect(counts.breakdown.tables.filtered).toBe(0);
    expect(counts.filteredObjects).toBe(0);
    expect(counts.filteredEdges).toBe(0);
  });

  it("hides only excluded objects when the type is enabled", () => {
    const counts = evaluateCounts({
      objectTypeFilter: new Set(["tables"]),
      excludedObjectIds: new Set(["dbo.orders"]),
    });

    expect(counts.breakdown.tables.filtered).toBe(1);
    expect(counts.breakdown.tables.total).toBe(2);
    expect(counts.filteredObjects).toBe(1);
  });

  it("removes edges whose source or target becomes hidden", () => {
    const counts = evaluateCounts({
      objectTypeFilter: new Set(["tables"]),
      excludedObjectIds: new Set(["dbo.customers"]),
    });

    expect(counts.filteredEdges).toBe(0);
    expect(counts.edgeBreakdown.relationships.filtered).toBe(0);
    expect(counts.edgeBreakdown.relationships.total).toBe(1);
  });

  it("applies focus constraints to counts", () => {
    const counts = evaluateCounts({
      objectTypeFilter: new Set(["tables"]),
      excludedObjectIds: new Set(),
      focusedTableId: "dbo.orders",
    });

    expect(counts.breakdown.tables.filtered).toBe(2);
    expect(counts.filteredEdges).toBe(1);
  });
});
