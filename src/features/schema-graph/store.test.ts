import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  useSchemaStore,
  createInitialSchemaState,
  selectGraphDisplay,
  selectNodeStyle,
} from "./store";
import { schemaService } from "./services/schema-service";
import { settingsService } from "@/features/settings/services/settings-service";

vi.mock("./services/schema-service", () => ({
  schemaService: {
    loadSchema: vi.fn(),
    loadMockSchema: vi.fn(),
  },
}));

vi.mock("@/features/settings/services/settings-service", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/settings/services/settings-service")
  >("@/features/settings/services/settings-service");
  return {
    ...actual,
    settingsService: {
      saveSettings: vi.fn().mockResolvedValue({}),
    },
  };
});

const mockedSchemaService = vi.mocked(schemaService);
const ALL_OBJECT_TYPES = [
  "scalarFunctions",
  "storedProcedures",
  "tables",
  "triggers",
  "views",
];

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
    const displayTotal = view.columns.find(
      (column) => column.name === "display_total"
    );
    const statusLabel = view.columns.find(
      (column) => column.name === "status_label"
    );
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
      excludedObjectIds: new Set(["sales.orders"]),
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
    expect(Array.from(state.excludedObjectIds)).toEqual(["sales.orders"]);
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
      objectTypeFilter: new Set(["views"]),
      excludedObjectIds: new Set(["dbo.customers"]),
    });

    const ok = await useSchemaStore.getState().refreshSelectedDatabase();

    expect(ok).toBe(true);
    const state = useSchemaStore.getState();
    expect(state.focusedTableId).toBeNull();
    expect(Array.from(state.objectTypeFilter).sort()).toEqual(ALL_OBJECT_TYPES);
    expect(state.excludedObjectIds.size).toBe(0);
  });

  it("returns false with clear errors when missing connection or selected database", async () => {
    const withoutConnection = await useSchemaStore
      .getState()
      .refreshSelectedDatabase();
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

    const withoutDatabase = await useSchemaStore
      .getState()
      .refreshSelectedDatabase();
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

  it("prunes excluded object IDs that no longer exist after refresh", async () => {
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
      excludedObjectIds: new Set(["sales.orders", "dbo.customers"]),
    });

    const ok = await useSchemaStore.getState().refreshSelectedDatabase();
    const state = useSchemaStore.getState();

    expect(ok).toBe(true);
    expect(Array.from(state.excludedObjectIds)).toEqual(["dbo.customers"]);
  });
});

describe("useSchemaStore object filters", () => {
  beforeEach(() => {
    useSchemaStore.setState(createInitialSchemaState());
    vi.clearAllMocks();
  });

  it("toggles object exclusions by ID", () => {
    const store = useSchemaStore.getState();

    store.toggleObjectExclusion("dbo.orders");
    expect(Array.from(useSchemaStore.getState().excludedObjectIds)).toEqual([
      "dbo.orders",
    ]);

    store.toggleObjectExclusion("dbo.orders");
    expect(useSchemaStore.getState().excludedObjectIds.size).toBe(0);
  });

  it("resetObjectFilters restores all types and clears exclusions", () => {
    useSchemaStore.setState({
      objectTypeFilter: new Set(["tables"]),
      excludedObjectIds: new Set(["dbo.orders"]),
    });

    useSchemaStore.getState().resetObjectFilters();
    const state = useSchemaStore.getState();

    expect(Array.from(state.objectTypeFilter).sort()).toEqual(ALL_OBJECT_TYPES);
    expect(state.excludedObjectIds.size).toBe(0);
  });
});

