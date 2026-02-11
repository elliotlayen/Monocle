import type { SchemaGraph } from "@/features/schema-graph/types";
import { buildColumnHandleBase } from "@/features/schema-graph/utils/handle-ids";

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
  fkColumnUsage: Map<string, { outgoing: number; incoming: number }>;
  fkColumnLinks: Map<
    string,
    { direction: "outgoing" | "incoming"; tableId: string; column: string }[]
  >;
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
  const fkColumnUsage = new Map<
    string,
    { outgoing: number; incoming: number }
  >();
  const fkColumnLinks = new Map<
    string,
    { direction: "outgoing" | "incoming"; tableId: string; column: string }[]
  >();
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
      buildSearchText([
        trigger.name,
        trigger.schema,
        trigger.id,
        trigger.tableId,
      ])
    );
  }

  for (const procedure of schema.storedProcedures || []) {
    procedureSearch.set(
      procedure.id,
      buildSearchText([procedure.name, procedure.schema, procedure.id])
    );
  }

  for (const fn of schema.scalarFunctions || []) {
    functionSearch.set(fn.id, buildSearchText([fn.name, fn.schema, fn.id]));
  }

  for (const rel of schema.relationships) {
    if (rel.fromColumn) {
      const key = buildColumnHandleBase(rel.from, rel.fromColumn);
      columnsWithHandles.add(key);
      const current = fkColumnUsage.get(key) ?? { outgoing: 0, incoming: 0 };
      fkColumnUsage.set(key, {
        ...current,
        outgoing: current.outgoing + 1,
      });
      const links = fkColumnLinks.get(key) ?? [];
      if (rel.toColumn) {
        links.push({
          direction: "outgoing",
          tableId: rel.to,
          column: rel.toColumn,
        });
      } else {
        links.push({ direction: "outgoing", tableId: rel.to, column: "" });
      }
      fkColumnLinks.set(key, links);
    }
    if (rel.toColumn) {
      const key = buildColumnHandleBase(rel.to, rel.toColumn);
      columnsWithHandles.add(key);
      const current = fkColumnUsage.get(key) ?? { outgoing: 0, incoming: 0 };
      fkColumnUsage.set(key, {
        ...current,
        incoming: current.incoming + 1,
      });
      const links = fkColumnLinks.get(key) ?? [];
      if (rel.fromColumn) {
        links.push({
          direction: "incoming",
          tableId: rel.from,
          column: rel.fromColumn,
        });
      } else {
        links.push({ direction: "incoming", tableId: rel.from, column: "" });
      }
      fkColumnLinks.set(key, links);
    }
    addNeighbor(rel.from, rel.to);
    addNeighbor(rel.to, rel.from);
  }

  // Add trigger -> table relationships for focus feature
  for (const trigger of schema.triggers || []) {
    addNeighbor(trigger.id, trigger.tableId);
    addNeighbor(trigger.tableId, trigger.id);
    for (const tableId of trigger.referencedTables || []) {
      addNeighbor(trigger.id, tableId);
    }
    for (const tableId of trigger.affectedTables || []) {
      addNeighbor(trigger.id, tableId);
    }
  }

  // Add procedure -> table relationships for focus feature
  for (const proc of schema.storedProcedures || []) {
    for (const tableId of proc.referencedTables || []) {
      addNeighbor(proc.id, tableId);
    }
    for (const tableId of proc.affectedTables || []) {
      addNeighbor(proc.id, tableId);
    }
  }

  // Add function -> table relationships for focus feature
  for (const fn of schema.scalarFunctions || []) {
    for (const tableId of fn.referencedTables || []) {
      addNeighbor(fn.id, tableId);
    }
  }

  for (const view of schema.views || []) {
    const seenSources = new Set<string>();
    for (const col of view.columns) {
      const sources =
        col.sourceColumns && col.sourceColumns.length > 0
          ? col.sourceColumns
          : col.sourceTable && col.sourceColumn
            ? [{ table: col.sourceTable, column: col.sourceColumn }]
            : [];
      if (sources.length === 0) continue;

      for (const source of sources) {
        const normalizedSource = source.table.replace(/[[\]]/g, "");
        const sourceKey = normalizedSource.toLowerCase();
        let sourceTableId = nameToId.get(sourceKey);
        if (!sourceTableId) {
          const shortName = sourceKey.split(".").pop();
          if (shortName && shortName !== sourceKey) {
            sourceTableId = nameToId.get(shortName);
          }
        }
        if (!sourceTableId) continue;

        columnsWithHandles.add(buildColumnHandleBase(view.id, col.name));
        columnsWithHandles.add(
          buildColumnHandleBase(sourceTableId, source.column)
        );

        if (!viewColumnSources.has(view.id)) {
          viewColumnSources.set(view.id, []);
        }
        const key = `${col.name}::${sourceTableId}::${source.column}`;
        if (!seenSources.has(key)) {
          seenSources.add(key);
          viewColumnSources.get(view.id)!.push({
            columnName: col.name,
            sourceTableId,
            sourceColumn: source.column,
          });
        }
      }
    }
  }

  // Add view -> source table relationships for focus feature
  for (const [viewId, sources] of viewColumnSources) {
    const sourceTableIds = new Set(sources.map((s) => s.sourceTableId));
    for (const tableId of sourceTableIds) {
      addNeighbor(viewId, tableId);
      addNeighbor(tableId, viewId);
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
    fkColumnUsage,
    fkColumnLinks,
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
