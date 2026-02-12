import { describe, expect, it } from "vitest";
import { buildSchemaIndex } from "./schema-index";
import type { SchemaGraph } from "@/features/schema-graph/types";

describe("buildSchemaIndex", () => {
  it("adds bidirectional neighbors for view referencedTables fallback", () => {
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
      ],
      views: [
        {
          id: "dbo.order_summary",
          name: "order_summary",
          schema: "dbo",
          columns: [
            {
              name: "order_id",
              dataType: "int",
              isNullable: false,
              isPrimaryKey: false,
            },
          ],
          definition: "SELECT o.id AS order_id FROM dbo.orders o",
          referencedTables: ["orders"],
        },
      ],
      relationships: [],
      triggers: [],
      storedProcedures: [],
      scalarFunctions: [],
    };

    const index = buildSchemaIndex(schema);

    expect(index.neighbors.get("dbo.order_summary")?.has("dbo.orders")).toBe(
      true
    );
    expect(index.neighbors.get("dbo.orders")?.has("dbo.order_summary")).toBe(
      true
    );
  });
});
