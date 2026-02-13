import { describe, expect, it } from "vitest";
import type { SchemaGraph } from "@/features/schema-graph/types";
import {
  buildAliasMap,
  getAliasContext,
  getSortPrefix,
  getSqlCompletionSources,
  isAfterExecClause,
  isAfterObjectClause,
  quoteIdentifierIfNeeded,
} from "./sql-intellisense";

const schemaFixture: SchemaGraph = {
  tables: [
    {
      id: "dbo.Users",
      name: "Users",
      schema: "dbo",
      columns: [
        {
          name: "Id",
          dataType: "int",
          isNullable: false,
          isPrimaryKey: true,
        },
        {
          name: "Display Name",
          dataType: "nvarchar",
          isNullable: false,
          isPrimaryKey: false,
        },
      ],
    },
  ],
  views: [
    {
      id: "sales.ActiveOrders",
      name: "ActiveOrders",
      schema: "sales",
      columns: [
        {
          name: "OrderId",
          dataType: "int",
          isNullable: false,
          isPrimaryKey: false,
        },
      ],
      definition: "",
      referencedTables: [],
    },
  ],
  relationships: [],
  triggers: [],
  storedProcedures: [
    {
      id: "dbo.sp_GetUsers",
      name: "sp_GetUsers",
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
      id: "dbo.ufn_UserName",
      name: "ufn_UserName",
      schema: "dbo",
      functionType: "SQL_SCALAR_FUNCTION",
      parameters: [],
      returnType: "nvarchar",
      definition: "",
      referencedTables: [],
      affectedTables: [],
    },
  ],
};

describe("sql-intellisense helpers", () => {
  it("detects object and exec clause contexts", () => {
    expect(isAfterObjectClause("SELECT * FROM ")).toBe(true);
    expect(isAfterObjectClause("SELECT * WHERE ")).toBe(false);
    expect(isAfterExecClause("EXEC ")).toBe(true);
    expect(isAfterExecClause("SELECT EXECUTE_COUNT FROM t")).toBe(false);
  });

  it("extracts alias context and alias mappings", () => {
    expect(getAliasContext("SELECT u.")).toBe("u");
    expect(getAliasContext("SELECT [ord] .")).toBe("ord");

    const aliasMap = buildAliasMap(
      "SELECT * FROM dbo.Users u JOIN [sales].[ActiveOrders] ord ON ord.OrderId = u.Id"
    );

    expect(aliasMap.get("u")).toBe("dbo.users");
    expect(aliasMap.get("ord")).toBe("sales.activeorders");
  });

  it("quotes identifiers only when needed", () => {
    expect(quoteIdentifierIfNeeded("Users")).toBe("Users");
    expect(quoteIdentifierIfNeeded("Display Name")).toBe("[Display Name]");
    expect(quoteIdentifierIfNeeded("Bad]Name")).toBe("[Bad]]Name]");
  });

  it("prioritizes context-aware sort buckets", () => {
    const context = {
      afterObjectClause: true,
      afterExecClause: false,
      aliasContext: "u",
      parameterPrefix: false,
    };

    expect(getSortPrefix("object", context)).toBe("00");
    expect(getSortPrefix("column", context)).toBe("02");
    expect(getSortPrefix("keyword", context)).toBe("40");
    expect(getSortPrefix("object", context) < getSortPrefix("keyword", context)).toBe(
      true
    );
  });

  it("returns keyword/snippet fallback when schema is empty", () => {
    const sources = getSqlCompletionSources(null, "SELECT ", "SELECT ");

    expect(sources.objects).toHaveLength(0);
    expect(sources.columns).toHaveLength(0);
    expect(sources.keywords.length).toBeGreaterThan(0);
    expect(sources.snippets.length).toBeGreaterThan(0);
  });

  it("limits column suggestions to alias-resolved object", () => {
    const sql = "SELECT u. FROM dbo.Users u JOIN sales.ActiveOrders ao ON ao.OrderId = u.Id";
    const sources = getSqlCompletionSources(schemaFixture, sql, "SELECT u.");

    expect(sources.columns.length).toBeGreaterThan(0);
    expect(
      sources.columns.every((column) => column.source.id.toLowerCase() === "dbo.users")
    ).toBe(true);
  });
});
