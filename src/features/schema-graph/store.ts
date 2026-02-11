import { create } from "zustand";
import {
  SchemaGraph,
  ConnectionParams,
  ServerConnectionParams,
  TableNode as TableNodeType,
  ViewNode as ViewNodeType,
  Trigger,
  StoredProcedure,
  ScalarFunction,
  RelationshipEdge,
} from "./types";
import { schemaService } from "./services/schema-service";
import { databaseService } from "@/features/connection/services/database-service";
import {
  settingsService,
  type AppSettings,
  type EdgeLabelMode,
} from "@/features/settings/services/settings-service";
import type {
  CreateTableInput,
  CreateViewInput,
  CreateTriggerInput,
  CreateProcedureInput,
  CreateFunctionInput,
} from "@/features/canvas/types";
import {
  parseFunctionReturnType,
  parseRoutineDefinition,
  parseRoutineParameters,
  parseViewDefinition,
} from "@/features/canvas/utils/sql-definition";

export type ObjectType =
  | "tables"
  | "views"
  | "triggers"
  | "storedProcedures"
  | "scalarFunctions";

export type EdgeType =
  | "relationships"
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
  focusExpandThreshold: number;
  edgeLabelMode: EdgeLabelMode;
  showMiniMap: boolean;

  // Canvas mode state
  mode: "connected" | "canvas";
  canvasFilePath: string | null;
  canvasIsDirty: boolean;
  nodePositions: Record<string, { x: number; y: number }>;

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
  setFocusExpandThreshold: (threshold: number) => void;
  setEdgeLabelMode: (mode: EdgeLabelMode) => void;
  setShowMiniMap: (show: boolean) => void;
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

  // Canvas mode actions
  enterCanvasMode: (
    schema?: SchemaGraph,
    positions?: Record<string, { x: number; y: number }>,
    filePath?: string
  ) => void;
  exitCanvasMode: () => void;
  updateNodePosition: (
    nodeId: string,
    position: { x: number; y: number }
  ) => void;
  updateNodePositions: (
    positions: Record<string, { x: number; y: number }>
  ) => void;
  setCanvasFilePath: (path: string | null) => void;
  setCanvasDirty: (dirty: boolean) => void;

  // Canvas CRUD actions
  addTable: (input: CreateTableInput, position?: { x: number; y: number }) => string | null;
  updateTable: (id: string, input: CreateTableInput) => string | null;
  removeTable: (id: string) => void;
  addView: (input: CreateViewInput, position?: { x: number; y: number }) => string | null;
  updateView: (id: string, input: CreateViewInput) => string | null;
  removeView: (id: string) => void;
  addTrigger: (input: CreateTriggerInput, position?: { x: number; y: number }) => string | null;
  updateTrigger: (id: string, input: CreateTriggerInput) => string | null;
  removeTrigger: (id: string) => void;
  addStoredProcedure: (input: CreateProcedureInput, position?: { x: number; y: number }) => string | null;
  updateStoredProcedure: (id: string, input: CreateProcedureInput) => string | null;
  removeStoredProcedure: (id: string) => void;
  addScalarFunction: (input: CreateFunctionInput, position?: { x: number; y: number }) => string | null;
  updateScalarFunction: (id: string, input: CreateFunctionInput) => string | null;
  removeScalarFunction: (id: string) => void;
  addRelationship: (
    from: string,
    to: string,
    fromColumn?: string,
    toColumn?: string
  ) => string | null;
  updateRelationship: (
    id: string,
    from: string,
    to: string,
    fromColumn?: string,
    toColumn?: string
  ) => string | null;
  removeRelationship: (id: string) => void;
  addProcedureReference: (
    procedureId: string,
    tableId: string,
    kind: "reads" | "writes"
  ) => boolean;
  removeProcedureReference: (
    procedureId: string,
    tableId: string,
    kind: "reads" | "writes"
  ) => boolean;
  addTriggerReference: (
    triggerId: string,
    tableId: string,
    kind: "reads" | "writes"
  ) => boolean;
  removeTriggerReference: (
    triggerId: string,
    tableId: string,
    kind: "reads" | "writes"
  ) => boolean;
  setTriggerParent: (triggerId: string, tableId: string) => boolean;
  addFunctionReference: (functionId: string, tableId: string) => boolean;
  removeFunctionReference: (functionId: string, tableId: string) => boolean;
  setViewColumnSource: (
    viewId: string,
    columnName: string,
    sourceTableId: string,
    sourceColumn: string
  ) => boolean;
  removeViewColumnSource: (
    viewId: string,
    columnName: string,
    sourceTableId: string,
    sourceColumn: string
  ) => boolean;
  clearViewColumnSource: (viewId: string, columnName: string) => boolean;
  importObjects: (objects: Partial<SchemaGraph>) => void;
}

const ALL_OBJECT_TYPES: Set<ObjectType> = new Set([
  "tables",
  "views",
  "triggers",
  "storedProcedures",
  "scalarFunctions",
]);

const ALL_EDGE_TYPES: Set<EdgeType> = new Set([
  "relationships",
  "triggerDependencies",
  "triggerWrites",
  "procedureReads",
  "procedureWrites",
  "viewDependencies",
  "functionReads",
]);

const EMPTY_SCHEMA: SchemaGraph = {
  tables: [],
  views: [],
  relationships: [],
  triggers: [],
  storedProcedures: [],
  scalarFunctions: [],
};

const buildRelationshipId = (
  from: string,
  to: string,
  fromColumn?: string,
  toColumn?: string
) => {
  if (fromColumn && toColumn) {
    return `FK_${from}_${fromColumn}_${to}_${toColumn}`;
  }
  if (fromColumn) {
    return `FK_${from}_${fromColumn}__${to}`;
  }
  if (toColumn) {
    return `FK_${from}__${to}_${toColumn}`;
  }
  return `FK_${from}__${to}`;
};

