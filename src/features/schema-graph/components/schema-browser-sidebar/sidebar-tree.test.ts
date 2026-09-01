import { describe, expect, it } from "vitest";

import { buildTree, countSchemaGroups, flattenTree } from "./sidebar-tree";
import type { SchemaGraph } from "../../types";

function makeTable(id: string) {
  const [schema, name] = id.split(".");
  return { id, name, schema, columns: [] };
}

const schema: SchemaGraph = {
  tables: [
    makeTable("sales.Order"),
    makeTable("dbo.Zebra"),
    makeTable("dbo.Apple"),
  ],
  views: [
    {
      id: "dbo.v_orders",
      name: "v_orders",
      schema: "dbo",
      columns: [],
      definition: "",
      referencedTables: [],
    },
  ],
  relationships: [],
  triggers: [],
  storedProcedures: [],
  scalarFunctions: [],
};

describe("buildTree", () => {
  it("groups by schema and sorts schemas and items alphabetically", () => {
    const tree = buildTree(schema);
    expect(tree.map((c) => c.type)).toEqual(["tables", "views"]);

    const tables = tree[0];
    expect(tables.count).toBe(3);
    expect(tables.schemas.map((s) => s.name)).toEqual(["dbo", "sales"]);
    expect(tables.schemas[0].items.map((i) => i.name)).toEqual([
      "Apple",
      "Zebra",
    ]);
    expect(tables.schemas[0].key).toBe("tables-dbo");
  });

  it("omits empty categories", () => {
    const tree = buildTree(schema);
    expect(tree.some((c) => c.type === "triggers")).toBe(false);
  });

  it("counts schema groups across categories", () => {
    expect(countSchemaGroups(buildTree(schema))).toBe(3);
  });
});

describe("flattenTree", () => {
  const tree = buildTree(schema);

  it("emits only category rows when collapsed", () => {
    const rows = flattenTree({
      tree,
      expandedCategories: new Set(),
      expandedSchemas: new Set(),
      matchIds: null,
      forceExpand: false,
      graphVisibleIds: null,
    });
    expect(rows.map((r) => r.kind)).toEqual(["category", "category"]);
  });

  it("expands categories and schema groups per the expansion sets", () => {
    const rows = flattenTree({
      tree,
      expandedCategories: new Set(["tables"]),
      expandedSchemas: new Set(["tables-dbo"]),
      matchIds: null,
      forceExpand: false,
      graphVisibleIds: null,
    });
    expect(rows.map((r) => r.key)).toEqual([
      "category-tables",
      "schema-tables-dbo",
      "item-dbo.Apple",
      "item-dbo.Zebra",
      "schema-tables-sales",
      "category-views",
    ]);
  });

  it("filters to matching items and drops empty categories", () => {
    const rows = flattenTree({
      tree,
      expandedCategories: new Set(),
      expandedSchemas: new Set(),
      matchIds: new Set(["dbo.Apple"]),
      forceExpand: true,
      graphVisibleIds: null,
    });
    expect(rows.map((r) => r.key)).toEqual([
      "category-tables",
      "schema-tables-dbo",
      "item-dbo.Apple",
    ]);
  });

  it("does not force expansion for short queries", () => {
    const rows = flattenTree({
      tree,
      expandedCategories: new Set(),
      expandedSchemas: new Set(),
      matchIds: new Set(["dbo.Apple"]),
      forceExpand: false,
      graphVisibleIds: null,
    });
    expect(rows.map((r) => r.kind)).toEqual(["category"]);
    expect(rows[0]).toMatchObject({ total: 1 });
  });

  it("dims items outside the graph-visible set and reports shown/total", () => {
    const rows = flattenTree({
      tree,
      expandedCategories: new Set(["tables"]),
      expandedSchemas: new Set(["tables-dbo"]),
      matchIds: null,
      forceExpand: false,
      graphVisibleIds: new Set(["dbo.Apple"]),
    });
    const category = rows.find((r) => r.key === "category-tables");
    expect(category).toMatchObject({ shown: 1, total: 3 });
    const apple = rows.find((r) => r.key === "item-dbo.Apple");
    const zebra = rows.find((r) => r.key === "item-dbo.Zebra");
    expect(apple).toMatchObject({ dimmed: false });
    expect(zebra).toMatchObject({ dimmed: true });
  });
});
