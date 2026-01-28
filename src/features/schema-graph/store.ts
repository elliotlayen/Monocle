import { create } from "zustand";
import { SchemaGraph, ConnectionParams, ServerConnectionParams } from "./types";
import { schemaService } from "./services/schema-service";
import { databaseService } from "@/features/connection/services/database-service";
import {
  settingsService,
  type AppSettings,
  type FocusMode,
} from "@/features/settings/services/settings-service";

export type ObjectType = "tables" | "views" | "triggers" | "storedProcedures" | "scalarFunctions";

export type EdgeType =
  | "foreignKeys"
  | "triggerDependencies"
  | "triggerWrites"
  | "procedureReads"
  | "procedureWrites"
  | "viewDependencies"
  | "functionReads";

interface SchemaStore {
  // State
  schema: SchemaGraph | null;
  isLoading: boolean;
  error: string | null;
  isConnected: boolean;
  connectionInfo: { server: string; database?: string } | null;
  preferredSchemaFilter: string;
  focusMode: FocusMode;
  focusExpandThreshold: number;

  // Server connection state
  serverConnection: ServerConnectionParams | null;
  availableDatabases: string[];
  selectedDatabase: string | null;
  isDatabasesLoading: boolean;

  // Filters
  searchFilter: string;
  debouncedSearchFilter: string;
  schemaFilter: string;
  focusedTableId: string | null;
  objectTypeFilter: Set<ObjectType>;
  edgeTypeFilter: Set<EdgeType>;

  // Selection
  selectedEdgeIds: Set<string>;

  // Derived data
  availableSchemas: string[];

  // Actions
  loadMockSchema: (size: string) => Promise<boolean>;
  loadSchema: (params: ConnectionParams) => Promise<boolean>;
  connectToServer: (params: ServerConnectionParams) => Promise<boolean>;
  selectDatabase: (database: string) => Promise<boolean>;
  disconnectServer: () => void;
  setSearchFilter: (search: string) => void;
  setDebouncedSearchFilter: (search: string) => void;
  setSchemaFilter: (schema: string) => void;
  clearError: () => void;
  hydrateSettings: (settings: AppSettings) => void;
  setFocusMode: (mode: FocusMode) => void;
  setFocusExpandThreshold: (threshold: number) => void;
  setFocusedTable: (tableId: string | null) => void;
  clearFocus: () => void;
  toggleObjectType: (type: ObjectType) => void;
  setObjectTypeFilter: (types: Set<ObjectType>) => void;
  selectAllObjectTypes: () => void;
  toggleEdgeType: (type: EdgeType) => void;
  selectAllEdgeTypes: () => void;
  toggleEdgeSelection: (edgeId: string) => void;
  setSelectedEdgeIds: (ids: Set<string>) => void;
  clearEdgeSelection: () => void;
  disconnect: () => void;
}

const ALL_OBJECT_TYPES: Set<ObjectType> = new Set([
  "tables",
  "views",
  "triggers",
  "storedProcedures",
  "scalarFunctions",
]);

const ALL_EDGE_TYPES: Set<EdgeType> = new Set([
  "foreignKeys",
  "triggerDependencies",
  "triggerWrites",
  "procedureReads",
  "procedureWrites",
  "viewDependencies",
  "functionReads",
]);

export const createInitialSchemaState = () => ({
  schema: null,
  isLoading: false,
  error: null,
  isConnected: false,
  connectionInfo: null,
  searchFilter: "",
  debouncedSearchFilter: "",
  schemaFilter: "all",
  preferredSchemaFilter: "all",
  focusMode: "fade" as FocusMode,
  focusExpandThreshold: 15,
  focusedTableId: null,
  objectTypeFilter: new Set(ALL_OBJECT_TYPES),
  edgeTypeFilter: new Set(ALL_EDGE_TYPES),
  selectedEdgeIds: new Set<string>(),
  availableSchemas: [],
  // Server connection state
  serverConnection: null,
  availableDatabases: [] as string[],
  selectedDatabase: null,
  isDatabasesLoading: false,
});

const getAvailableSchemas = (schema: SchemaGraph) => {
  const schemas = new Set<string>();
  schema.tables.forEach((table) => schemas.add(table.schema));
  (schema.views || []).forEach((view) => schemas.add(view.schema));
  (schema.triggers || []).forEach((trigger) => schemas.add(trigger.schema));
  (schema.storedProcedures || []).forEach((procedure) => schemas.add(procedure.schema));
  (schema.scalarFunctions || []).forEach((fn) => schemas.add(fn.schema));
  return [...schemas];
};

const areSetsEqual = <T,>(a: Set<T>, b: Set<T>): boolean => {
  if (a.size !== b.size) return false;
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
};

