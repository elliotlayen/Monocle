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

  it("builds id lookup maps and call-edge neighbors", () => {
    const schema: SchemaGraph = {
      tables: [{ id: "dbo.orders", name: "orders", schema: "dbo", columns: [] }],
      views: [],
      relationships: [],
      triggers: [
        {
          id: "dbo.orders.trg_audit",
          name: "trg_audit",
          schema: "dbo",
          tableId: "dbo.orders",
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
          id: "dbo.usp_process",
          name: "usp_process",
          schema: "dbo",
          procedureType: "SQL_STORED_PROCEDURE",
          parameters: [],
          definition: "",
          referencedTables: [],
          affectedTables: [],
        },
      ],
      scalarFunctions: [
        {
          id: "dbo.fn_total",
          name: "fn_total",
          schema: "dbo",
          functionType: "SQL_SCALAR_FUNCTION",
          parameters: [],
          returnType: "int",
          definition: "",
          referencedTables: [],
          affectedTables: [],
        },
      ],
      codeDependencies: [{ from: "dbo.usp_process", to: "dbo.fn_total" }],
    };

    const index = buildSchemaIndex(schema);

    expect(index.tableById.get("dbo.orders")?.name).toBe("orders");
    expect(index.triggerById.get("dbo.orders.trg_audit")?.tableId).toBe(
      "dbo.orders"
    );
    expect(index.procedureById.get("dbo.usp_process")?.name).toBe(
      "usp_process"
    );
    expect(index.functionById.get("dbo.fn_total")?.name).toBe("fn_total");
    expect(index.neighbors.get("dbo.usp_process")?.has("dbo.fn_total")).toBe(
      true
    );
    expect(index.neighbors.get("dbo.fn_total")?.has("dbo.usp_process")).toBe(
      true
    );
  });
});
