import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { SchemaGraph, ConnectionParams } from "@/types/schema";

interface SchemaStore {
  // State
  schema: SchemaGraph | null;
  isLoading: boolean;
  error: string | null;
  isConnected: boolean;

  // Filters
  searchFilter: string;
  schemaFilter: string;
  focusedTableId: string | null;

  // Derived data
  availableSchemas: string[];

  // Actions
  loadMockSchema: () => Promise<void>;
  loadSchema: (params: ConnectionParams) => Promise<void>;
  setSearchFilter: (search: string) => void;
  setSchemaFilter: (schema: string) => void;
  setFocusedTable: (tableId: string | null) => void;
  clearFocus: () => void;
  disconnect: () => void;
}

export const useSchemaStore = create<SchemaStore>((set) => ({
  // Initial state
  schema: null,
  isLoading: false,
  error: null,
  isConnected: false,
  searchFilter: "",
  schemaFilter: "all",
  focusedTableId: null,
  availableSchemas: [],

  loadMockSchema: async () => {
    set({ isLoading: true, error: null });
    try {
      const schema = await invoke<SchemaGraph>("load_schema_mock");
      const schemas = [...new Set(schema.tables.map((t) => t.schema))];
      set({
        schema,
        isLoading: false,
        isConnected: true,
        availableSchemas: schemas,
      });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  loadSchema: async (params: ConnectionParams) => {
    set({ isLoading: true, error: null });
    try {
      const schema = await invoke<SchemaGraph>("load_schema", { params });
      const schemas = [...new Set(schema.tables.map((t) => t.schema))];
      set({
        schema,
        isLoading: false,
        isConnected: true,
        availableSchemas: schemas,
        // Reset filters on new connection
        searchFilter: "",
        schemaFilter: "all",
        focusedTableId: null,
      });
    } catch (err) {
      set({ error: String(err), isLoading: false });
    }
  },

  setSearchFilter: (search: string) => set({ searchFilter: search }),

  setSchemaFilter: (schema: string) => set({ schemaFilter: schema }),

  setFocusedTable: (tableId: string | null) => set({ focusedTableId: tableId }),

  clearFocus: () => set({ focusedTableId: null }),

  disconnect: () =>
    set({
      schema: null,
      isConnected: false,
      searchFilter: "",
      schemaFilter: "all",
      focusedTableId: null,
      availableSchemas: [],
      error: null,
    }),
}));
