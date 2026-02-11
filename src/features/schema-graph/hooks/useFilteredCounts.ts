import { useMemo } from "react";
import { SchemaGraph } from "../types";
import { ObjectType, EdgeType } from "../store";
import { getSchemaIndex } from "@/lib/schema-index";

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
    scalarFunctions: { filtered: number; total: number };
  };
  edgeBreakdown: {
    relationships: { filtered: number; total: number };
    triggerDependencies: { filtered: number; total: number };
    triggerWrites: { filtered: number; total: number };
    procedureReads: { filtered: number; total: number };
    procedureWrites: { filtered: number; total: number };
    viewDependencies: { filtered: number; total: number };
    functionReads: { filtered: number; total: number };
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
          scalarFunctions: { filtered: 0, total: 0 },
        },
        edgeBreakdown: {
          relationships: { filtered: 0, total: 0 },
          triggerDependencies: { filtered: 0, total: 0 },
          triggerWrites: { filtered: 0, total: 0 },
          procedureReads: { filtered: 0, total: 0 },
          procedureWrites: { filtered: 0, total: 0 },
          viewDependencies: { filtered: 0, total: 0 },
          functionReads: { filtered: 0, total: 0 },
        },
      };
    }

    const schemaIndex = getSchemaIndex(schema);
    const lowerSearch = searchFilter.trim().toLowerCase();
    const hasSearch = lowerSearch.length > 0;
    const matchesSearch = (map: Map<string, string>, id: string) => {
      if (!hasSearch) return true;
      const text = map.get(id);
      return text ? text.includes(lowerSearch) : false;
    };

    // Calculate focused neighbors (tables/views connected to focused table)
    const focusedNeighbors = focusedTableId
      ? (schemaIndex.neighbors.get(focusedTableId) ?? new Set<string>())
      : new Set<string>();

    const showTables = objectTypeFilter.has("tables");
    const showViews = objectTypeFilter.has("views");
    const showTriggers = objectTypeFilter.has("triggers");
    const showProcedures = objectTypeFilter.has("storedProcedures");
    const showFunctions = objectTypeFilter.has("scalarFunctions");

    // Filter tables
    let filteredTables = showTables ? schema.tables : [];
    if (hasSearch) {
      filteredTables = filteredTables.filter((t) =>
        matchesSearch(schemaIndex.tableSearch, t.id)
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
    let filteredViews = showViews ? schema.views || [] : [];
    if (hasSearch) {
      filteredViews = filteredViews.filter((v) =>
        matchesSearch(schemaIndex.viewSearch, v.id)
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

    // Filter triggers
    const triggers = schema.triggers || [];
    let filteredTriggers = showTriggers
      ? triggers.filter((tr) => tableIds.has(tr.tableId))
      : [];
    if (hasSearch) {
      filteredTriggers = filteredTriggers.filter((tr) =>
        matchesSearch(schemaIndex.triggerSearch, tr.id)
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
    if (hasSearch) {
      filteredProcedures = filteredProcedures.filter((p) =>
        matchesSearch(schemaIndex.procedureSearch, p.id)
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

    // Filter scalar functions
    const scalarFunctions = schema.scalarFunctions || [];
    let filteredFunctions = showFunctions ? scalarFunctions : [];
    if (schemaFilter && schemaFilter !== "all") {
      filteredFunctions = filteredFunctions.filter(
        (f) => f.schema === schemaFilter
      );
    }
    if (hasSearch) {
      filteredFunctions = filteredFunctions.filter((f) =>
        matchesSearch(schemaIndex.functionSearch, f.id)
      );
    }
    // For functions during focus, only count those connected to focused tables
    if (focusedTableId) {
      filteredFunctions = filteredFunctions.filter((f) => {
        const referencedTables = f.referencedTables || [];
        return referencedTables.some(
          (tableId) => tableIds.has(tableId) || viewIds.has(tableId)
        );
      });
    }

    // Calculate edge counts
    let relationshipCount = 0;
    if (edgeTypeFilter.has("relationships")) {
      schema.relationships.forEach((rel) => {
        if (
          (tableIds.has(rel.from) || viewIds.has(rel.from)) &&
          (tableIds.has(rel.to) || viewIds.has(rel.to))
        ) {
          relationshipCount++;
        }
      });
    }

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
        const sources = schemaIndex.viewColumnSources.get(view.id) ?? [];
        sources.forEach((source) => {
          if (
            tableIds.has(source.sourceTableId) ||
            viewIds.has(source.sourceTableId)
          ) {
            viewDepCount++;
          }
        });
      });
    }

    // Function reads edges
    let funcReadsCount = 0;
    if (edgeTypeFilter.has("functionReads")) {
      filteredFunctions.forEach((fn) => {
        (fn.referencedTables || []).forEach((tableId) => {
          if (tableIds.has(tableId) || viewIds.has(tableId)) {
            funcReadsCount++;
          }
        });
      });
    }

    // Total edges (all edge types enabled, all objects visible)
    const allTables = schema.tables;
    const allViews = schema.views || [];
    const allTriggers = schema.triggers || [];
    const allProcedures = schema.storedProcedures || [];
    const allFunctions = schema.scalarFunctions || [];
    const allTableIds = new Set(allTables.map((t) => t.id));
    const allViewIds = new Set(allViews.map((v) => v.id));

    // Calculate total counts per edge type
    let totalRelationshipEdges = 0;
    schema.relationships.forEach((rel) => {
      if (
        (allTableIds.has(rel.from) || allViewIds.has(rel.from)) &&
        (allTableIds.has(rel.to) || allViewIds.has(rel.to))
      ) {
        totalRelationshipEdges++;
      }
    });

    let totalTriggerDepEdges = 0;
    allTriggers.forEach((trigger) => {
      if (allTableIds.has(trigger.tableId)) {
        totalTriggerDepEdges++;
      }
      (trigger.referencedTables || []).forEach((tableId) => {
        if (
          (allTableIds.has(tableId) || allViewIds.has(tableId)) &&
          tableId !== trigger.tableId
        ) {
          totalTriggerDepEdges++;
        }
      });
    });

    let totalTriggerWritesEdges = 0;
    allTriggers.forEach((trigger) => {
      (trigger.affectedTables || []).forEach((tableId) => {
        if (
          (allTableIds.has(tableId) || allViewIds.has(tableId)) &&
          tableId !== trigger.tableId
        ) {
          totalTriggerWritesEdges++;
        }
      });
    });

    let totalProcReadsEdges = 0;
    allProcedures.forEach((procedure) => {
      (procedure.referencedTables || []).forEach((tableId) => {
        if (allTableIds.has(tableId) || allViewIds.has(tableId)) {
          totalProcReadsEdges++;
        }
      });
    });

    let totalProcWritesEdges = 0;
    allProcedures.forEach((procedure) => {
      (procedure.affectedTables || []).forEach((tableId) => {
        if (allTableIds.has(tableId) || allViewIds.has(tableId)) {
          totalProcWritesEdges++;
        }
      });
    });

    let totalViewDepEdges = 0;
    schemaIndex.viewColumnSources.forEach((sources) => {
      totalViewDepEdges += sources.length;
    });

    let totalFuncReadsEdges = 0;
    allFunctions.forEach((fn) => {
      (fn.referencedTables || []).forEach((tableId) => {
        if (allTableIds.has(tableId) || allViewIds.has(tableId)) {
          totalFuncReadsEdges++;
        }
      });
    });

    const totalEdgeCount =
      totalRelationshipEdges +
      totalTriggerDepEdges +
      totalTriggerWritesEdges +
      totalProcReadsEdges +
      totalProcWritesEdges +
      totalViewDepEdges +
      totalFuncReadsEdges;

    const filteredEdges =
      relationshipCount +
      triggerDepCount +
      triggerWritesCount +
      procReadsCount +
      procWritesCount +
      viewDepCount +
      funcReadsCount;

    const totalObjects =
      schema.tables.length +
      (schema.views?.length || 0) +
      (schema.triggers?.length || 0) +
      (schema.storedProcedures?.length || 0) +
      (schema.scalarFunctions?.length || 0);

    const filteredObjects =
      filteredTables.length +
      filteredViews.length +
      filteredTriggers.length +
      filteredProcedures.length +
      filteredFunctions.length;

    return {
      filteredObjects,
      totalObjects,
      filteredEdges,
      totalEdges: totalEdgeCount,
      breakdown: {
        tables: {
          filtered: filteredTables.length,
          total: schema.tables.length,
        },
        views: {
          filtered: filteredViews.length,
          total: schema.views?.length || 0,
        },
        triggers: {
          filtered: filteredTriggers.length,
          total: schema.triggers?.length || 0,
        },
        storedProcedures: {
          filtered: filteredProcedures.length,
          total: schema.storedProcedures?.length || 0,
        },
        scalarFunctions: {
          filtered: filteredFunctions.length,
          total: schema.scalarFunctions?.length || 0,
        },
      },
      edgeBreakdown: {
        relationships: {
          filtered: relationshipCount,
          total: totalRelationshipEdges,
        },
        triggerDependencies: {
          filtered: triggerDepCount,
          total: totalTriggerDepEdges,
        },
        triggerWrites: {
          filtered: triggerWritesCount,
          total: totalTriggerWritesEdges,
        },
        procedureReads: {
          filtered: procReadsCount,
          total: totalProcReadsEdges,
        },
        procedureWrites: {
          filtered: procWritesCount,
          total: totalProcWritesEdges,
        },
        viewDependencies: { filtered: viewDepCount, total: totalViewDepEdges },
        functionReads: { filtered: funcReadsCount, total: totalFuncReadsEdges },
      },
    };
  }, [
    schema,
    searchFilter,
    schemaFilter,
    objectTypeFilter,
    edgeTypeFilter,
    focusedTableId,
  ]);
}