const getAllNodeIds = (schema: SchemaGraph) =>
  new Set([
    ...schema.tables.map((t) => t.id),
    ...schema.views.map((v) => v.id),
    ...schema.triggers.map((t) => t.id),
    ...schema.storedProcedures.map((p) => p.id),
    ...schema.scalarFunctions.map((f) => f.id),
  ]);

const isNodeIdTaken = (schema: SchemaGraph, id: string, excludeId?: string) => {
  if (excludeId && id === excludeId) return false;
  return getAllNodeIds(schema).has(id);
};

const updateRelationshipsForRename = (
  relationships: RelationshipEdge[],
  oldId: string,
  newId: string
) => {
  const next = relationships.map((rel) => {
    if (rel.from !== oldId && rel.to !== oldId) return rel;
    const from = rel.from === oldId ? newId : rel.from;
    const to = rel.to === oldId ? newId : rel.to;
    return {
      ...rel,
      from,
      to,
      id: buildRelationshipId(from, to, rel.fromColumn, rel.toColumn),
    };
  });

  const seen = new Set<string>();
  return next.filter((rel) => {
    if (seen.has(rel.id)) return false;
    seen.add(rel.id);
    return true;
  });
};

const removeRelationshipsForNode = (
  relationships: RelationshipEdge[],
  nodeId: string
) => relationships.filter((rel) => rel.from !== nodeId && rel.to !== nodeId);

const replaceIdInList = (list: string[], oldId: string, newId: string) => {
  const next = list.map((id) => (id === oldId ? newId : id));
  return Array.from(new Set(next));
};

const removeIdFromList = (list: string[], nodeId: string) =>
  list.filter((id) => id !== nodeId);

const updateReferencesForRename = (
  schema: SchemaGraph,
  oldId: string,
  newId: string
) => {
  schema.triggers = schema.triggers.map((trigger) => ({
    ...trigger,
    tableId: trigger.tableId === oldId ? newId : trigger.tableId,
    referencedTables: replaceIdInList(
      trigger.referencedTables || [],
      oldId,
      newId
    ),
    affectedTables: replaceIdInList(
      trigger.affectedTables || [],
      oldId,
      newId
    ),
  }));

  schema.storedProcedures = schema.storedProcedures.map((procedure) => ({
    ...procedure,
    referencedTables: replaceIdInList(
      procedure.referencedTables || [],
      oldId,
      newId
    ),
    affectedTables: replaceIdInList(
      procedure.affectedTables || [],
      oldId,
      newId
    ),
  }));

  schema.scalarFunctions = schema.scalarFunctions.map((fn) => ({
    ...fn,
    referencedTables: replaceIdInList(
      fn.referencedTables || [],
      oldId,
      newId
    ),
    affectedTables: replaceIdInList(
      fn.affectedTables || [],
      oldId,
      newId
    ),
  }));

  schema.views = schema.views.map((view) => ({
    ...view,
    referencedTables: replaceIdInList(
      view.referencedTables || [],
      oldId,
      newId
    ),
    columns: view.columns.map((column) => {
      const nextSourceColumns = column.sourceColumns
        ? column.sourceColumns.map((source) =>
            source.table === oldId ? { ...source, table: newId } : source
          )
        : undefined;

      if (nextSourceColumns) {
        const firstSource = nextSourceColumns[0];
        return {
          ...column,
          sourceColumns: nextSourceColumns,
          sourceTable: firstSource?.table,
          sourceColumn: firstSource?.column,
        };
      }

      if (column.sourceTable === oldId) {
        return { ...column, sourceTable: newId };
      }

      return column;
    }),
  }));
};

const removeReferencesForNode = (schema: SchemaGraph, nodeId: string) => {
  schema.triggers = schema.triggers.map((trigger) => ({
    ...trigger,
    referencedTables: removeIdFromList(
      trigger.referencedTables || [],
      nodeId
    ),
    affectedTables: removeIdFromList(
      trigger.affectedTables || [],
      nodeId
    ),
  }));

  schema.storedProcedures = schema.storedProcedures.map((procedure) => ({
    ...procedure,
    referencedTables: removeIdFromList(
      procedure.referencedTables || [],
      nodeId
    ),
    affectedTables: removeIdFromList(
      procedure.affectedTables || [],
      nodeId
    ),
  }));

  schema.scalarFunctions = schema.scalarFunctions.map((fn) => ({
    ...fn,
    referencedTables: removeIdFromList(fn.referencedTables || [], nodeId),
    affectedTables: removeIdFromList(fn.affectedTables || [], nodeId),
  }));

  schema.views = schema.views.map((view) => ({
    ...view,
    referencedTables: removeIdFromList(view.referencedTables || [], nodeId),
    columns: view.columns.map((column) => {
      const nextSourceColumns = column.sourceColumns
        ? column.sourceColumns.filter((source) => source.table !== nodeId)
        : undefined;

      if (nextSourceColumns) {
        const firstSource = nextSourceColumns[0];
        return {
          ...column,
          sourceColumns: nextSourceColumns,
          sourceTable: firstSource?.table,
          sourceColumn: firstSource?.column,
        };
      }

      if (column.sourceTable === nodeId) {
        return { ...column, sourceTable: undefined, sourceColumn: undefined };
      }

      return column;
    }),
  }));
};

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
  focusExpandThreshold: 15,
  edgeLabelMode: "auto" as EdgeLabelMode,
  showMiniMap: true,
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
  // Canvas mode state
  mode: "connected" as const,
  canvasFilePath: null as string | null,
  canvasIsDirty: false,
  nodePositions: {} as Record<string, { x: number; y: number }>,
});

