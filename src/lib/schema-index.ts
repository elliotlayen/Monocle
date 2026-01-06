import type { SchemaGraph } from "@/types/schema";

export interface ViewColumnSource {
  columnName: string;
  sourceTableId: string;
  sourceColumn: string;
}

export interface SchemaIndex {
  tableSearch: Map<string, string>;
  viewSearch: Map<string, string>;
  triggerSearch: Map<string, string>;
  procedureSearch: Map<string, string>;
  functionSearch: Map<string, string>;
  nameToId: Map<string, string>;
  viewColumnSources: Map<string, ViewColumnSource[]>;
  columnsWithHandles: Set<string>;
  neighbors: Map<string, Set<string>>;
}

function addNameLookup(map: Map<string, string>, name: string, id: string) {
  map.set(name.toLowerCase(), id);
}

function buildSearchText(base: string[]): string {
  return base.join(" ").toLowerCase();
}

const schemaIndexCache = new WeakMap<SchemaGraph, SchemaIndex>();

export function buildSchemaIndex(schema: SchemaGraph): SchemaIndex {
  const tableSearch = new Map<string, string>();
  const viewSearch = new Map<string, string>();
  const triggerSearch = new Map<string, string>();
  const procedureSearch = new Map<string, string>();
  const functionSearch = new Map<string, string>();
  const nameToId = new Map<string, string>();
  const viewColumnSources = new Map<string, ViewColumnSource[]>();
  const columnsWithHandles = new Set<string>();
  const neighbors = new Map<string, Set<string>>();

  const addNeighbor = (from: string, to: string) => {
    if (!neighbors.has(from)) {
      neighbors.set(from, new Set());
    }
    neighbors.get(from)!.add(to);
  };

  for (const table of schema.tables) {
    addNameLookup(nameToId, table.name, table.id);
    addNameLookup(nameToId, table.id, table.id);
    const columnNames = table.columns.map((col) => col.name);
    tableSearch.set(
      table.id,
      buildSearchText([table.name, table.schema, table.id, ...columnNames])
    );
  }

  for (const view of schema.views || []) {
    addNameLookup(nameToId, view.name, view.id);
    addNameLookup(nameToId, view.id, view.id);
    const columnNames = view.columns.map((col) => col.name);
    viewSearch.set(
      view.id,
      buildSearchText([view.name, view.schema, view.id, ...columnNames])
    );
  }

  for (const trigger of schema.triggers || []) {
    triggerSearch.set(
      trigger.id,
      buildSearchText([trigger.name, trigger.schema, trigger.id, trigger.tableId])
    );
  }

  for (const procedure of schema.storedProcedures || []) {
    procedureSearch.set(
      procedure.id,
      buildSearchText([procedure.name, procedure.schema, procedure.id])
    );
  }

  for (const fn of schema.scalarFunctions || []) {
    functionSearch.set(
      fn.id,
      buildSearchText([fn.name, fn.schema, fn.id])
    );
  }

  for (const rel of schema.relationships) {
    columnsWithHandles.add(`${rel.from}-${rel.fromColumn}`);
    columnsWithHandles.add(`${rel.to}-${rel.toColumn}`);
    addNeighbor(rel.from, rel.to);
    addNeighbor(rel.to, rel.from);
  }

  for (const view of schema.views || []) {
    for (const col of view.columns) {
      if (!col.sourceTable || !col.sourceColumn) continue;

      const normalizedSource = col.sourceTable.replace(/[\[\]]/g, "");
      const sourceKey = normalizedSource.toLowerCase();
      let sourceTableId = nameToId.get(sourceKey);
      if (!sourceTableId) {
        const shortName = sourceKey.split(".").pop();
        if (shortName && shortName !== sourceKey) {
          sourceTableId = nameToId.get(shortName);
        }
      }
      if (!sourceTableId) continue;

      columnsWithHandles.add(`${view.id}-${col.name}`);
      columnsWithHandles.add(`${sourceTableId}-${col.sourceColumn}`);

      if (!viewColumnSources.has(view.id)) {
        viewColumnSources.set(view.id, []);
      }
      viewColumnSources.get(view.id)!.push({
        columnName: col.name,
        sourceTableId,
        sourceColumn: col.sourceColumn,
      });
    }
  }

  return {
    tableSearch,
    viewSearch,
    triggerSearch,
    procedureSearch,
    functionSearch,
    nameToId,
    viewColumnSources,
    columnsWithHandles,
    neighbors,
  };
}

export function getSchemaIndex(schema: SchemaGraph): SchemaIndex {
  const cached = schemaIndexCache.get(schema);
  if (cached) {
    return cached;
  }
  const built = buildSchemaIndex(schema);
  schemaIndexCache.set(schema, built);
  return built;
}
