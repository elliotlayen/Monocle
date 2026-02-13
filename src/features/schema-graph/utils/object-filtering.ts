import { getSchemaIndex, type SchemaIndex } from "@/lib/schema-index";
import type { ObjectType } from "@/features/schema-graph/store";
import type {
  SchemaGraph,
  ScalarFunction,
  StoredProcedure,
  TableNode,
  Trigger,
  ViewNode,
} from "@/features/schema-graph/types";

export type ObjectBuckets = {
  tables: TableNode[];
  views: ViewNode[];
  triggers: Trigger[];
  storedProcedures: StoredProcedure[];
  scalarFunctions: ScalarFunction[];
};

export interface FilteredObjectBuckets extends ObjectBuckets {
  tableIds: Set<string>;
  viewIds: Set<string>;
  visibleNodeIds: Set<string>;
}

interface GetFilteredObjectBucketsInput {
  schema: SchemaGraph;
  searchFilter: string;
  schemaFilter: string;
  objectTypeFilter: Set<ObjectType>;
  excludedObjectIds: Set<string>;
  focusedTableId: string | null;
  schemaIndex?: SchemaIndex;
}

const matchesSearch = (
  map: Map<string, string>,
  id: string,
  lowerSearch: string
) => {
  if (!lowerSearch) return true;
  const text = map.get(id);
  return text ? text.includes(lowerSearch) : false;
};

const hasContextReference = (
  tableIds: Set<string>,
  viewIds: Set<string>,
  references: string[]
) => references.some((tableId) => tableIds.has(tableId) || viewIds.has(tableId));

export function getFilteredObjectBuckets({
  schema,
  searchFilter,
  schemaFilter,
  objectTypeFilter,
  excludedObjectIds,
  focusedTableId,
  schemaIndex: optionalSchemaIndex,
}: GetFilteredObjectBucketsInput): FilteredObjectBuckets {
  const schemaIndex = optionalSchemaIndex ?? getSchemaIndex(schema);
  const lowerSearch = searchFilter.trim().toLowerCase();
  const focusedNeighbors = focusedTableId
    ? (schemaIndex.neighbors.get(focusedTableId) ?? new Set<string>())
    : new Set<string>();

  const showTables = objectTypeFilter.has("tables");
  const showViews = objectTypeFilter.has("views");
  const showTriggers = objectTypeFilter.has("triggers");
  const showProcedures = objectTypeFilter.has("storedProcedures");
  const showFunctions = objectTypeFilter.has("scalarFunctions");
  const isIncludedObject = (id: string) => !excludedObjectIds.has(id);

  let tables = showTables ? schema.tables.filter((t) => isIncludedObject(t.id)) : [];
  tables = tables.filter((table) =>
    matchesSearch(schemaIndex.tableSearch, table.id, lowerSearch)
  );
  if (schemaFilter && schemaFilter !== "all") {
    tables = tables.filter((table) => table.schema === schemaFilter);
  }
  if (focusedTableId) {
    tables = tables.filter(
      (table) => table.id === focusedTableId || focusedNeighbors.has(table.id)
    );
  }

  let views = showViews
    ? (schema.views || []).filter((view) => isIncludedObject(view.id))
    : [];
  views = views.filter((view) =>
    matchesSearch(schemaIndex.viewSearch, view.id, lowerSearch)
  );
  if (schemaFilter && schemaFilter !== "all") {
    views = views.filter((view) => view.schema === schemaFilter);
  }
  if (focusedTableId) {
    views = views.filter(
      (view) => view.id === focusedTableId || focusedNeighbors.has(view.id)
    );
  }

  const tableIds = new Set(tables.map((table) => table.id));
  const viewIds = new Set(views.map((view) => view.id));

  let triggers = showTriggers
    ? (schema.triggers || []).filter(
        (trigger) =>
          tableIds.has(trigger.tableId) && isIncludedObject(trigger.id)
      )
    : [];
  triggers = triggers.filter((trigger) =>
    matchesSearch(schemaIndex.triggerSearch, trigger.id, lowerSearch)
  );

  let storedProcedures = showProcedures
    ? (schema.storedProcedures || []).filter((proc) => isIncludedObject(proc.id))
    : [];
  if (schemaFilter && schemaFilter !== "all") {
    storedProcedures = storedProcedures.filter(
      (procedure) => procedure.schema === schemaFilter
    );
  }
  storedProcedures = storedProcedures.filter((procedure) =>
    matchesSearch(schemaIndex.procedureSearch, procedure.id, lowerSearch)
  );
  if (focusedTableId) {
    storedProcedures = storedProcedures.filter((procedure) =>
      hasContextReference(tableIds, viewIds, [
        ...(procedure.referencedTables || []),
        ...(procedure.affectedTables || []),
      ])
    );
  }

  let scalarFunctions = showFunctions
    ? (schema.scalarFunctions || []).filter((fn) => isIncludedObject(fn.id))
    : [];
  if (schemaFilter && schemaFilter !== "all") {
    scalarFunctions = scalarFunctions.filter(
      (fn) => fn.schema === schemaFilter
    );
  }
  scalarFunctions = scalarFunctions.filter((fn) =>
    matchesSearch(schemaIndex.functionSearch, fn.id, lowerSearch)
  );
  if (focusedTableId) {
    scalarFunctions = scalarFunctions.filter((fn) =>
      hasContextReference(tableIds, viewIds, fn.referencedTables || [])
    );
  }

  const visibleNodeIds = new Set<string>([
    ...tableIds,
    ...viewIds,
    ...triggers.map((trigger) => trigger.id),
    ...storedProcedures.map((procedure) => procedure.id),
    ...scalarFunctions.map((fn) => fn.id),
  ]);

  return {
    tables,
    views,
    triggers,
    storedProcedures,
    scalarFunctions,
    tableIds,
    viewIds,
    visibleNodeIds,
  };
}
