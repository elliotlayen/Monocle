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
});
