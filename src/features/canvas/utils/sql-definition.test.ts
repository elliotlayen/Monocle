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
});
