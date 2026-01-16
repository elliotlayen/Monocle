import { create } from "zustand";
import { SchemaGraph, ConnectionParams } from "./types";
import { schemaService } from "./services/schema-service";
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
  connectionInfo: { server: string; database: string } | null;
  preferredSchemaFilter: string;
  focusMode: FocusMode;

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
  setSearchFilter: (search: string) => void;
  setDebouncedSearchFilter: (search: string) => void;
  setSchemaFilter: (schema: string) => void;
  hydrateSettings: (settings: AppSettings) => void;
  setFocusMode: (mode: FocusMode) => void;
  setFocusedTable: (tableId: string | null) => void;
  clearFocus: () => void;
  toggleObjectType: (type: ObjectType) => void;
  setObjectTypeFilter: (types: Set<ObjectType>) => void;
  selectAllObjectTypes: () => void;
  toggleEdgeType: (type: EdgeType) => void;
  selectAllEdgeTypes: () => void;
  toggleEdgeSelection: (edgeId: string) => void;
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
  focusedTableId: null,
  objectTypeFilter: new Set(ALL_OBJECT_TYPES),
  edgeTypeFilter: new Set(ALL_EDGE_TYPES),
  selectedEdgeIds: new Set<string>(),
  availableSchemas: [],
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

  setSearchFilter: (search: string) => set({ searchFilter: search }),

  setDebouncedSearchFilter: (search: string) =>
    set({ debouncedSearchFilter: search }),

  setSchemaFilter: (schema: string) => {
    set({ schemaFilter: schema, preferredSchemaFilter: schema });
    settingsService.saveSettings({ schemaFilter: schema }).catch(() => {
      // Ignore persistence errors
    });
  },

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

  clearEdgeSelection: () => set({ selectedEdgeIds: new Set<string>() }),

  disconnect: () =>
    set({
      schema: null,
      isConnected: false,
      connectionInfo: null,
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
