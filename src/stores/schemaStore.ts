import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { SchemaGraph, ConnectionParams } from "@/types/schema";

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
  loadMockSchema: (size: string) => Promise<void>;
  loadSchema: (params: ConnectionParams) => Promise<void>;
  setSearchFilter: (search: string) => void;
  setDebouncedSearchFilter: (search: string) => void;
  setSchemaFilter: (schema: string) => void;
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

export const useSchemaStore = create<SchemaStore>((set) => ({
  // Initial state
  schema: null,
  isLoading: false,
  error: null,
  isConnected: false,
  connectionInfo: null,
  searchFilter: "",
  debouncedSearchFilter: "",
  schemaFilter: "all",
  focusedTableId: null,
  objectTypeFilter: new Set(ALL_OBJECT_TYPES),
  edgeTypeFilter: new Set(ALL_EDGE_TYPES),
  selectedEdgeIds: new Set(),
  availableSchemas: [],

  loadMockSchema: async (size: string) => {
    set({ isLoading: true, error: null });
    try {
      const schema = await invoke<SchemaGraph>("load_schema_mock", { size });
      const tableSchemas = schema.tables.map((t) => t.schema);
      const viewSchemas = schema.views.map((v) => v.schema);
      const functionSchemas = schema.scalarFunctions?.map((f) => f.schema) || [];
      const schemas = [...new Set([...tableSchemas, ...viewSchemas, ...functionSchemas])];
      set({
        schema,
        isLoading: false,
        isConnected: true,
        connectionInfo: { server: "localhost", database: "MockDB" },
        availableSchemas: schemas,
        objectTypeFilter: new Set(ALL_OBJECT_TYPES),
        edgeTypeFilter: new Set(ALL_EDGE_TYPES),
      });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  loadSchema: async (params: ConnectionParams) => {
    set({ isLoading: true, error: null });
    try {
      const schema = await invoke<SchemaGraph>("load_schema", { params });
      const tableSchemas = schema.tables.map((t) => t.schema);
      const viewSchemas = schema.views.map((v) => v.schema);
      const functionSchemas = schema.scalarFunctions?.map((f) => f.schema) || [];
      const schemas = [...new Set([...tableSchemas, ...viewSchemas, ...functionSchemas])];
      set({
        schema,
        isLoading: false,
        isConnected: true,
        connectionInfo: { server: params.server, database: params.database },
        availableSchemas: schemas,
        // Reset filters on new connection
        searchFilter: "",
        debouncedSearchFilter: "",
        schemaFilter: "all",
        focusedTableId: null,
        objectTypeFilter: new Set(ALL_OBJECT_TYPES),
        edgeTypeFilter: new Set(ALL_EDGE_TYPES),
        selectedEdgeIds: new Set(),
      });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  setSearchFilter: (search: string) => set({ searchFilter: search }),

  setDebouncedSearchFilter: (search: string) =>
    set({ debouncedSearchFilter: search }),

  setSchemaFilter: (schema: string) => set({ schemaFilter: schema }),

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

  clearEdgeSelection: () => set({ selectedEdgeIds: new Set() }),

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
      selectedEdgeIds: new Set(),
      availableSchemas: [],
      error: null,
    }),
}));
