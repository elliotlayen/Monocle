import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSchemaStore, createInitialSchemaState } from "./store";
import { schemaService } from "./services/schema-service";

vi.mock("./services/schema-service", () => ({
  schemaService: {
    loadSchema: vi.fn(),
    loadMockSchema: vi.fn(),
  },
}));

vi.mock("@/features/settings/services/settings-service", () => ({
  settingsService: {
    saveSettings: vi.fn(),
  },
}));

const mockedSchemaService = vi.mocked(schemaService);

const baseSchema = {
  tables: [
    {
      id: "sales.orders",
      name: "orders",
      schema: "sales",
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
  relationships: [],
  triggers: [],
  storedProcedures: [],
  scalarFunctions: [],
};

describe("useSchemaStore.loadSchema", () => {
  beforeEach(() => {
    useSchemaStore.setState(createInitialSchemaState());
    vi.clearAllMocks();
  });

  it("applies preferred schema filter when available", async () => {
    mockedSchemaService.loadSchema.mockResolvedValue(baseSchema);
    useSchemaStore.setState({ preferredSchemaFilter: "sales" });

    const ok = await useSchemaStore.getState().loadSchema({
      server: "localhost",
      database: "Monocle",
      authType: "sqlServer",
    });

    expect(ok).toBe(true);
    expect(useSchemaStore.getState().schemaFilter).toBe("sales");
    expect(useSchemaStore.getState().isConnected).toBe(true);
  });

  it("falls back to all when preferred schema is missing", async () => {
    mockedSchemaService.loadSchema.mockResolvedValue(baseSchema);
    useSchemaStore.setState({ preferredSchemaFilter: "missing" });

    const ok = await useSchemaStore.getState().loadSchema({
      server: "localhost",
      database: "Monocle",
      authType: "sqlServer",
    });

    expect(ok).toBe(true);
    expect(useSchemaStore.getState().schemaFilter).toBe("all");
  });

  it("returns false on failure and keeps disconnected", async () => {
    mockedSchemaService.loadSchema.mockRejectedValue(new Error("boom"));

    const ok = await useSchemaStore.getState().loadSchema({
      server: "localhost",
      database: "Monocle",
      authType: "sqlServer",
    });

    expect(ok).toBe(false);
    expect(useSchemaStore.getState().isConnected).toBe(false);
    expect(useSchemaStore.getState().error).toBeTruthy();
  });

  it("backfills missing view lineage from definition while preserving backend types", async () => {
    const schemaWithComputedView = {
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
            {
              name: "status",
              dataType: "nvarchar(20)",
              isNullable: true,
              isPrimaryKey: false,
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
              name: "display_total",
              dataType: "money",
              isNullable: false,
              isPrimaryKey: false,
            },
            {
              name: "status_label",
              dataType: "nvarchar(50)",
              isNullable: true,
              isPrimaryKey: false,
            },
            {
              name: "id",
              dataType: "int",
              isNullable: false,
              isPrimaryKey: false,
              sourceTable: "dbo.orders",
              sourceColumn: "existing_id",
            },
          ],
          definition: `
            CREATE VIEW dbo.order_summary AS
            SELECT
              ISNULL(o.total, 0) AS display_total,
              CASE WHEN o.status = 'paid' THEN o.status ELSE 'open' END AS status_label,
              o.id
            FROM dbo.orders o
          `,
          referencedTables: ["orders"],
        },
      ],
      relationships: [],
      triggers: [],
      storedProcedures: [],
      scalarFunctions: [],
    };

    mockedSchemaService.loadSchema.mockResolvedValue(schemaWithComputedView);

    const ok = await useSchemaStore.getState().loadSchema({
      server: "localhost",
      database: "Monocle",
      authType: "sqlServer",
    });

    expect(ok).toBe(true);

    const loadedSchema = useSchemaStore.getState().schema;
    expect(loadedSchema).toBeTruthy();

    const view = loadedSchema!.views[0];
    const displayTotal = view.columns.find((column) => column.name === "display_total");
    const statusLabel = view.columns.find((column) => column.name === "status_label");
    const idColumn = view.columns.find((column) => column.name === "id");

    expect(displayTotal?.dataType).toBe("money");
    expect(displayTotal?.isNullable).toBe(false);
    expect(displayTotal?.sourceColumns?.[0]).toEqual({
      table: "dbo.orders",
      column: "total",
    });

    expect(statusLabel?.dataType).toBe("nvarchar(50)");
    expect(statusLabel?.sourceColumns?.[0]).toEqual({
      table: "dbo.orders",
      column: "status",
    });

    expect(idColumn?.sourceTable).toBe("dbo.orders");
    expect(idColumn?.sourceColumn).toBe("existing_id");
    expect(view.referencedTables).toEqual(["dbo.orders"]);
  });
});

