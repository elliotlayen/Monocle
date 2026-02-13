import { describe, expect, it } from "vitest";
import { getFilteredObjectBuckets } from "./object-filtering";
import type { SchemaGraph } from "../types";
import type { ObjectType } from "../store";

const baseSchema: SchemaGraph = {
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
    {
      id: "dbo.audit",
      name: "audit",
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
      id: "dbo.orders_view",
      name: "orders_view",
      schema: "dbo",
      definition: "SELECT o.id FROM dbo.orders o",
      referencedTables: ["dbo.orders"],
      columns: [
        {
          name: "id",
          dataType: "int",
          isNullable: false,
          isPrimaryKey: false,
          sourceColumns: [{ table: "dbo.orders", column: "id" }],
        },
      ],
    },
  ],
  relationships: [
    {
      id: "FK_dbo.orders__dbo.customers",
      from: "dbo.orders",
      to: "dbo.customers",
    },
  ],
  triggers: [
    {
      id: "dbo.orders.trg_orders",
      name: "trg_orders",
      schema: "dbo",
      tableId: "dbo.orders",
      triggerType: "AFTER",
      isDisabled: false,
      firesOnInsert: true,
      firesOnUpdate: false,
      firesOnDelete: false,
      definition: "",
      referencedTables: ["dbo.orders"],
      affectedTables: ["dbo.orders"],
    },
    {
      id: "dbo.audit.trg_audit",
      name: "trg_audit",
      schema: "dbo",
      tableId: "dbo.audit",
      triggerType: "AFTER",
      isDisabled: false,
      firesOnInsert: true,
      firesOnUpdate: false,
      firesOnDelete: false,
      definition: "",
      referencedTables: ["dbo.audit"],
      affectedTables: ["dbo.audit"],
    },
  ],
  storedProcedures: [
    {
      id: "dbo.usp_orders",
      name: "usp_orders",
      schema: "dbo",
      procedureType: "SQL_STORED_PROCEDURE",
      parameters: [],
      definition: "",
      referencedTables: ["dbo.orders"],
      affectedTables: [],
    },
    {
      id: "dbo.usp_audit",
      name: "usp_audit",
      schema: "dbo",
      procedureType: "SQL_STORED_PROCEDURE",
      parameters: [],
      definition: "",
      referencedTables: ["dbo.audit"],
      affectedTables: [],
    },
  ],
  scalarFunctions: [
    {
      id: "dbo.fn_orders",
      name: "fn_orders",
      schema: "dbo",
      functionType: "SQL_SCALAR_FUNCTION",
      parameters: [],
      returnType: "int",
      definition: "",
      referencedTables: ["dbo.orders"],
      affectedTables: [],
    },
    {
      id: "dbo.fn_audit",
      name: "fn_audit",
      schema: "dbo",
      functionType: "SQL_SCALAR_FUNCTION",
      parameters: [],
      returnType: "int",
      definition: "",
      referencedTables: ["dbo.audit"],
      affectedTables: [],
    },
  ],
};

const ALL_TYPES = new Set<ObjectType>([
  "tables",
  "views",
  "triggers",
  "storedProcedures",
  "scalarFunctions",
]);

describe("getFilteredObjectBuckets", () => {
  it("restricts objects by focus across supported types", () => {
    const buckets = getFilteredObjectBuckets({
      schema: baseSchema,
      searchFilter: "",
      schemaFilter: "all",
      objectTypeFilter: ALL_TYPES,
      excludedObjectIds: new Set(),
      focusedTableId: "dbo.orders",
    });

    expect(buckets.tables.map((t) => t.id).sort()).toEqual([
      "dbo.customers",
      "dbo.orders",
    ]);
    expect(buckets.views.map((v) => v.id)).toEqual(["dbo.orders_view"]);
    expect(buckets.triggers.map((t) => t.id)).toEqual(["dbo.orders.trg_orders"]);
    expect(buckets.storedProcedures.map((p) => p.id)).toEqual([
      "dbo.usp_orders",
    ]);
    expect(buckets.scalarFunctions.map((f) => f.id)).toEqual(["dbo.fn_orders"]);
  });

  it("removes explicitly excluded IDs from filtered buckets", () => {
    const buckets = getFilteredObjectBuckets({
      schema: baseSchema,
      searchFilter: "",
      schemaFilter: "all",
      objectTypeFilter: ALL_TYPES,
      excludedObjectIds: new Set(["dbo.orders_view", "dbo.usp_orders"]),
      focusedTableId: null,
    });

    expect(buckets.views.map((v) => v.id)).toEqual([]);
    expect(buckets.storedProcedures.map((p) => p.id)).toEqual(["dbo.usp_audit"]);
  });

  it("applies schema/search/type gates together", () => {
    const buckets = getFilteredObjectBuckets({
      schema: baseSchema,
      searchFilter: "customer",
      schemaFilter: "dbo",
      objectTypeFilter: new Set(["tables"]),
      excludedObjectIds: new Set(),
      focusedTableId: null,
    });

    expect(buckets.tables.map((t) => t.id)).toEqual(["dbo.customers"]);
    expect(buckets.views.length).toBe(0);
    expect(buckets.triggers.length).toBe(0);
  });

  it("keeps trigger parent and routine reference constraints when focused", () => {
    const buckets = getFilteredObjectBuckets({
      schema: baseSchema,
      searchFilter: "",
      schemaFilter: "all",
      objectTypeFilter: new Set(["triggers", "storedProcedures", "scalarFunctions", "tables"]),
      excludedObjectIds: new Set(),
      focusedTableId: "dbo.orders",
    });

    expect(buckets.triggers.map((t) => t.tableId)).toEqual(["dbo.orders"]);
    expect(buckets.storedProcedures.map((p) => p.id)).toEqual(["dbo.usp_orders"]);
    expect(buckets.scalarFunctions.map((f) => f.id)).toEqual(["dbo.fn_orders"]);
  });
});