const getAvailableSchemas = (schema: SchemaGraph) => {
  const schemas = new Set<string>();
  schema.tables.forEach((table) => schemas.add(table.schema));
  (schema.views || []).forEach((view) => schemas.add(view.schema));
  (schema.triggers || []).forEach((trigger) => schemas.add(trigger.schema));
  (schema.storedProcedures || []).forEach((procedure) =>
    schemas.add(procedure.schema)
  );
  (schema.scalarFunctions || []).forEach((fn) => schemas.add(fn.schema));
  return [...schemas];
};

function cloneSchema(schema: SchemaGraph): SchemaGraph {
  return {
    tables: [...schema.tables],
    views: [...schema.views],
    relationships: [...schema.relationships],
    triggers: [...schema.triggers],
    storedProcedures: [...schema.storedProcedures],
    scalarFunctions: [...schema.scalarFunctions],
  };
}

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
        preferredSchemaFilter === "all" ||
        schemas.includes(preferredSchemaFilter)
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
        preferredSchemaFilter === "all" ||
        schemas.includes(preferredSchemaFilter)
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
        preferredSchemaFilter === "all" ||
        schemas.includes(preferredSchemaFilter)
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
        settings.schemaFilter === "all" ||
        availableSchemas.includes(settings.schemaFilter)
          ? settings.schemaFilter
          : "all";
      updates.preferredSchemaFilter = settings.schemaFilter;
      if (get().schema) {
        updates.schemaFilter = resolvedSchemaFilter;
      }
    }

    if (settings.focusExpandThreshold !== undefined) {
      updates.focusExpandThreshold = settings.focusExpandThreshold;
    }

    if (settings.edgeLabelMode) {
      updates.edgeLabelMode =
        settings.edgeLabelMode === "auto" ||
        settings.edgeLabelMode === "never" ||
        settings.edgeLabelMode === "always"
          ? settings.edgeLabelMode
          : "auto";
    }

    if (typeof settings.showMiniMap === "boolean") {
      updates.showMiniMap = settings.showMiniMap;
    }

    if (Object.keys(updates).length > 0) {
      set(updates);
    }
  },

  setFocusExpandThreshold: (threshold: number) => {
    set({ focusExpandThreshold: threshold });
    settingsService
      .saveSettings({ focusExpandThreshold: threshold })
      .catch(() => {
        // Ignore persistence errors
      });
  },

  setEdgeLabelMode: (mode: EdgeLabelMode) => {
    set({ edgeLabelMode: mode });
    settingsService.saveSettings({ edgeLabelMode: mode }).catch(() => {
      // Ignore persistence errors
    });
  },

  setShowMiniMap: (show: boolean) => {
    set({ showMiniMap: show });
    settingsService.saveSettings({ showMiniMap: show }).catch(() => {
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

  selectAllEdgeTypes: () => set({ edgeTypeFilter: new Set(ALL_EDGE_TYPES) }),

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

  // Canvas mode actions
  enterCanvasMode: (schema?, positions?, filePath?) => {
    const s = schema ?? { ...EMPTY_SCHEMA };
    const schemas = getAvailableSchemas(s);
    set({
      mode: "canvas",
      schema: s,
      canvasFilePath: filePath ?? null,
      canvasIsDirty: false,
      nodePositions: positions ?? {},
      availableSchemas: schemas,
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
      error: null,
    });
  },

  exitCanvasMode: () =>
    set({
      ...createInitialSchemaState(),
    }),

  updateNodePosition: (nodeId, position) =>
    set((state) => ({
      nodePositions: { ...state.nodePositions, [nodeId]: position },
      canvasIsDirty: true,
    })),

  updateNodePositions: (positions) =>
    set((state) => ({
      nodePositions: { ...state.nodePositions, ...positions },
    })),

  setCanvasFilePath: (path) => set({ canvasFilePath: path }),

  setCanvasDirty: (dirty) => set({ canvasIsDirty: dirty }),

  // Canvas CRUD actions
  addTable: (input, position?) => {
    const state = get();
    if (state.mode !== "canvas" || !state.schema) return null;

    const id = `${input.schema}.${input.name}`;
    if (isNodeIdTaken(state.schema, id)) return null;

    const table: TableNodeType = {
      id,
      name: input.name,
      schema: input.schema,
      columns: input.columns,
    };

    const newSchema = cloneSchema(state.schema);
    newSchema.tables = [...newSchema.tables, table];
    const schemas = getAvailableSchemas(newSchema);
    const newPositions = position
      ? { ...state.nodePositions, [id]: position }
      : state.nodePositions;

    set({
      schema: newSchema,
      availableSchemas: schemas,
      canvasIsDirty: true,
      nodePositions: newPositions,
    });
    return id;
  },

  updateTable: (id, input) => {
    const state = get();
    if (state.mode !== "canvas" || !state.schema) return null;

    const newId = `${input.schema}.${input.name}`;
    if (isNodeIdTaken(state.schema, newId, id)) return null;
    const newSchema = cloneSchema(state.schema);
    const index = newSchema.tables.findIndex((t) => t.id === id);
    if (index === -1) return null;

    newSchema.tables[index] = {
      id: newId,
      name: input.name,
      schema: input.schema,
      columns: input.columns,
    };

    // Update references if ID changed
    if (id !== newId) {
      newSchema.relationships = updateRelationshipsForRename(
        newSchema.relationships,
        id,
        newId
      );
      updateReferencesForRename(newSchema, id, newId);
    }

    const schemas = getAvailableSchemas(newSchema);
    const newPositions = { ...state.nodePositions };
    if (id !== newId && newPositions[id]) {
      newPositions[newId] = newPositions[id];
      delete newPositions[id];
    }

    set({
      schema: newSchema,
      availableSchemas: schemas,
      canvasIsDirty: true,
      nodePositions: newPositions,
    });
    return newId;
  },

  removeTable: (id) => {
    const state = get();
    if (state.mode !== "canvas" || !state.schema) return;

    const newSchema = cloneSchema(state.schema);
    newSchema.tables = newSchema.tables.filter((t) => t.id !== id);
    newSchema.relationships = removeRelationshipsForNode(
      newSchema.relationships,
      id
    );
    newSchema.triggers = newSchema.triggers.filter((t) => t.tableId !== id);
    removeReferencesForNode(newSchema, id);

    const schemas = getAvailableSchemas(newSchema);
    const newPositions = { ...state.nodePositions };
    delete newPositions[id];

    set({
      schema: newSchema,
      availableSchemas: schemas,
      canvasIsDirty: true,
      nodePositions: newPositions,
    });
  },

  addView: (input, position?) => {
    const state = get();
    if (state.mode !== "canvas" || !state.schema) return null;

    const id = `${input.schema}.${input.name}`;
    if (isNodeIdTaken(state.schema, id)) return null;

    const definition = input.definition ?? "";
    const parsed = parseViewDefinition(definition, state.schema, {
      fallbackColumns: input.columns,
      defaultSchema: input.schema,
    });

    const view: ViewNodeType = {
      id,
      name: input.name,
      schema: input.schema,
      columns: parsed.columns,
      definition,
      referencedTables: parsed.referencedTables,
    };

    const newSchema = cloneSchema(state.schema);
    newSchema.views = [...newSchema.views, view];
    const schemas = getAvailableSchemas(newSchema);
    const newPositions = position
      ? { ...state.nodePositions, [id]: position }
      : state.nodePositions;

    set({
      schema: newSchema,
      availableSchemas: schemas,
      canvasIsDirty: true,
      nodePositions: newPositions,
    });
    return id;
  },

  updateView: (id, input) => {
    const state = get();
    if (state.mode !== "canvas" || !state.schema) return null;

    const newId = `${input.schema}.${input.name}`;
    if (isNodeIdTaken(state.schema, newId, id)) return null;
    const newSchema = cloneSchema(state.schema);
    const index = newSchema.views.findIndex((v) => v.id === id);
    if (index === -1) return null;

    const definition = input.definition ?? newSchema.views[index].definition;
    const parsed = parseViewDefinition(definition, state.schema, {
      fallbackColumns: input.columns,
      defaultSchema: input.schema,
    });

    newSchema.views[index] = {
      ...newSchema.views[index],
      id: newId,
      name: input.name,
      schema: input.schema,
      columns: parsed.columns,
      definition,
      referencedTables: parsed.referencedTables,
    };

    if (id !== newId) {
      newSchema.relationships = updateRelationshipsForRename(
        newSchema.relationships,
        id,
        newId
      );
      updateReferencesForRename(newSchema, id, newId);
    }

    const schemas = getAvailableSchemas(newSchema);
    const newPositions = { ...state.nodePositions };
    if (id !== newId && newPositions[id]) {
      newPositions[newId] = newPositions[id];
      delete newPositions[id];
    }

    set({
      schema: newSchema,
      availableSchemas: schemas,
      canvasIsDirty: true,
      nodePositions: newPositions,
    });
    return newId;
  },

  removeView: (id) => {
    const state = get();
    if (state.mode !== "canvas" || !state.schema) return;

    const newSchema = cloneSchema(state.schema);
    newSchema.views = newSchema.views.filter((v) => v.id !== id);
    newSchema.relationships = removeRelationshipsForNode(
      newSchema.relationships,
      id
    );
    removeReferencesForNode(newSchema, id);

    const schemas = getAvailableSchemas(newSchema);
    const newPositions = { ...state.nodePositions };
    delete newPositions[id];

    set({
      schema: newSchema,
      availableSchemas: schemas,
      canvasIsDirty: true,
      nodePositions: newPositions,
    });
  },

  addTrigger: (input, position?) => {
    const state = get();
    if (state.mode !== "canvas" || !state.schema) return null;

    const id = `${input.schema}.${input.tableId}.${input.name}`;
    if (isNodeIdTaken(state.schema, id)) return null;

    const definition = input.definition ?? "";
    const parsed = parseRoutineDefinition(definition, state.schema, {
      defaultSchema: input.schema,
    });

    const trigger: Trigger = {
      id,
      name: input.name,
      schema: input.schema,
      tableId: input.tableId,
      triggerType: input.triggerType ?? "AFTER",
      isDisabled: false,
      firesOnInsert: input.firesOnInsert ?? false,
      firesOnUpdate: input.firesOnUpdate ?? false,
      firesOnDelete: input.firesOnDelete ?? false,
      definition,
      referencedTables: parsed.referencedTables,
      affectedTables: parsed.affectedTables,
    };

    const newSchema = cloneSchema(state.schema);
    newSchema.triggers = [...newSchema.triggers, trigger];
    const schemas = getAvailableSchemas(newSchema);
    const newPositions = position
      ? { ...state.nodePositions, [id]: position }
      : state.nodePositions;

    set({
      schema: newSchema,
      availableSchemas: schemas,
      canvasIsDirty: true,
      nodePositions: newPositions,
    });
    return id;
  },

  updateTrigger: (id, input) => {
    const state = get();
    if (state.mode !== "canvas" || !state.schema) return null;

    const newId = `${input.schema}.${input.tableId}.${input.name}`;
    if (isNodeIdTaken(state.schema, newId, id)) return null;
    const newSchema = cloneSchema(state.schema);
    const index = newSchema.triggers.findIndex((t) => t.id === id);
    if (index === -1) return null;

    const definition = input.definition ?? newSchema.triggers[index].definition;
    const parsed = parseRoutineDefinition(definition, state.schema, {
      defaultSchema: input.schema,
    });

    newSchema.triggers[index] = {
      ...newSchema.triggers[index],
      id: newId,
      name: input.name,
      schema: input.schema,
      tableId: input.tableId,
      triggerType: input.triggerType ?? newSchema.triggers[index].triggerType,
      firesOnInsert:
        input.firesOnInsert ?? newSchema.triggers[index].firesOnInsert,
      firesOnUpdate:
        input.firesOnUpdate ?? newSchema.triggers[index].firesOnUpdate,
      firesOnDelete:
        input.firesOnDelete ?? newSchema.triggers[index].firesOnDelete,
      definition,
      referencedTables: parsed.referencedTables,
      affectedTables: parsed.affectedTables,
    };

    if (id !== newId) {
      newSchema.relationships = updateRelationshipsForRename(
        newSchema.relationships,
        id,
        newId
      );
    }

    const schemas = getAvailableSchemas(newSchema);
    const newPositions = { ...state.nodePositions };
    if (id !== newId && newPositions[id]) {
      newPositions[newId] = newPositions[id];
      delete newPositions[id];
    }

    set({
      schema: newSchema,
      availableSchemas: schemas,
      canvasIsDirty: true,
      nodePositions: newPositions,
    });
    return newId;
  },

  removeTrigger: (id) => {
    const state = get();
    if (state.mode !== "canvas" || !state.schema) return;

    const newSchema = cloneSchema(state.schema);
    newSchema.triggers = newSchema.triggers.filter((t) => t.id !== id);
    newSchema.relationships = removeRelationshipsForNode(
      newSchema.relationships,
      id
    );

    const schemas = getAvailableSchemas(newSchema);
    const newPositions = { ...state.nodePositions };
    delete newPositions[id];

    set({
      schema: newSchema,
      availableSchemas: schemas,
      canvasIsDirty: true,
      nodePositions: newPositions,
    });
  },

  addStoredProcedure: (input, position?) => {
    const state = get();
    if (state.mode !== "canvas" || !state.schema) return null;

    const id = `${input.schema}.${input.name}`;
    if (isNodeIdTaken(state.schema, id)) return null;

    const definition = input.definition ?? "";
    const parsed = parseRoutineDefinition(definition, state.schema, {
      defaultSchema: input.schema,
    });
    const parsedParams = parseRoutineParameters(definition);
    const parameters = parsedParams.hasSignature
      ? parsedParams.parameters
      : input.parameters ?? [];

    const procedure: StoredProcedure = {
      id,
      name: input.name,
      schema: input.schema,
      procedureType: "SQL_STORED_PROCEDURE",
      parameters,
      definition,
      referencedTables: parsed.referencedTables,
      affectedTables: parsed.affectedTables,
    };

    const newSchema = cloneSchema(state.schema);
    newSchema.storedProcedures = [...newSchema.storedProcedures, procedure];
    const schemas = getAvailableSchemas(newSchema);
    const newPositions = position
      ? { ...state.nodePositions, [id]: position }
      : state.nodePositions;

    set({
      schema: newSchema,
      availableSchemas: schemas,
      canvasIsDirty: true,
      nodePositions: newPositions,
    });
    return id;
  },

  updateStoredProcedure: (id, input) => {
    const state = get();
    if (state.mode !== "canvas" || !state.schema) return null;

    const newId = `${input.schema}.${input.name}`;
    if (isNodeIdTaken(state.schema, newId, id)) return null;
    const newSchema = cloneSchema(state.schema);
    const index = newSchema.storedProcedures.findIndex((p) => p.id === id);
    if (index === -1) return null;

    const definition =
      input.definition ?? newSchema.storedProcedures[index].definition;
    const parsed = parseRoutineDefinition(definition, state.schema, {
      defaultSchema: input.schema,
    });
    const parsedParams = parseRoutineParameters(definition);
    const parameters = parsedParams.hasSignature
      ? parsedParams.parameters
      : input.parameters ?? newSchema.storedProcedures[index].parameters;

    newSchema.storedProcedures[index] = {
      ...newSchema.storedProcedures[index],
      id: newId,
      name: input.name,
      schema: input.schema,
      parameters,
      definition,
      referencedTables: parsed.referencedTables,
      affectedTables: parsed.affectedTables,
    };

    if (id !== newId) {
      newSchema.relationships = updateRelationshipsForRename(
        newSchema.relationships,
        id,
        newId
      );
    }

    const schemas = getAvailableSchemas(newSchema);
    const newPositions = { ...state.nodePositions };
    if (id !== newId && newPositions[id]) {
      newPositions[newId] = newPositions[id];
      delete newPositions[id];
    }

    set({
      schema: newSchema,
      availableSchemas: schemas,
      canvasIsDirty: true,
      nodePositions: newPositions,
    });
    return newId;
  },

  removeStoredProcedure: (id) => {
    const state = get();
    if (state.mode !== "canvas" || !state.schema) return;

    const newSchema = cloneSchema(state.schema);
    newSchema.storedProcedures = newSchema.storedProcedures.filter(
      (p) => p.id !== id
    );
    newSchema.relationships = removeRelationshipsForNode(
      newSchema.relationships,
      id
    );

    const schemas = getAvailableSchemas(newSchema);
    const newPositions = { ...state.nodePositions };
    delete newPositions[id];

    set({
      schema: newSchema,
      availableSchemas: schemas,
      canvasIsDirty: true,
      nodePositions: newPositions,
    });
  },

  addScalarFunction: (input, position?) => {
    const state = get();
    if (state.mode !== "canvas" || !state.schema) return null;

    const id = `${input.schema}.${input.name}`;
    if (isNodeIdTaken(state.schema, id)) return null;

    const definition = input.definition ?? "";
    const parsed = parseRoutineDefinition(definition, state.schema, {
      defaultSchema: input.schema,
    });
    const parsedParams = parseRoutineParameters(definition);
    const parsedReturnType = parseFunctionReturnType(definition);
    const parameters = parsedParams.hasSignature
      ? parsedParams.parameters
      : input.parameters ?? [];
    const returnType = parsedReturnType ?? input.returnType ?? "int";

    const fn: ScalarFunction = {
      id,
      name: input.name,
      schema: input.schema,
      functionType: "SQL_SCALAR_FUNCTION",
      parameters,
      returnType,
      definition,
      referencedTables: parsed.referencedTables,
      affectedTables: parsed.affectedTables,
    };

    const newSchema = cloneSchema(state.schema);
    newSchema.scalarFunctions = [...newSchema.scalarFunctions, fn];
    const schemas = getAvailableSchemas(newSchema);
    const newPositions = position
      ? { ...state.nodePositions, [id]: position }
      : state.nodePositions;

    set({
      schema: newSchema,
      availableSchemas: schemas,
      canvasIsDirty: true,
      nodePositions: newPositions,
    });
    return id;
  },

  updateScalarFunction: (id, input) => {
    const state = get();
    if (state.mode !== "canvas" || !state.schema) return null;

    const newId = `${input.schema}.${input.name}`;
    if (isNodeIdTaken(state.schema, newId, id)) return null;
    const newSchema = cloneSchema(state.schema);
    const index = newSchema.scalarFunctions.findIndex((f) => f.id === id);
    if (index === -1) return null;

    const definition =
      input.definition ?? newSchema.scalarFunctions[index].definition;
    const parsed = parseRoutineDefinition(definition, state.schema, {
      defaultSchema: input.schema,
    });
    const parsedParams = parseRoutineParameters(definition);
    const parsedReturnType = parseFunctionReturnType(definition);
    const parameters = parsedParams.hasSignature
      ? parsedParams.parameters
      : input.parameters ?? newSchema.scalarFunctions[index].parameters;
    const returnType =
      parsedReturnType ??
      input.returnType ??
      newSchema.scalarFunctions[index].returnType;

    newSchema.scalarFunctions[index] = {
      ...newSchema.scalarFunctions[index],
      id: newId,
      name: input.name,
      schema: input.schema,
      parameters,
      returnType,
      definition,
      referencedTables: parsed.referencedTables,
      affectedTables: parsed.affectedTables,
    };

    if (id !== newId) {
      newSchema.relationships = updateRelationshipsForRename(
        newSchema.relationships,
        id,
        newId
      );
    }

    const schemas = getAvailableSchemas(newSchema);
    const newPositions = { ...state.nodePositions };
    if (id !== newId && newPositions[id]) {
      newPositions[newId] = newPositions[id];
      delete newPositions[id];
    }

    set({
      schema: newSchema,
      availableSchemas: schemas,
      canvasIsDirty: true,
      nodePositions: newPositions,
    });
    return newId;
  },

  removeScalarFunction: (id) => {
    const state = get();
    if (state.mode !== "canvas" || !state.schema) return;

    const newSchema = cloneSchema(state.schema);
    newSchema.scalarFunctions = newSchema.scalarFunctions.filter(
      (f) => f.id !== id
    );
    newSchema.relationships = removeRelationshipsForNode(
      newSchema.relationships,
      id
    );

    const schemas = getAvailableSchemas(newSchema);
    const newPositions = { ...state.nodePositions };
    delete newPositions[id];

    set({
      schema: newSchema,
      availableSchemas: schemas,
      canvasIsDirty: true,
      nodePositions: newPositions,
    });
  },

  addRelationship: (from, to, fromColumn?, toColumn?) => {
    const state = get();
    if (state.mode !== "canvas" || !state.schema) return null;

    const id = buildRelationshipId(from, to, fromColumn, toColumn);
    if (state.schema.relationships.some((r) => r.id === id)) return null;

    const relationship: RelationshipEdge = {
      id,
      from,
      to,
      fromColumn,
      toColumn,
    };

    const newSchema = cloneSchema(state.schema);
    newSchema.relationships = [...newSchema.relationships, relationship];

    set({ schema: newSchema, canvasIsDirty: true });
    return id;
  },

  updateRelationship: (id, from, to, fromColumn?, toColumn?) => {
    const state = get();
    if (state.mode !== "canvas" || !state.schema) return null;

    const nextId = buildRelationshipId(from, to, fromColumn, toColumn);
    const newSchema = cloneSchema(state.schema);
    const index = newSchema.relationships.findIndex((r) => r.id === id);
    if (index === -1) return null;

    if (nextId !== id && newSchema.relationships.some((r) => r.id === nextId)) {
      return null;
    }

    newSchema.relationships[index] = {
      ...newSchema.relationships[index],
      id: nextId,
      from,
      to,
      fromColumn,
      toColumn,
    };

    set({ schema: newSchema, canvasIsDirty: true });
    return nextId;
  },

  removeRelationship: (id) => {
    const state = get();
    if (state.mode !== "canvas" || !state.schema) return;

    const newSchema = cloneSchema(state.schema);
    newSchema.relationships = newSchema.relationships.filter(
      (r) => r.id !== id
    );

    set({ schema: newSchema, canvasIsDirty: true });
  },

  addProcedureReference: (procedureId, tableId, kind) => {
    const state = get();
    if (state.mode !== "canvas" || !state.schema) return false;

    const newSchema = cloneSchema(state.schema);
    const index = newSchema.storedProcedures.findIndex(
      (p) => p.id === procedureId
    );
    if (index === -1) return false;
    const procedure = newSchema.storedProcedures[index];
    const list =
      kind === "reads"
        ? procedure.referencedTables || []
        : procedure.affectedTables || [];
    if (list.includes(tableId)) return false;

    newSchema.storedProcedures[index] = {
      ...procedure,
      referencedTables:
        kind === "reads" ? [...list, tableId] : procedure.referencedTables,
      affectedTables:
        kind === "writes" ? [...list, tableId] : procedure.affectedTables,
    };

    set({ schema: newSchema, canvasIsDirty: true });
    return true;
  },

  removeProcedureReference: (procedureId, tableId, kind) => {
    const state = get();
    if (state.mode !== "canvas" || !state.schema) return false;

    const newSchema = cloneSchema(state.schema);
    const index = newSchema.storedProcedures.findIndex(
      (p) => p.id === procedureId
    );
    if (index === -1) return false;
    const procedure = newSchema.storedProcedures[index];
    const list =
      kind === "reads"
        ? procedure.referencedTables || []
        : procedure.affectedTables || [];
    if (!list.includes(tableId)) return false;

    newSchema.storedProcedures[index] = {
      ...procedure,
      referencedTables:
        kind === "reads"
          ? list.filter((id) => id !== tableId)
          : procedure.referencedTables,
      affectedTables:
        kind === "writes"
          ? list.filter((id) => id !== tableId)
          : procedure.affectedTables,
    };

    set({ schema: newSchema, canvasIsDirty: true });
    return true;
  },

  addTriggerReference: (triggerId, tableId, kind) => {
    const state = get();
    if (state.mode !== "canvas" || !state.schema) return false;

    const newSchema = cloneSchema(state.schema);
    const index = newSchema.triggers.findIndex((t) => t.id === triggerId);
    if (index === -1) return false;
    const trigger = newSchema.triggers[index];
    const list =
      kind === "reads"
        ? trigger.referencedTables || []
        : trigger.affectedTables || [];
    if (list.includes(tableId)) return false;

    newSchema.triggers[index] = {
      ...trigger,
      referencedTables:
        kind === "reads" ? [...list, tableId] : trigger.referencedTables,
      affectedTables:
        kind === "writes" ? [...list, tableId] : trigger.affectedTables,
    };

    set({ schema: newSchema, canvasIsDirty: true });
    return true;
  },

  removeTriggerReference: (triggerId, tableId, kind) => {
    const state = get();
    if (state.mode !== "canvas" || !state.schema) return false;

    const newSchema = cloneSchema(state.schema);
    const index = newSchema.triggers.findIndex((t) => t.id === triggerId);
    if (index === -1) return false;
    const trigger = newSchema.triggers[index];
    const list =
      kind === "reads"
        ? trigger.referencedTables || []
        : trigger.affectedTables || [];
    if (!list.includes(tableId)) return false;

    newSchema.triggers[index] = {
      ...trigger,
      referencedTables:
        kind === "reads"
          ? list.filter((id) => id !== tableId)
          : trigger.referencedTables,
      affectedTables:
        kind === "writes"
          ? list.filter((id) => id !== tableId)
          : trigger.affectedTables,
    };

    set({ schema: newSchema, canvasIsDirty: true });
    return true;
  },

  setTriggerParent: (triggerId, tableId) => {
    const state = get();
    if (state.mode !== "canvas" || !state.schema) return false;

    const newSchema = cloneSchema(state.schema);
    const index = newSchema.triggers.findIndex((t) => t.id === triggerId);
    if (index === -1) return false;

    const trigger = newSchema.triggers[index];
    if (trigger.tableId === tableId) return false;
    const newId = `${trigger.schema}.${tableId}.${trigger.name}`;
    if (isNodeIdTaken(newSchema, newId, triggerId)) return false;

    newSchema.triggers[index] = {
      ...trigger,
      id: newId,
      tableId,
    };

    if (triggerId !== newId) {
      newSchema.relationships = updateRelationshipsForRename(
        newSchema.relationships,
        triggerId,
        newId
      );
    }

    const schemas = getAvailableSchemas(newSchema);
    const newPositions = { ...state.nodePositions };
    if (triggerId !== newId && newPositions[triggerId]) {
      newPositions[newId] = newPositions[triggerId];
      delete newPositions[triggerId];
    }

    set({
      schema: newSchema,
      availableSchemas: schemas,
      canvasIsDirty: true,
      nodePositions: newPositions,
    });
    return true;
  },

  addFunctionReference: (functionId, tableId) => {
    const state = get();
    if (state.mode !== "canvas" || !state.schema) return false;

    const newSchema = cloneSchema(state.schema);
    const index = newSchema.scalarFunctions.findIndex((f) => f.id === functionId);
    if (index === -1) return false;
    const fn = newSchema.scalarFunctions[index];
    const list = fn.referencedTables || [];
    if (list.includes(tableId)) return false;

    newSchema.scalarFunctions[index] = {
      ...fn,
      referencedTables: [...list, tableId],
    };

    set({ schema: newSchema, canvasIsDirty: true });
    return true;
  },

  removeFunctionReference: (functionId, tableId) => {
    const state = get();
    if (state.mode !== "canvas" || !state.schema) return false;

    const newSchema = cloneSchema(state.schema);
    const index = newSchema.scalarFunctions.findIndex((f) => f.id === functionId);
    if (index === -1) return false;
    const fn = newSchema.scalarFunctions[index];
    const list = fn.referencedTables || [];
    if (!list.includes(tableId)) return false;

    newSchema.scalarFunctions[index] = {
      ...fn,
      referencedTables: list.filter((id) => id !== tableId),
    };

    set({ schema: newSchema, canvasIsDirty: true });
    return true;
  },

  setViewColumnSource: (viewId, columnName, sourceTableId, sourceColumn) => {
    const state = get();
    if (state.mode !== "canvas" || !state.schema) return false;

    const newSchema = cloneSchema(state.schema);
    const index = newSchema.views.findIndex((v) => v.id === viewId);
    if (index === -1) return false;
    const view = newSchema.views[index];
    const columnIndex = view.columns.findIndex((c) => c.name === columnName);
    if (columnIndex === -1) return false;

    const targetColumn = view.columns[columnIndex];
    const existingSources =
      targetColumn.sourceColumns && targetColumn.sourceColumns.length > 0
        ? targetColumn.sourceColumns
        : targetColumn.sourceTable && targetColumn.sourceColumn
          ? [{ table: targetColumn.sourceTable, column: targetColumn.sourceColumn }]
          : [];
    const alreadyExists = existingSources.some(
      (source) =>
        source.table === sourceTableId && source.column === sourceColumn
    );
    const needsLegacyPromotion =
      !targetColumn.sourceColumns || targetColumn.sourceColumns.length === 0;
    if (alreadyExists && !needsLegacyPromotion) {
      return false;
    }

    const nextSources = alreadyExists
      ? existingSources
      : [...existingSources, { table: sourceTableId, column: sourceColumn }];

    const nextColumns = view.columns.map((column, idx) => {
      if (idx !== columnIndex) {
        return column;
      }
      const firstSource = nextSources[0];
      return {
        ...column,
        sourceColumns: nextSources,
        sourceTable: firstSource?.table,
        sourceColumn: firstSource?.column,
      };
    });

    newSchema.views[index] = {
      ...view,
      columns: nextColumns,
    };

    set({ schema: newSchema, canvasIsDirty: true });
    return true;
  },

  removeViewColumnSource: (
    viewId,
    columnName,
    sourceTableId,
    sourceColumn
  ) => {
    const state = get();
    if (state.mode !== "canvas" || !state.schema) return false;

    const newSchema = cloneSchema(state.schema);
    const index = newSchema.views.findIndex((v) => v.id === viewId);
    if (index === -1) return false;
    const view = newSchema.views[index];
    const columnIndex = view.columns.findIndex((c) => c.name === columnName);
    if (columnIndex === -1) return false;

    const nextColumns = view.columns.map((column, idx) => {
      if (idx !== columnIndex) {
        return column;
      }

      const existingSources =
        column.sourceColumns && column.sourceColumns.length > 0
          ? column.sourceColumns
          : column.sourceTable && column.sourceColumn
            ? [{ table: column.sourceTable, column: column.sourceColumn }]
            : [];

      const nextSources = existingSources.filter(
        (source) =>
          !(source.table === sourceTableId && source.column === sourceColumn)
      );

      if (nextSources.length === 0) {
        return {
          ...column,
          sourceColumns: [],
          sourceTable: undefined,
          sourceColumn: undefined,
        };
      }

      const firstSource = nextSources[0];
      return {
        ...column,
        sourceColumns: nextSources,
        sourceTable: firstSource.table,
        sourceColumn: firstSource.column,
      };
    });

    newSchema.views[index] = {
      ...view,
      columns: nextColumns,
    };

    set({ schema: newSchema, canvasIsDirty: true });
    return true;
  },

  clearViewColumnSource: (viewId, columnName) => {
    const state = get();
    if (state.mode !== "canvas" || !state.schema) return false;

    const newSchema = cloneSchema(state.schema);
    const index = newSchema.views.findIndex((v) => v.id === viewId);
    if (index === -1) return false;
    const view = newSchema.views[index];
    const columnIndex = view.columns.findIndex((c) => c.name === columnName);
    if (columnIndex === -1) return false;

    const nextColumns = view.columns.map((column, idx) =>
      idx === columnIndex
        ? {
            ...column,
            sourceColumns: [],
            sourceTable: undefined,
            sourceColumn: undefined,
          }
        : column
    );

    newSchema.views[index] = {
      ...view,
      columns: nextColumns,
    };

    set({ schema: newSchema, canvasIsDirty: true });
    return true;
  },

  importObjects: (objects) => {
    const state = get();
    if (state.mode !== "canvas" || !state.schema) return;

    const newSchema = cloneSchema(state.schema);
    const existingIds = new Set([
      ...newSchema.tables.map((t) => t.id),
      ...newSchema.views.map((v) => v.id),
      ...newSchema.triggers.map((t) => t.id),
      ...newSchema.storedProcedures.map((p) => p.id),
      ...newSchema.scalarFunctions.map((f) => f.id),
    ]);

    if (objects.tables) {
      const newTables = objects.tables.filter((t) => !existingIds.has(t.id));
      newSchema.tables = [...newSchema.tables, ...newTables];
    }
    if (objects.views) {
      const newViews = objects.views.filter((v) => !existingIds.has(v.id));
      newSchema.views = [...newSchema.views, ...newViews];
    }
    if (objects.triggers) {
      const newTriggers = objects.triggers.filter(
        (t) => !existingIds.has(t.id)
      );
      newSchema.triggers = [...newSchema.triggers, ...newTriggers];
    }
    if (objects.storedProcedures) {
      const newProcs = objects.storedProcedures.filter(
        (p) => !existingIds.has(p.id)
      );
      newSchema.storedProcedures = [
        ...newSchema.storedProcedures,
        ...newProcs,
      ];
    }
    if (objects.scalarFunctions) {
      const newFuncs = objects.scalarFunctions.filter(
        (f) => !existingIds.has(f.id)
      );
      newSchema.scalarFunctions = [
        ...newSchema.scalarFunctions,
        ...newFuncs,
      ];
    }

    // Import relationships where both endpoints exist
    if (objects.relationships) {
      const allIds = getAllNodeIds(newSchema);
      const existingRelIds = new Set(newSchema.relationships.map((r) => r.id));
      const validRels = objects.relationships.filter(
        (r) =>
          allIds.has(r.from) && allIds.has(r.to) && !existingRelIds.has(r.id)
      );
      newSchema.relationships = [...newSchema.relationships, ...validRels];
    }

    const schemas = getAvailableSchemas(newSchema);
    set({
      schema: newSchema,
      availableSchemas: schemas,
      canvasIsDirty: true,
    });
  },
}));
