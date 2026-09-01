import type { SchemaIndex } from "@/lib/schema-index";
import type { FilteredObjectBuckets } from "../utils/object-filtering";

export interface FocusState {
  focusedNeighbors: Set<string>;
  dimmedNodeIds: Set<string>;
  renderableNodeIds: Set<string>;
  visibleNonDimmedCount: number;
}

const EMPTY_SET: Set<string> = new Set();

/**
 * Derive focus-mode state from the filtered visibility buckets: which visible
 * nodes are dimmed (outside the focused neighborhood), which remain
 * renderable for edges, and how many tables/views stay expanded.
 */
export function computeFocusState(
  visibility: FilteredObjectBuckets,
  focusedTableId: string | null,
  schemaIndex: SchemaIndex
): FocusState {
  const { tableIds, viewIds, triggers, storedProcedures, scalarFunctions } =
    visibility;

  if (!focusedTableId) {
    return {
      focusedNeighbors: EMPTY_SET,
      dimmedNodeIds: EMPTY_SET,
      renderableNodeIds: visibility.visibleNodeIds,
      visibleNonDimmedCount: tableIds.size + viewIds.size,
    };
  }

  const focusedNeighbors =
    schemaIndex.neighbors.get(focusedTableId) ?? EMPTY_SET;
  const isNeighbor = (nodeId: string) => focusedNeighbors.has(nodeId);
  const dimmedNodeIds = new Set<string>();

  // Tables and views: dimmed if not focused and not a neighbor.
  for (const id of [...tableIds, ...viewIds]) {
    if (id !== focusedTableId && !isNeighbor(id)) {
      dimmedNodeIds.add(id);
    }
  }

  // Triggers: dimmed if their table is not focused and not a neighbor.
  for (const trigger of triggers) {
    if (trigger.tableId !== focusedTableId && !isNeighbor(trigger.tableId)) {
      dimmedNodeIds.add(trigger.id);
    }
  }

  // Procedures: dimmed if none of their tables are focused or a neighbor.
  for (const procedure of storedProcedures) {
    const refs = [
      ...(procedure.referencedTables || []),
      ...(procedure.affectedTables || []),
    ];
    if (
      !refs.some((tableId) => tableId === focusedTableId || isNeighbor(tableId))
    ) {
      dimmedNodeIds.add(procedure.id);
    }
  }

  // Functions: dimmed if none of their tables are focused or a neighbor.
  for (const fn of scalarFunctions) {
    const refs = fn.referencedTables || [];
    if (
      !refs.some((tableId) => tableId === focusedTableId || isNeighbor(tableId))
    ) {
      dimmedNodeIds.add(fn.id);
    }
  }

  const renderableNodeIds = new Set(
    [...visibility.visibleNodeIds].filter((id) => !dimmedNodeIds.has(id))
  );
  const visibleNonDimmedCount = [...tableIds, ...viewIds].filter(
    (id) => !dimmedNodeIds.has(id)
  ).length;

  return {
    focusedNeighbors,
    dimmedNodeIds,
    renderableNodeIds,
    visibleNonDimmedCount,
  };
}
