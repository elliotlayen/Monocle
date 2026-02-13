import { useMemo } from "react";
import { SchemaGraph } from "../types";
import { ObjectType, EdgeType } from "../store";
import { getSchemaIndex } from "@/lib/schema-index";
import { getFilteredObjectBuckets } from "@/features/schema-graph/utils/object-filtering";

export interface FilteredCounts {
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
  excludedObjectIds: Set<string>,
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
    const {
      tables: filteredTables,
      views: filteredViews,
      triggers: filteredTriggers,
      storedProcedures: filteredProcedures,
      scalarFunctions: filteredFunctions,
      tableIds,
      viewIds,
    } = getFilteredObjectBuckets({
      schema,
      searchFilter,
      schemaFilter,
      objectTypeFilter,
      excludedObjectIds,
      focusedTableId,
      schemaIndex,
    });

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
    excludedObjectIds,
    edgeTypeFilter,
    focusedTableId,
  ]);
}