export const useSchemaStore = create<SchemaStore>((set, get) => ({
  // Initial state
  ...createInitialSchemaState(),

  loadMockSchema: async (size: string) => {
    set({ isLoading: true, error: null });
    try {
      const schema = await schemaService.loadMockSchema(size);
      const schemas = getAvailableSchemas(schema);
      const preferredSchemaFilter = get().preferredSchemaFilter;
      const resolvedSchemaFilter =
        preferredSchemaFilter === "all" || schemas.includes(preferredSchemaFilter)
          ? preferredSchemaFilter
          : "all";
      set({
        schema,
        isLoading: false,
        isConnected: true,
        connectionInfo: { server: "localhost", database: "MockDB" },
        availableSchemas: schemas,
        schemaFilter: resolvedSchemaFilter,
        objectTypeFilter: new Set(ALL_OBJECT_TYPES),
        edgeTypeFilter: new Set(ALL_EDGE_TYPES),
      });
      return true;
    } catch (err) {
      set({ error: String(err), isLoading: false });
      return false;
    }
  },

  loadSchema: async (params: ConnectionParams) => {
    set({ isLoading: true, error: null });
    try {
      const schema = await schemaService.loadSchema(params);
      const schemas = getAvailableSchemas(schema);
      const preferredSchemaFilter = get().preferredSchemaFilter;
      const resolvedSchemaFilter =
        preferredSchemaFilter === "all" || schemas.includes(preferredSchemaFilter)
          ? preferredSchemaFilter
          : "all";
      set({
        schema,
        isLoading: false,
        isConnected: true,
        connectionInfo: { server: params.server, database: params.database },
        availableSchemas: schemas,
        selectedDatabase: params.database,
        // Reset filters on new connection
        searchFilter: "",
        debouncedSearchFilter: "",
        schemaFilter: resolvedSchemaFilter,
        focusedTableId: null,
        objectTypeFilter: new Set(ALL_OBJECT_TYPES),
        edgeTypeFilter: new Set(ALL_EDGE_TYPES),
        selectedEdgeIds: new Set<string>(),
      });
      return true;
    } catch (err) {
      set({ error: String(err), isLoading: false });
      return false;
    }
  },

  connectToServer: async (params: ServerConnectionParams) => {
    set({ isDatabasesLoading: true, error: null });
    try {
      const databases = await databaseService.listDatabases(params);
      set({
        serverConnection: params,
        availableDatabases: databases,
        isDatabasesLoading: false,
        isConnected: true,
        connectionInfo: { server: params.server },
        // Reset schema state
        schema: null,
        selectedDatabase: null,
        availableSchemas: [],
        searchFilter: "",
        debouncedSearchFilter: "",
        schemaFilter: "all",
        focusedTableId: null,
        objectTypeFilter: new Set(ALL_OBJECT_TYPES),
        edgeTypeFilter: new Set(ALL_EDGE_TYPES),
        selectedEdgeIds: new Set<string>(),
      });
      return true;
    } catch (err) {
      set({ error: String(err), isDatabasesLoading: false });
      return false;
    }
  },

  selectDatabase: async (database: string) => {
    const serverConnection = get().serverConnection;
    if (!serverConnection) {
      set({ error: "Not connected to server" });
      return false;
    }

    set({ isLoading: true, error: null });
    try {
      const params: ConnectionParams = {
        server: serverConnection.server,
        database,
        authType: serverConnection.authType,
        username: serverConnection.username,
        password: serverConnection.password,
        trustServerCertificate: serverConnection.trustServerCertificate,
      };

      const schema = await schemaService.loadSchema(params);
      const schemas = getAvailableSchemas(schema);
      const preferredSchemaFilter = get().preferredSchemaFilter;
      const resolvedSchemaFilter =
        preferredSchemaFilter === "all" || schemas.includes(preferredSchemaFilter)
          ? preferredSchemaFilter
          : "all";

      set({
        schema,
        isLoading: false,
        selectedDatabase: database,
        connectionInfo: { server: serverConnection.server, database },
        availableSchemas: schemas,
        // Reset filters on database change
        searchFilter: "",
        debouncedSearchFilter: "",
        schemaFilter: resolvedSchemaFilter,
        focusedTableId: null,
        objectTypeFilter: new Set(ALL_OBJECT_TYPES),
        edgeTypeFilter: new Set(ALL_EDGE_TYPES),
        selectedEdgeIds: new Set<string>(),
      });
      return true;
    } catch (err) {
      set({ error: String(err), isLoading: false });
      return false;
    }
  },

  disconnectServer: () =>
    set({
      schema: null,
      isConnected: false,
      connectionInfo: null,
      serverConnection: null,
      availableDatabases: [],
      selectedDatabase: null,
      searchFilter: "",
      debouncedSearchFilter: "",
      schemaFilter: "all",
      focusedTableId: null,
      objectTypeFilter: new Set(ALL_OBJECT_TYPES),
      edgeTypeFilter: new Set(ALL_EDGE_TYPES),
      selectedEdgeIds: new Set<string>(),
      availableSchemas: [],
      error: null,
    }),

  setSearchFilter: (search: string) => set({ searchFilter: search }),

  setDebouncedSearchFilter: (search: string) =>
    set({ debouncedSearchFilter: search }),

  setSchemaFilter: (schema: string) => {
    set({ schemaFilter: schema, preferredSchemaFilter: schema });
    settingsService.saveSettings({ schemaFilter: schema }).catch(() => {
      // Ignore persistence errors
    });
  },

  clearError: () => set({ error: null }),

  hydrateSettings: (settings: AppSettings) => {
    const updates: Partial<SchemaStore> = {};

    if (settings.schemaFilter) {
      const availableSchemas = get().availableSchemas;
      const resolvedSchemaFilter =
        settings.schemaFilter === "all" || availableSchemas.includes(settings.schemaFilter)
          ? settings.schemaFilter
          : "all";
      updates.preferredSchemaFilter = settings.schemaFilter;
      if (get().schema) {
        updates.schemaFilter = resolvedSchemaFilter;
      }
    }

    if (settings.focusMode) {
      updates.focusMode = settings.focusMode;
    }

    if (settings.focusExpandThreshold !== undefined) {
      updates.focusExpandThreshold = settings.focusExpandThreshold;
    }

    if (Object.keys(updates).length > 0) {
      set(updates);
    }
  },

  setFocusMode: (mode: FocusMode) => {
    set({ focusMode: mode });
    settingsService.saveSettings({ focusMode: mode }).catch(() => {
      // Ignore persistence errors
    });
  },

  setFocusExpandThreshold: (threshold: number) => {
    set({ focusExpandThreshold: threshold });
    settingsService.saveSettings({ focusExpandThreshold: threshold }).catch(() => {
      // Ignore persistence errors
    });
  },

  setFocusedTable: (tableId: string | null) => set({ focusedTableId: tableId }),

  clearFocus: () => set({ focusedTableId: null }),

  toggleObjectType: (type: ObjectType) =>
    set((state) => {
      const newFilter = new Set(state.objectTypeFilter);
      if (newFilter.has(type)) {
        newFilter.delete(type);
      } else {
        newFilter.add(type);
      }
      return { objectTypeFilter: newFilter };
    }),

  setObjectTypeFilter: (types: Set<ObjectType>) =>
    set({ objectTypeFilter: types }),

  selectAllObjectTypes: () =>
    set({ objectTypeFilter: new Set(ALL_OBJECT_TYPES) }),

  toggleEdgeType: (type: EdgeType) =>
    set((state) => {
      const newFilter = new Set(state.edgeTypeFilter);
      if (newFilter.has(type)) {
        newFilter.delete(type);
      } else {
        newFilter.add(type);
      }
      return { edgeTypeFilter: newFilter };
    }),

  selectAllEdgeTypes: () =>
    set({ edgeTypeFilter: new Set(ALL_EDGE_TYPES) }),

  toggleEdgeSelection: (edgeId: string) =>
    set((state) => {
      const newSelection = new Set(state.selectedEdgeIds);
      if (newSelection.has(edgeId)) {
        newSelection.delete(edgeId);
      } else {
        newSelection.add(edgeId);
      }
      return { selectedEdgeIds: newSelection };
    }),

  setSelectedEdgeIds: (ids: Set<string>) =>
    set((state) => {
      if (ids === state.selectedEdgeIds) return state;
      if (areSetsEqual(state.selectedEdgeIds, ids)) return state;
      return { selectedEdgeIds: ids };
    }),

  clearEdgeSelection: () =>
    set((state) =>
      state.selectedEdgeIds.size === 0 ? state : { selectedEdgeIds: new Set<string>() }
    ),

  disconnect: () =>
    set({
      schema: null,
      isConnected: false,
      connectionInfo: null,
      serverConnection: null,
      availableDatabases: [],
      selectedDatabase: null,
      searchFilter: "",
      debouncedSearchFilter: "",
      schemaFilter: "all",
      focusedTableId: null,
      objectTypeFilter: new Set(ALL_OBJECT_TYPES),
      edgeTypeFilter: new Set(ALL_EDGE_TYPES),
      selectedEdgeIds: new Set<string>(),
      availableSchemas: [],
      error: null,
    }),
}));
