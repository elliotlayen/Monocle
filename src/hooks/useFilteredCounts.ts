import { useMemo } from "react";
import { SchemaGraph } from "@/types/schema";
import { ObjectType, EdgeType } from "@/stores/schemaStore";

interface FilteredCounts {
  filteredObjects: number;
  totalObjects: number;
  filteredEdges: number;
  totalEdges: number;
  breakdown: {
    tables: { filtered: number; total: number };
    views: { filtered: number; total: number };
    triggers: { filtered: number; total: number };
    storedProcedures: { filtered: number; total: number };
  };
}

export function useFilteredCounts(
  schema: SchemaGraph | null,
  searchFilter: string,
  schemaFilter: string,
  objectTypeFilter: Set<ObjectType>,
  edgeTypeFilter: Set<EdgeType>,
  focusedTableId: string | null
): FilteredCounts {
  return useMemo(() => {
    if (!schema) {
      return {
        filteredObjects: 0,
        totalObjects: 0,
        filteredEdges: 0,
        totalEdges: 0,
        breakdown: {
          tables: { filtered: 0, total: 0 },
          views: { filtered: 0, total: 0 },
          triggers: { filtered: 0, total: 0 },
          storedProcedures: { filtered: 0, total: 0 },
        },
      };
    }

    // Calculate focused neighbors (tables/views connected to focused table)
    const focusedNeighbors = new Set<string>();
    if (focusedTableId) {
      schema.relationships.forEach((rel) => {
        if (rel.from === focusedTableId) focusedNeighbors.add(rel.to);
        if (rel.to === focusedTableId) focusedNeighbors.add(rel.from);
      });
    }

    const showTables = objectTypeFilter.has("tables");
    const showViews = objectTypeFilter.has("views");
    const showTriggers = objectTypeFilter.has("triggers");
    const showProcedures = objectTypeFilter.has("storedProcedures");

    // Filter tables
    let filteredTables = showTables ? schema.tables : [];
    if (searchFilter) {
      const lowerSearch = searchFilter.toLowerCase();
      filteredTables = filteredTables.filter(
        (t) =>
          t.name.toLowerCase().includes(lowerSearch) ||
          t.schema.toLowerCase().includes(lowerSearch) ||
          t.id.toLowerCase().includes(lowerSearch) ||
          t.columns.some((col) => col.name.toLowerCase().includes(lowerSearch))
      );
    }
    if (schemaFilter && schemaFilter !== "all") {
      filteredTables = filteredTables.filter((t) => t.schema === schemaFilter);
    }
    // Apply focus filter - only count focused table and its neighbors
    if (focusedTableId) {
      filteredTables = filteredTables.filter(
        (t) => t.id === focusedTableId || focusedNeighbors.has(t.id)
      );
    }

    // Filter views
    let filteredViews = showViews ? (schema.views || []) : [];
    if (searchFilter) {
      const lowerSearch = searchFilter.toLowerCase();
      filteredViews = filteredViews.filter(
        (v) =>
          v.name.toLowerCase().includes(lowerSearch) ||
          v.schema.toLowerCase().includes(lowerSearch) ||
          v.id.toLowerCase().includes(lowerSearch) ||
          v.columns.some((col) => col.name.toLowerCase().includes(lowerSearch))
      );
    }
    if (schemaFilter && schemaFilter !== "all") {
      filteredViews = filteredViews.filter((v) => v.schema === schemaFilter);
    }
    // Apply focus filter to views
    if (focusedTableId) {
      filteredViews = filteredViews.filter(
        (v) => v.id === focusedTableId || focusedNeighbors.has(v.id)
      );
    }

    const tableIds = new Set(filteredTables.map((t) => t.id));
    const viewIds = new Set(filteredViews.map((v) => v.id));
    const allNodeIds = new Set([...tableIds, ...viewIds]);

    // Filter triggers
    const triggers = schema.triggers || [];
    let filteredTriggers = showTriggers
      ? triggers.filter((tr) => tableIds.has(tr.tableId))
      : [];
    if (searchFilter) {
      const lowerSearch = searchFilter.toLowerCase();
      filteredTriggers = filteredTriggers.filter((tr) =>
        tr.name.toLowerCase().includes(lowerSearch)
      );
    }
    // Focus filter already applied via tableIds

    // Filter stored procedures
    const storedProcedures = schema.storedProcedures || [];
    let filteredProcedures = showProcedures ? storedProcedures : [];
    if (schemaFilter && schemaFilter !== "all") {
      filteredProcedures = filteredProcedures.filter(
        (p) => p.schema === schemaFilter
      );
    }
    if (searchFilter) {
      const lowerSearch = searchFilter.toLowerCase();
      filteredProcedures = filteredProcedures.filter((p) =>
        p.name.toLowerCase().includes(lowerSearch)
      );
    }
    // For procedures during focus, only count those connected to focused tables
    if (focusedTableId) {
      filteredProcedures = filteredProcedures.filter((p) => {
        const referencedTables = p.referencedTables || [];
        const affectedTables = p.affectedTables || [];
        return [...referencedTables, ...affectedTables].some(
          (tableId) => tableIds.has(tableId) || viewIds.has(tableId)
        );
      });
    }

    // Calculate edge counts
    // FK edges
    const fkEdgeCount = edgeTypeFilter.has("foreignKeys")
      ? schema.relationships.filter(
          (rel) => tableIds.has(rel.from) && tableIds.has(rel.to)
        ).length
      : 0;

    // Trigger dependency edges (trigger to parent table + trigger to referenced tables)
    let triggerDepCount = 0;
    if (edgeTypeFilter.has("triggerDependencies")) {
      // Trigger to parent table edges
      triggerDepCount += filteredTriggers.filter((tr) =>
        tableIds.has(tr.tableId)
      ).length;
      // Trigger to referenced tables edges
      filteredTriggers.forEach((trigger) => {
        (trigger.referencedTables || []).forEach((tableId) => {
          if (
            (tableIds.has(tableId) || viewIds.has(tableId)) &&
            tableId !== trigger.tableId
          ) {
            triggerDepCount++;
          }
        });
      });
    }

    // Trigger writes edges
    let triggerWritesCount = 0;
    if (edgeTypeFilter.has("triggerWrites")) {
      filteredTriggers.forEach((trigger) => {
        (trigger.affectedTables || []).forEach((tableId) => {
          if (
            (tableIds.has(tableId) || viewIds.has(tableId)) &&
            tableId !== trigger.tableId
          ) {
            triggerWritesCount++;
          }
        });
      });
    }

    // Procedure reads edges
    let procReadsCount = 0;
    if (edgeTypeFilter.has("procedureReads")) {
      filteredProcedures.forEach((procedure) => {
        (procedure.referencedTables || []).forEach((tableId) => {
          if (tableIds.has(tableId) || viewIds.has(tableId)) {
            procReadsCount++;
          }
        });
      });
    }

    // Procedure writes edges
    let procWritesCount = 0;
    if (edgeTypeFilter.has("procedureWrites")) {
      filteredProcedures.forEach((procedure) => {
        (procedure.affectedTables || []).forEach((tableId) => {
          if (tableIds.has(tableId) || viewIds.has(tableId)) {
            procWritesCount++;
          }
        });
      });
    }

    // View dependency edges
    let viewDepCount = 0;
    if (edgeTypeFilter.has("viewDependencies")) {
      filteredViews.forEach((view) => {
        view.columns.forEach((col) => {
          if (col.sourceTable && col.sourceColumn) {
            const sourceTableId = [...allNodeIds].find(
              (id) =>
                id.endsWith(`.${col.sourceTable}`) || id === col.sourceTable
            );
            if (sourceTableId) {
              viewDepCount++;
            }
          }
        });
      });
    }

    // Total edges (all edge types enabled, all objects visible)
    const allTables = schema.tables;
    const allViews = schema.views || [];
    const allTriggers = schema.triggers || [];
    const allProcedures = schema.storedProcedures || [];
    const allTableIds = new Set(allTables.map((t) => t.id));
    const allViewIds = new Set(allViews.map((v) => v.id));
    const allAllNodeIds = new Set([...allTableIds, ...allViewIds]);

    let totalEdgeCount = 0;
    // All FK edges
    totalEdgeCount += schema.relationships.filter(
      (rel) => allTableIds.has(rel.from) && allTableIds.has(rel.to)
    ).length;
    // All trigger dep edges
    allTriggers.forEach((trigger) => {
      if (allTableIds.has(trigger.tableId)) {
        totalEdgeCount++; // parent edge
      }
      (trigger.referencedTables || []).forEach((tableId) => {
        if (
          (allTableIds.has(tableId) || allViewIds.has(tableId)) &&
          tableId !== trigger.tableId
        ) {
          totalEdgeCount++;
        }
      });
    });
    // All trigger writes edges
    allTriggers.forEach((trigger) => {
      (trigger.affectedTables || []).forEach((tableId) => {
        if (
          (allTableIds.has(tableId) || allViewIds.has(tableId)) &&
          tableId !== trigger.tableId
        ) {
          totalEdgeCount++;
        }
      });
    });
    // All proc reads edges
    allProcedures.forEach((procedure) => {
      (procedure.referencedTables || []).forEach((tableId) => {
        if (allTableIds.has(tableId) || allViewIds.has(tableId)) {
          totalEdgeCount++;
        }
      });
    });
    // All proc writes edges
    allProcedures.forEach((procedure) => {
      (procedure.affectedTables || []).forEach((tableId) => {
        if (allTableIds.has(tableId) || allViewIds.has(tableId)) {
          totalEdgeCount++;
        }
      });
    });
    // All view dep edges
    allViews.forEach((view) => {
      view.columns.forEach((col) => {
        if (col.sourceTable && col.sourceColumn) {
          const sourceTableId = [...allAllNodeIds].find(
            (id) => id.endsWith(`.${col.sourceTable}`) || id === col.sourceTable
          );
          if (sourceTableId) {
            totalEdgeCount++;
          }
        }
      });
    });

    const filteredEdges =
      fkEdgeCount +
      triggerDepCount +
      triggerWritesCount +
      procReadsCount +
      procWritesCount +
      viewDepCount;

    const totalObjects =
      schema.tables.length +
      (schema.views?.length || 0) +
      (schema.triggers?.length || 0) +
      (schema.storedProcedures?.length || 0);

    const filteredObjects =
      filteredTables.length +
      filteredViews.length +
      filteredTriggers.length +
      filteredProcedures.length;

    return {
      filteredObjects,
      totalObjects,
      filteredEdges,
      totalEdges: totalEdgeCount,
      breakdown: {
        tables: { filtered: filteredTables.length, total: schema.tables.length },
        views: { filtered: filteredViews.length, total: schema.views?.length || 0 },
        triggers: { filtered: filteredTriggers.length, total: schema.triggers?.length || 0 },
        storedProcedures: { filtered: filteredProcedures.length, total: schema.storedProcedures?.length || 0 },
      },
    };
  }, [schema, searchFilter, schemaFilter, objectTypeFilter, edgeTypeFilter, focusedTableId]);
}
