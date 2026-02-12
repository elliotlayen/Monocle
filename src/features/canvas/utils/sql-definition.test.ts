import { describe, expect, it } from "vitest";
import { parseViewDefinition } from "./sql-definition";
import { buildSchemaIndex } from "@/lib/schema-index";
import type { SchemaGraph } from "@/features/schema-graph/types";

const baseSchema: SchemaGraph = {
  tables: [
    {
      id: "dbo.Tester",
      name: "Tester",
      schema: "dbo",
      columns: [
        {
          name: "hey1",
          dataType: "int",
          isNullable: true,
          isPrimaryKey: false,
        },
        {
          name: "hey2",
          dataType: "int",
          isNullable: true,
          isPrimaryKey: false,
        },
      ],
    },
  ],
  views: [],
  relationships: [],
  triggers: [],
  storedProcedures: [],
  scalarFunctions: [],
};

describe("parseViewDefinition", () => {
  it("maps unqualified select columns to source columns", () => {
    const definition = "select hey1,hey2 from tester;";
    const parsed = parseViewDefinition(definition, baseSchema, {
      defaultSchema: "dbo",
    });

    expect(parsed.columns).toHaveLength(2);
    expect(parsed.columns[0].name).toBe("hey1");
    expect(parsed.columns[1].name).toBe("hey2");
    expect(parsed.columns[0].sourceColumns?.[0]).toEqual({
      table: "dbo.Tester",
      column: "hey1",
    });
    expect(parsed.columns[1].sourceColumns?.[0]).toEqual({
      table: "dbo.Tester",
      column: "hey2",
    });

    const schema: SchemaGraph = {
      ...baseSchema,
      views: [
        {
          id: "dbo.ViewsTest",
          name: "ViewsTest",
          schema: "dbo",
          columns: parsed.columns,
          definition,
          referencedTables: parsed.referencedTables,
        },
      ],
    };

    const index = buildSchemaIndex(schema);
    const sources = index.viewColumnSources.get("dbo.ViewsTest") ?? [];
    expect(sources).toHaveLength(2);
    expect(sources.map((source) => source.columnName).sort()).toEqual([
      "hey1",
      "hey2",
    ]);
  });

  it("extracts sources from ISNULL expressions", () => {
    const schema: SchemaGraph = {
      ...baseSchema,
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
            {
              name: "total",
              dataType: "money",
              isNullable: true,
              isPrimaryKey: false,
            },
          ],
        },
      ],
    };

    const parsed = parseViewDefinition(
      `
      CREATE VIEW dbo.v_orders_total AS
      SELECT ISNULL(o.total, 0) AS total_safe
      FROM dbo.orders o
      `,
      schema,
      { defaultSchema: "dbo" }
    );

    expect(parsed.columns).toHaveLength(1);
    expect(parsed.columns[0].name).toBe("total_safe");
    expect(parsed.columns[0].sourceColumns?.[0]).toEqual({
      table: "dbo.orders",
      column: "total",
    });
  });

  it("extracts sources from CASE expressions and mixed select lists", () => {
    const schema: SchemaGraph = {
      ...baseSchema,
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
            {
              name: "status",
              dataType: "nvarchar(20)",
              isNullable: true,
              isPrimaryKey: false,
            },
            {
              name: "total",
              dataType: "money",
              isNullable: true,
              isPrimaryKey: false,
            },
          ],
        },
      ],
    };

    const parsed = parseViewDefinition(
      `
      CREATE VIEW dbo.v_orders_summary AS
      SELECT
        o.id,
        ISNULL(o.total, 0) AS total_safe,
        CASE WHEN o.status = 'paid' THEN o.status ELSE 'open' END AS status_label
      FROM dbo.orders o
      `,
      schema,
      { defaultSchema: "dbo" }
    );

    expect(parsed.columns).toHaveLength(3);
    expect(parsed.columns[0].name).toBe("id");
    expect(parsed.columns[1].name).toBe("total_safe");
    expect(parsed.columns[2].name).toBe("status_label");

    expect(parsed.columns[0].sourceColumns?.[0]).toEqual({
      table: "dbo.orders",
      column: "id",
    });
    expect(parsed.columns[1].sourceColumns?.[0]).toEqual({
      table: "dbo.orders",
      column: "total",
    });
    expect(parsed.columns[2].sourceColumns?.[0]).toEqual({
      table: "dbo.orders",
      column: "status",
    });
  });
});