describe("useSchemaStore focus transitions", () => {
  beforeEach(() => {
    useSchemaStore.setState(createInitialSchemaState());
    vi.clearAllMocks();
  });

  it("resets object filters when starting focus", () => {
    useSchemaStore.setState({
      objectTypeFilter: new Set(["views"]),
      excludedObjectIds: new Set(["dbo.orders_view"]),
    });

    useSchemaStore.getState().setFocusedTable("dbo.orders");
    const state = useSchemaStore.getState();

    expect(state.focusedTableId).toBe("dbo.orders");
    expect(Array.from(state.objectTypeFilter).sort()).toEqual(ALL_OBJECT_TYPES);
    expect(state.excludedObjectIds.size).toBe(0);
  });

  it("resets object filters when changing focus target", () => {
    useSchemaStore.setState({
      focusedTableId: "dbo.orders",
      objectTypeFilter: new Set(["views"]),
      excludedObjectIds: new Set(["dbo.orders_view"]),
    });

    useSchemaStore.getState().setFocusedTable("dbo.customers");
    const state = useSchemaStore.getState();

    expect(state.focusedTableId).toBe("dbo.customers");
    expect(Array.from(state.objectTypeFilter).sort()).toEqual(ALL_OBJECT_TYPES);
    expect(state.excludedObjectIds.size).toBe(0);
  });

  it("resets object filters when clearing focus", () => {
    useSchemaStore.setState({
      focusedTableId: "dbo.orders",
      objectTypeFilter: new Set(["views"]),
      excludedObjectIds: new Set(["dbo.orders_view"]),
    });

    useSchemaStore.getState().clearFocus();
    const state = useSchemaStore.getState();

    expect(state.focusedTableId).toBeNull();
    expect(Array.from(state.objectTypeFilter).sort()).toEqual(ALL_OBJECT_TYPES);
    expect(state.excludedObjectIds.size).toBe(0);
  });

  it("does not reset object filters when focus target is unchanged", () => {
    useSchemaStore.setState({
      focusedTableId: "dbo.orders",
      objectTypeFilter: new Set(["views"]),
      excludedObjectIds: new Set(["dbo.orders_view"]),
    });

    useSchemaStore.getState().setFocusedTable("dbo.orders");
    const state = useSchemaStore.getState();

    expect(state.focusedTableId).toBe("dbo.orders");
    expect(Array.from(state.objectTypeFilter)).toEqual(["views"]);
    expect(Array.from(state.excludedObjectIds)).toEqual(["dbo.orders_view"]);
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

  it("hydrates nodeStyle when the value is valid", () => {
    useSchemaStore.getState().hydrateSettings({ nodeStyle: "solid" });

    expect(useSchemaStore.getState().nodeStyle).toBe("solid");
  });

  it("keeps the default nodeStyle when the value is invalid", () => {
    useSchemaStore.getState().hydrateSettings({ nodeStyle: "neon" as never });

    expect(useSchemaStore.getState().nodeStyle).toBe("adaptive");
  });

  it("persists nodeStyle through setNodeStyle", () => {
    useSchemaStore.getState().setNodeStyle("surface");

    expect(useSchemaStore.getState().nodeStyle).toBe("surface");
    expect(settingsService.saveSettings).toHaveBeenCalledWith({
      nodeStyle: "surface",
    });
  });

  it("hydrates canvas display settings independently of the schema ones", () => {
    useSchemaStore.getState().hydrateSettings({
      nodeStyle: "solid",
      canvasNodeStyle: "tinted",
      canvasEdgeLabelMode: "never",
      canvasShowMiniMap: false,
      canvasDetailViewMode: "drawer",
    });

    const state = useSchemaStore.getState();
    expect(state.nodeStyle).toBe("solid");
    expect(state.canvasNodeStyle).toBe("tinted");
    expect(state.canvasEdgeLabelMode).toBe("never");
    expect(state.canvasShowMiniMap).toBe(false);
    expect(state.canvasDetailViewMode).toBe("drawer");
    expect(state.edgeLabelMode).toBe("auto");
    expect(state.showMiniMap).toBe(true);
    expect(state.detailViewMode).toBe("inspector");
  });

  it("keeps canvas defaults when persisted canvas values are invalid", () => {
    useSchemaStore.getState().hydrateSettings({
      nodeStyle: "surface",
      canvasNodeStyle: "neon" as never,
      canvasEdgeLabelMode: "sometimes" as never,
      canvasDetailViewMode: "popover" as never,
    });

    const state = useSchemaStore.getState();
    expect(state.canvasNodeStyle).toBe("adaptive");
    expect(state.canvasEdgeLabelMode).toBe("auto");
    expect(state.canvasDetailViewMode).toBe("inspector");
  });

  it("persists each canvas setting under its own key", () => {
    const store = useSchemaStore.getState();
    store.setCanvasNodeStyle("solid");
    store.setCanvasEdgeLabelMode("always");
    store.setCanvasShowMiniMap(false);
    store.setCanvasDetailViewMode("drawer");

    expect(settingsService.saveSettings).toHaveBeenCalledWith({
      canvasNodeStyle: "solid",
    });
    expect(settingsService.saveSettings).toHaveBeenCalledWith({
      canvasEdgeLabelMode: "always",
    });
    expect(settingsService.saveSettings).toHaveBeenCalledWith({
      canvasShowMiniMap: false,
    });
    expect(settingsService.saveSettings).toHaveBeenCalledWith({
      canvasDetailViewMode: "drawer",
    });
    expect(useSchemaStore.getState().nodeStyle).toBe("adaptive");
  });

  it("selects the display set for the active mode", () => {
    useSchemaStore.getState().hydrateSettings({
      nodeStyle: "solid",
      showMiniMap: false,
      canvasNodeStyle: "tinted",
      canvasShowMiniMap: true,
    });
    const state = useSchemaStore.getState();

    expect(selectGraphDisplay(state, false)).toEqual({
      nodeStyle: "solid",
      edgeLabelMode: "auto",
      showMiniMap: false,
      detailViewMode: "inspector",
    });
    expect(selectGraphDisplay(state, true)).toEqual({
      nodeStyle: "tinted",
      edgeLabelMode: "auto",
      showMiniMap: true,
      detailViewMode: "inspector",
    });
    expect(selectNodeStyle(false)(state)).toBe("solid");
    expect(selectNodeStyle(true)(state)).toBe("tinted");
  });
});