describe("useSchemaStore.refreshSelectedDatabase", () => {
  beforeEach(() => {
    useSchemaStore.setState(createInitialSchemaState());
    vi.clearAllMocks();
  });

  it("refreshes schema and preserves filters/search/focus when focused object still exists", async () => {
    mockedSchemaService.loadSchema.mockResolvedValue(baseSchema);

    useSchemaStore.setState({
      schema: baseSchema,
      isConnected: true,
      serverConnection: {
        server: "localhost",
        authType: "sqlServer",
        username: "sa",
        password: "secret",
        trustServerCertificate: true,
      },
      selectedDatabase: "Monocle",
      connectionInfo: { server: "localhost", database: "Monocle" },
      searchFilter: "orders",
      debouncedSearchFilter: "orders",
      schemaFilter: "sales",
      objectTypeFilter: new Set(["tables"]),
      edgeTypeFilter: new Set(["relationships"]),
      focusedTableId: "sales.orders",
      selectedEdgeIds: new Set(["FK_sales.orders__sales.orders"]),
    });

    const ok = await useSchemaStore.getState().refreshSelectedDatabase();
    const state = useSchemaStore.getState();

    expect(ok).toBe(true);
    expect(state.searchFilter).toBe("orders");
    expect(state.debouncedSearchFilter).toBe("orders");
    expect(state.schemaFilter).toBe("sales");
    expect(Array.from(state.objectTypeFilter)).toEqual(["tables"]);
    expect(Array.from(state.edgeTypeFilter)).toEqual(["relationships"]);
    expect(state.focusedTableId).toBe("sales.orders");
    expect(state.selectedEdgeIds.size).toBe(0);
    expect(state.connectionInfo).toEqual({
      server: "localhost",
      database: "Monocle",
    });
  });

  it("clears focus when refreshed schema no longer contains focused object", async () => {
    mockedSchemaService.loadSchema.mockResolvedValue({
      ...baseSchema,
      tables: [
        {
          id: "dbo.customers",
          name: "customers",
          schema: "dbo",
          columns: [],
        },
      ],
    });

    useSchemaStore.setState({
      isConnected: true,
      serverConnection: {
        server: "localhost",
        authType: "sqlServer",
        username: "sa",
        password: "secret",
        trustServerCertificate: true,
      },
      selectedDatabase: "Monocle",
      focusedTableId: "sales.orders",
    });

    const ok = await useSchemaStore.getState().refreshSelectedDatabase();

    expect(ok).toBe(true);
    expect(useSchemaStore.getState().focusedTableId).toBeNull();
  });

  it("returns false with clear errors when missing connection or selected database", async () => {
    const withoutConnection =
      await useSchemaStore.getState().refreshSelectedDatabase();
    expect(withoutConnection).toBe(false);
    expect(useSchemaStore.getState().error).toBe("Not connected to server");

    useSchemaStore.setState({
      serverConnection: {
        server: "localhost",
        authType: "sqlServer",
        username: "sa",
        password: "secret",
        trustServerCertificate: true,
      },
      selectedDatabase: null,
    });

    const withoutDatabase =
      await useSchemaStore.getState().refreshSelectedDatabase();
    expect(withoutDatabase).toBe(false);
    expect(useSchemaStore.getState().error).toBe("No database selected");
  });

  it("returns false on refresh failure, sets error, and keeps existing schema", async () => {
    mockedSchemaService.loadSchema.mockRejectedValue(new Error("boom"));

    useSchemaStore.setState({
      schema: baseSchema,
      isConnected: true,
      serverConnection: {
        server: "localhost",
        authType: "sqlServer",
        username: "sa",
        password: "secret",
        trustServerCertificate: true,
      },
      selectedDatabase: "Monocle",
    });

    const ok = await useSchemaStore.getState().refreshSelectedDatabase();
    const state = useSchemaStore.getState();

    expect(ok).toBe(false);
    expect(state.schema).toBe(baseSchema);
    expect(state.error).toContain("boom");
  });
});

describe("useSchemaStore.hydrateSettings", () => {
  beforeEach(() => {
    useSchemaStore.setState(createInitialSchemaState());
    vi.clearAllMocks();
  });

  it("hydrates edgeLabelMode and showMiniMap when values are valid", () => {
    useSchemaStore.getState().hydrateSettings({
      edgeLabelMode: "always",
      showMiniMap: false,
    });

    expect(useSchemaStore.getState().edgeLabelMode).toBe("always");
    expect(useSchemaStore.getState().showMiniMap).toBe(false);
  });

  it("falls back to auto when edgeLabelMode is invalid", () => {
    useSchemaStore.getState().hydrateSettings({
      edgeLabelMode: "invalid" as never,
    });

    expect(useSchemaStore.getState().edgeLabelMode).toBe("auto");
  });
});
