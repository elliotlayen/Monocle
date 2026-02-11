import { describe, expect, it } from "vitest";
import { SchemaGraph as SchemaGraphType } from "../types";
import {
  buildNodeWidthMap,
  ROUTINE_MIN_WIDTH,
  TABLE_VIEW_MIN_WIDTH,
  TRIGGER_MIN_WIDTH,
} from "./node-width";

function buildSchema(overrides?: Partial<SchemaGraphType>): SchemaGraphType {
  return {
    tables: [
      {
        id: "dbo.short_table",
        name: "short_table",
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
        id: "dbo.long_table",
        name: "table_with_a_really_long_identifier_name",
        schema: "dbo",
        columns: [
          {
            name: "column_with_extremely_long_name_used_for_display_testing",
            dataType: "nvarchar(255)",
            isNullable: true,
            isPrimaryKey: false,
          },
        ],
      },
    ],
    views: [
      {
        id: "dbo.sample_view",
        name: "sample_view",
        schema: "dbo",
        columns: [
          {
            name: "id",
            dataType: "int",
            isNullable: false,
            isPrimaryKey: false,
          },
        ],
        definition: "select 1",
        referencedTables: [],
      },
    ],
    relationships: [],
    triggers: [
      {
        id: "dbo.long_table.tr_notify",
        name: "tr_notify_long_events",
        schema: "dbo",
        tableId: "dbo.long_table",
        triggerType: "AFTER",
        isDisabled: false,
        firesOnInsert: true,
        firesOnUpdate: true,
        firesOnDelete: true,
        definition: "",
        referencedTables: [],
        affectedTables: [],
      },
    ],
    storedProcedures: [
      {
        id: "dbo.proc_sync",
        name: "proc_sync",
        schema: "dbo",
        procedureType: "SQL_STORED_PROCEDURE",
        parameters: [
          {
            name: "@super_long_input_parameter_name",
            dataType: "nvarchar(255)",
            isOutput: false,
          },
        ],
        definition: "",
        referencedTables: [],
        affectedTables: [],
      },
    ],
    scalarFunctions: [
      {
        id: "dbo.fn_compute",
        name: "fn_compute",
        schema: "dbo",
        functionType: "SQL_SCALAR_FUNCTION",
        parameters: [
          {
            name: "@extremely_long_function_parameter_name",
            dataType: "decimal(20, 8)",
            isOutput: false,
          },
        ],
        returnType: "nvarchar(1024)",
        definition: "",
        referencedTables: [],
        affectedTables: [],
      },
    ],
    ...overrides,
  };
}

describe("node width map", () => {
  it("grows table width for long column names", () => {
    const schema = buildSchema();
    const widths = buildNodeWidthMap(schema);

    const shortWidth = widths.get("dbo.short_table") ?? TABLE_VIEW_MIN_WIDTH;
    const longWidth = widths.get("dbo.long_table") ?? TABLE_VIEW_MIN_WIDTH;

    expect(shortWidth).toBeGreaterThanOrEqual(TABLE_VIEW_MIN_WIDTH);
    expect(longWidth).toBeGreaterThan(shortWidth);
  });

  it("grows routine widths for long parameter names", () => {
    const schema = buildSchema();
    const widths = buildNodeWidthMap(schema);

    expect(widths.get("dbo.proc_sync")).toBeGreaterThanOrEqual(ROUTINE_MIN_WIDTH);
    expect(widths.get("dbo.fn_compute")).toBeGreaterThanOrEqual(ROUTINE_MIN_WIDTH);
    expect(widths.get("dbo.long_table.tr_notify")).toBeGreaterThanOrEqual(
      TRIGGER_MIN_WIDTH
    );
  });

  it("is deterministic for the same schema input", () => {
    const schema = buildSchema();
    const first = buildNodeWidthMap(schema);
    const second = buildNodeWidthMap(schema);

    expect([...first.entries()]).toEqual([...second.entries()]);
  });
});
