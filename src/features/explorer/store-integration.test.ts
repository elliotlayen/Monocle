import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSchemaStore, createInitialSchemaState } from "@/features/schema-graph/store";

vi.mock("@/features/schema-graph/services/schema-service", () => ({
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

describe("explorer mode", () => {
  beforeEach(() => {
    useSchemaStore.setState(createInitialSchemaState());
    vi.clearAllMocks();
  });

  it("enterExplorerMode sets mode to explorer", () => {
    useSchemaStore.getState().enterExplorerMode();
    expect(useSchemaStore.getState().mode).toBe("explorer");
  });

  it("exitExplorerMode sets mode to connected", () => {
    useSchemaStore.getState().enterExplorerMode();
    expect(useSchemaStore.getState().mode).toBe("explorer");
    useSchemaStore.getState().exitExplorerMode();
    expect(useSchemaStore.getState().mode).toBe("connected");
  });

  it("enterExplorerMode preserves existing state through round trip", () => {
    // Set up some state before entering explorer
    useSchemaStore.setState({
      isConnected: true,
      connectionInfo: { server: "localhost", database: "TestDB" },
      serverConnection: {
        server: "localhost",
        authType: "sqlServer",
        username: "sa",
        password: "pass",
        trustServerCertificate: true,
      },
      schema: {
        tables: [
          {
            id: "dbo.Users",
            name: "Users",
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
        views: [],
        relationships: [],
        triggers: [],
        storedProcedures: [],
        scalarFunctions: [],
      },
    });

    const stateBefore = useSchemaStore.getState();

    // Enter and exit explorer mode
    useSchemaStore.getState().enterExplorerMode();
    useSchemaStore.getState().exitExplorerMode();

    const stateAfter = useSchemaStore.getState();

    // Key state fields should be preserved
    expect(stateAfter.schema).toBe(stateBefore.schema);
    expect(stateAfter.isConnected).toBe(stateBefore.isConnected);
    expect(stateAfter.connectionInfo).toBe(stateBefore.connectionInfo);
    expect(stateAfter.serverConnection).toBe(stateBefore.serverConnection);
  });

  it("explorer mode is distinct from connected and canvas", () => {
    // Start in connected mode
    expect(useSchemaStore.getState().mode).toBe("connected");

    // Enter explorer
    useSchemaStore.getState().enterExplorerMode();
    const explorerMode = useSchemaStore.getState().mode;
    expect(explorerMode).toBe("explorer");
    expect(explorerMode).not.toBe("connected");
    expect(explorerMode).not.toBe("canvas");

    // Exit returns to connected
    useSchemaStore.getState().exitExplorerMode();
    expect(useSchemaStore.getState().mode).toBe("connected");
  });
});
