import { useMemo, useState, useEffect, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type EdgeMouseHandler,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import {
  SchemaGraph as SchemaGraphType,
  TableNode as TableNodeType,
  ViewNode as ViewNodeType,
  Trigger,
  StoredProcedure,
} from "@/types/schema";
import { ObjectType, EdgeType, useSchemaStore } from "@/stores/schemaStore";
import { TableNode } from "./table-node";
import { ViewNode } from "./view-node";
import { TriggerNode } from "./trigger-node";
import { StoredProcedureNode } from "./stored-procedure-node";
import { DetailModal, DetailModalData } from "./detail-modal";

// Define custom node types outside component to prevent re-renders
const nodeTypes = {
  tableNode: TableNode,
  viewNode: ViewNode,
  triggerNode: TriggerNode,
  storedProcedureNode: StoredProcedureNode,
};

// MiniMap node color function - defined outside component for stable reference
function getMinimapNodeColor(node: Node): string {
  if (node.data?.isFocused) return "#3b82f6";
  if (node.data?.isDimmed) return "var(--color-muted)";
  if (node.type === "viewNode") return "#10b981";
  if (node.type === "triggerNode") return "#f59e0b";
  if (node.type === "storedProcedureNode") return "#8b5cf6";
  return "#64748b";
}

interface SchemaGraphProps {
  schema: SchemaGraphType;
  focusedTableId?: string | null;
  searchFilter?: string;
  schemaFilter?: string;
  objectTypeFilter?: Set<ObjectType>;
  edgeTypeFilter?: Set<EdgeType>;
}

// Callback types for node clicks
interface ConvertOptions {
  onTableClick?: (table: TableNodeType) => void;
  onViewClick?: (view: ViewNodeType) => void;
  onTriggerClick?: (trigger: Trigger) => void;
  onProcedureClick?: (procedure: StoredProcedure) => void;
}

// Pre-compute which columns have relationships (for conditional handle rendering)
function computeColumnsWithHandles(schema: SchemaGraphType): Set<string> {
  const cols = new Set<string>();

  // Add columns from FK relationships
  schema.relationships.forEach((rel) => {
    cols.add(`${rel.from}-${rel.fromColumn}`);
    cols.add(`${rel.to}-${rel.toColumn}`);
  });

  // Add columns from view column sources
  (schema.views || []).forEach((view) => {
    view.columns.forEach((col) => {
      if (col.sourceTable && col.sourceColumn) {
        // Add the view column
        cols.add(`${view.id}-${col.name}`);
        // Add the source table column (need to find table ID)
        const allTables = schema.tables;
        const allViews = schema.views || [];
        const sourceTableId = [...allTables.map(t => t.id), ...allViews.map(v => v.id)].find(
          (id) => id.endsWith(`.${col.sourceTable}`) || id === col.sourceTable
        );
        if (sourceTableId) {
          cols.add(`${sourceTableId}-${col.sourceColumn}`);
        }
      }
    });
  });

  return cols;
}

// Convert SchemaGraph to React Flow format
function convertToFlowElements(
  schema: SchemaGraphType,
  focusedTableId?: string | null,
  searchFilter?: string,
  schemaFilter?: string,
  objectTypeFilter?: Set<ObjectType>,
  edgeTypeFilter?: Set<EdgeType>,
  selectedEdgeIds?: Set<string>,
  options?: ConvertOptions,
  columnsWithHandles?: Set<string>
): { nodes: Node[]; edges: Edge[]; handleEdgeTypes: Map<string, Set<EdgeType>> } {
  const showTables = !objectTypeFilter || objectTypeFilter.has("tables");
  const showViews = !objectTypeFilter || objectTypeFilter.has("views");
  const showTriggers = !objectTypeFilter || objectTypeFilter.has("triggers");
  const showProcedures =
    !objectTypeFilter || objectTypeFilter.has("storedProcedures");

  // Filter tables based on search and schema
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

  // Filter views based on search and schema
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

  const tableIds = new Set(filteredTables.map((t) => t.id));
  const viewIds = new Set(filteredViews.map((v) => v.id));

  // Filter triggers and stored procedures based on schema filter and object type
  const triggers = schema.triggers || [];
  const storedProcedures = schema.storedProcedures || [];

  let filteredTriggers = showTriggers
    ? triggers.filter((tr) => tableIds.has(tr.tableId))
    : [];
  let filteredProcedures = showProcedures ? storedProcedures : [];

  if (schemaFilter && schemaFilter !== "all") {
    filteredProcedures = filteredProcedures.filter(
      (p) => p.schema === schemaFilter
    );
  }

  if (searchFilter) {
    const lowerSearch = searchFilter.toLowerCase();
    filteredTriggers = filteredTriggers.filter((tr) =>
      tr.name.toLowerCase().includes(lowerSearch)
    );
    filteredProcedures = filteredProcedures.filter((p) =>
      p.name.toLowerCase().includes(lowerSearch)
    );
  }

  // Compute edge types for each handle (for color indicators)
  // This must use the same filtering as edge creation to stay in sync
  const handleEdgeTypes = new Map<string, Set<EdgeType>>();
  const addEdgeType = (handleId: string, edgeType: EdgeType) => {
    if (!handleEdgeTypes.has(handleId)) {
      handleEdgeTypes.set(handleId, new Set());
    }
    handleEdgeTypes.get(handleId)!.add(edgeType);
  };

  // Foreign keys - column-level handles (only for visible tables)
  if (!edgeTypeFilter || edgeTypeFilter.has("foreignKeys")) {
    schema.relationships
      .filter((rel) => tableIds.has(rel.from) && tableIds.has(rel.to))
      .forEach((rel) => {
        addEdgeType(`${rel.from}-${rel.fromColumn}-source`, "foreignKeys");
        addEdgeType(`${rel.to}-${rel.toColumn}-target`, "foreignKeys");
      });
  }

  // Trigger dependencies - table header handles (only for filtered triggers)
  if (!edgeTypeFilter || edgeTypeFilter.has("triggerDependencies")) {
    filteredTriggers
      .filter((tr) => tableIds.has(tr.tableId))
      .forEach((trigger) => {
        addEdgeType(`${trigger.tableId}-source`, "triggerDependencies");
        (trigger.referencedTables || [])
          .filter((tId) => (tableIds.has(tId) || viewIds.has(tId)) && tId !== trigger.tableId)
          .forEach((tId) => {
            addEdgeType(`${tId}-target`, "triggerDependencies");
          });
      });
  }

  // Trigger writes - table header handles (only for filtered triggers)
  if (!edgeTypeFilter || edgeTypeFilter.has("triggerWrites")) {
    filteredTriggers.forEach((trigger) => {
      (trigger.affectedTables || [])
        .filter((tId) => (tableIds.has(tId) || viewIds.has(tId)) && tId !== trigger.tableId)
        .forEach((tId) => {
          addEdgeType(`${tId}-target`, "triggerWrites");
        });
    });
  }

  // Procedure reads - table header handles (only for filtered procedures)
  if (!edgeTypeFilter || edgeTypeFilter.has("procedureReads")) {
    filteredProcedures.forEach((procedure) => {
      (procedure.referencedTables || [])
        .filter((tId) => tableIds.has(tId) || viewIds.has(tId))
        .forEach((tId) => {
          addEdgeType(`${tId}-source`, "procedureReads");
        });
    });
  }

  // Procedure writes - table header handles (only for filtered procedures)
  if (!edgeTypeFilter || edgeTypeFilter.has("procedureWrites")) {
    filteredProcedures.forEach((procedure) => {
      (procedure.affectedTables || [])
        .filter((tId) => tableIds.has(tId) || viewIds.has(tId))
        .forEach((tId) => {
          addEdgeType(`${tId}-target`, "procedureWrites");
        });
    });
  }

  // View dependencies - column-level handles (only for filtered views)
  if (!edgeTypeFilter || edgeTypeFilter.has("viewDependencies")) {
    const visibleNodeIds = new Set([...tableIds, ...viewIds]);
    filteredViews.forEach((view) => {
      view.columns
        .filter((col) => col.sourceTable && col.sourceColumn)
        .forEach((col) => {
          const sourceTableId = [...visibleNodeIds].find(
            (id) => id.endsWith(`.${col.sourceTable}`) || id === col.sourceTable
          );
          if (sourceTableId) {
            addEdgeType(`${sourceTableId}-${col.sourceColumn}-source`, "viewDependencies");
            addEdgeType(`${view.id}-${col.name}-target`, "viewDependencies");
          }
        });
    });
  }

  // Debug: Log handleEdgeTypes to understand indicator computation
  if (handleEdgeTypes.size > 0) {
    console.log('handleEdgeTypes:', Object.fromEntries([...handleEdgeTypes.entries()].map(([k, v]) => [k, [...v]])));
  }

  // Calculate focused neighbors
  const focusedNeighbors = new Set<string>();
  if (focusedTableId) {
    schema.relationships.forEach((rel) => {
      if (rel.from === focusedTableId) focusedNeighbors.add(rel.to);
      if (rel.to === focusedTableId) focusedNeighbors.add(rel.from);
    });
  }

  // Convert tables to nodes with grid layout
  const GRID_COLS = 3;
  const NODE_WIDTH = 300;
  const NODE_HEIGHT = 250;
  const GAP_X = 120;
  const GAP_Y = 100;

  // Track table and view positions for trigger placement
  const tablePositions: Record<string, { x: number; y: number }> = {};

  const tableNodes: Node[] = filteredTables.map((table, index) => {
    const col = index % GRID_COLS;
    const row = Math.floor(index / GRID_COLS);

    const isDimmed =
      focusedTableId !== null &&
      focusedTableId !== undefined &&
      table.id !== focusedTableId &&
      !focusedNeighbors.has(table.id);

    const position = {
      x: col * (NODE_WIDTH + GAP_X),
      y: row * (NODE_HEIGHT + GAP_Y),
    };
    tablePositions[table.id] = position;

    return {
      id: table.id,
      type: "tableNode",
      position,
      data: {
        table,
        isFocused: table.id === focusedTableId,
        isDimmed,
        columnsWithHandles,
        handleEdgeTypes,
        onClick: () => options?.onTableClick?.(table),
      },
    };
  });

  // Calculate starting row for views (after tables)
  const tableRowCount = Math.ceil(filteredTables.length / GRID_COLS);
  const viewStartY = tableRowCount * (NODE_HEIGHT + GAP_Y);

  // Convert views to nodes - positioned below tables
  const viewNodes: Node[] = filteredViews.map((view, index) => {
    const col = index % GRID_COLS;
    const row = Math.floor(index / GRID_COLS);

    const isDimmed =
      focusedTableId !== null &&
      focusedTableId !== undefined &&
      view.id !== focusedTableId &&
      !focusedNeighbors.has(view.id);

    const position = {
      x: col * (NODE_WIDTH + GAP_X),
      y: viewStartY + row * (NODE_HEIGHT + GAP_Y),
    };

    return {
      id: view.id,
      type: "viewNode",
      position,
      data: {
        view,
        isFocused: view.id === focusedTableId,
        isDimmed,
        columnsWithHandles,
        handleEdgeTypes,
        onClick: () => options?.onViewClick?.(view),
      },
    };
  });

  // Group triggers by table and position them
  const triggersByTable: Record<string, Trigger[]> = {};
  filteredTriggers.forEach((trigger) => {
    if (!triggersByTable[trigger.tableId]) {
      triggersByTable[trigger.tableId] = [];
    }
    triggersByTable[trigger.tableId].push(trigger);
  });

  const triggerNodes: Node[] = [];
  Object.entries(triggersByTable).forEach(([tableId, tableTriggers]) => {
    const tablePos = tablePositions[tableId];
    if (!tablePos) return;

    tableTriggers.forEach((trigger, idx) => {
      const isDimmed =
        focusedTableId !== null &&
        focusedTableId !== undefined &&
        trigger.tableId !== focusedTableId &&
        !focusedNeighbors.has(trigger.tableId);

      triggerNodes.push({
        id: trigger.id,
        type: "triggerNode",
        position: {
          x: tablePos.x + NODE_WIDTH + 60,
          y: tablePos.y + idx * 120,
        },
        data: {
          trigger,
          isDimmed,
          onClick: () => options?.onTriggerClick?.(trigger),
        },
      });
    });
  });

  // Position stored procedures in a separate column on the right
  const maxTableX = Math.max(
    ...Object.values(tablePositions).map((p) => p.x),
    0
  );
  const procedureStartX = maxTableX + NODE_WIDTH + GAP_X + 300;

  const procedureNodes: Node[] = filteredProcedures.map((procedure, index) => ({
    id: procedure.id,
    type: "storedProcedureNode",
    position: {
      x: procedureStartX,
      y: index * 180,
    },
    data: {
      procedure,
      isDimmed: false,
      onClick: () => options?.onProcedureClick?.(procedure),
    },
  }));

  const nodes: Node[] = [
    ...tableNodes,
    ...viewNodes,
    ...triggerNodes,
    ...procedureNodes,
  ];

  // Convert relationships to edges (only for visible tables)
  const fkEdges: Edge[] = schema.relationships
    .filter((rel) => tableIds.has(rel.from) && tableIds.has(rel.to))
    .map((rel) => {
      const isFocusActiveLocal = focusedTableId !== null && focusedTableId !== undefined;
      const isDimmed =
        isFocusActiveLocal &&
        rel.from !== focusedTableId &&
        rel.to !== focusedTableId;
      const isFocused = isFocusActiveLocal && !isDimmed;
      const isSelected = !isFocusActiveLocal && (selectedEdgeIds?.has(rel.id) ?? false);

      return {
        id: rel.id,
        source: rel.from,
        target: rel.to,
        sourceHandle: `${rel.from}-${rel.fromColumn}-source`,
        targetHandle: `${rel.to}-${rel.toColumn}-target`,
        type: "smoothstep",
        style: {
          stroke: isSelected ? "#1d4ed8" : (isDimmed ? "#cbd5e1" : "#3b82f6"),
          strokeWidth: isSelected ? 4 : (isFocused ? 3 : (isDimmed ? 1 : 2)),
          opacity: isDimmed ? 0.4 : 1,
          cursor: isFocusActiveLocal ? "default" : "pointer",
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isSelected ? "#1d4ed8" : (isDimmed ? "#cbd5e1" : "#3b82f6"),
        },
        label: `${rel.fromColumn} → ${rel.toColumn}`,
        labelStyle: {
          fontSize: 10,
          fill: isSelected ? "#1e40af" : (isDimmed ? "#94a3b8" : "#475569"),
        },
        labelBgStyle: {
          fill: "#ffffff",
          fillOpacity: 0.8,
        },
      };
    });

  // Create edges from triggers to their parent tables
  const isFocusActive = focusedTableId !== null && focusedTableId !== undefined;
  const triggerEdges: Edge[] = filteredTriggers
    .filter((tr) => tableIds.has(tr.tableId))
    .map((trigger) => {
      const edgeId = `trigger-edge-${trigger.id}`;
      const isDimmed = isFocusActive && trigger.tableId !== focusedTableId;
      const isFocused = isFocusActive && !isDimmed;
      const isSelected = !isFocusActive && (selectedEdgeIds?.has(edgeId) ?? false);

      return {
        id: edgeId,
        source: trigger.tableId,
        sourceHandle: `${trigger.tableId}-source`,
        target: trigger.id,
        type: "smoothstep",
        style: {
          stroke: isSelected ? "#d97706" : (isDimmed ? "#fcd34d" : "#f59e0b"),
          strokeWidth: isSelected ? 4 : (isFocused ? 3 : (isDimmed ? 1 : 2)),
          opacity: isDimmed ? 0.4 : 1,
          cursor: isFocusActive ? "default" : "pointer",
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isSelected ? "#d97706" : (isDimmed ? "#fcd34d" : "#f59e0b"),
        },
        label: trigger.name,
        labelStyle: {
          fontSize: 10,
          fill: isSelected ? "#92400e" : (isDimmed ? "#fcd34d" : "#b45309"),
        },
        labelBgStyle: {
          fill: "#ffffff",
          fillOpacity: 0.8,
        },
      };
    });

  // Create edges from triggers to their referenced tables/views (other than parent table)
  const triggerRefEdges: Edge[] = filteredTriggers.flatMap((trigger) => {
    return (trigger.referencedTables || [])
      .filter((tableId) =>
        (tableIds.has(tableId) || viewIds.has(tableId)) &&
        tableId !== trigger.tableId  // Exclude parent table, already connected
      )
      .map((tableId) => {
        const edgeId = `trigger-ref-edge-${trigger.id}-${tableId}`;
        const isDimmed = isFocusActive && tableId !== focusedTableId;
        const isFocused = isFocusActive && !isDimmed;
        const isSelected = !isFocusActive && (selectedEdgeIds?.has(edgeId) ?? false);

        return {
          id: edgeId,
          source: trigger.id,
          sourceHandle: `${trigger.id}-source`,
          target: tableId,
          targetHandle: `${tableId}-target`,
          type: "smoothstep",
          style: {
            stroke: isSelected ? "#d97706" : (isDimmed ? "#fcd34d" : "#f59e0b"),
            strokeWidth: isSelected ? 4 : (isFocused ? 3 : (isDimmed ? 1 : 2)),
            opacity: isDimmed ? 0.4 : 1,
            cursor: isFocusActive ? "default" : "pointer",
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isSelected ? "#d97706" : (isDimmed ? "#fcd34d" : "#f59e0b"),
          },
          label: trigger.name,
          labelStyle: {
            fontSize: 10,
            fill: isSelected ? "#92400e" : (isDimmed ? "#fcd34d" : "#b45309"),
          },
          labelBgStyle: {
            fill: "#ffffff",
            fillOpacity: 0.8,
          },
        };
      });
  });

  // Create edges from stored procedures to their referenced tables/views (reads)
  const procedureEdges: Edge[] = filteredProcedures.flatMap((procedure) => {
    return (procedure.referencedTables || [])
      .filter((tableId) => tableIds.has(tableId) || viewIds.has(tableId))
      .map((tableId) => {
        const edgeId = `proc-edge-${procedure.id}-${tableId}`;
        const isDimmed = isFocusActive && tableId !== focusedTableId;
        const isFocused = isFocusActive && !isDimmed;
        const isSelected = !isFocusActive && (selectedEdgeIds?.has(edgeId) ?? false);

        return {
          id: edgeId,
          source: tableId,
          sourceHandle: `${tableId}-source`,
          target: procedure.id,
          targetHandle: `${procedure.id}-target`,
          type: "smoothstep",
          style: {
            stroke: isSelected ? "#7c3aed" : (isDimmed ? "#c4b5fd" : "#8b5cf6"),
            strokeWidth: isSelected ? 4 : (isFocused ? 3 : (isDimmed ? 1 : 2)),
            opacity: isDimmed ? 0.4 : 1,
            cursor: isFocusActive ? "default" : "pointer",
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isSelected ? "#7c3aed" : (isDimmed ? "#c4b5fd" : "#8b5cf6"),
          },
          label: procedure.name,
          labelStyle: {
            fontSize: 10,
            fill: isSelected ? "#5b21b6" : (isDimmed ? "#c4b5fd" : "#7c3aed"),
          },
          labelBgStyle: {
            fill: "#ffffff",
            fillOpacity: 0.8,
          },
        };
      });
  });

  // Create "affects" edges from triggers to tables they write to (INSERT/UPDATE/DELETE)
  const triggerAffectsEdges: Edge[] = filteredTriggers.flatMap((trigger) => {
    return (trigger.affectedTables || [])
      .filter((tableId) =>
        (tableIds.has(tableId) || viewIds.has(tableId)) &&
        tableId !== trigger.tableId  // Exclude parent table
      )
      .map((tableId) => {
        const edgeId = `trigger-affects-${trigger.id}-${tableId}`;
        const isDimmed = isFocusActive && tableId !== focusedTableId;
        const isFocused = isFocusActive && !isDimmed;
        const isSelected = !isFocusActive && (selectedEdgeIds?.has(edgeId) ?? false);

        return {
          id: edgeId,
          source: trigger.id,
          sourceHandle: `${trigger.id}-source`,
          target: tableId,
          targetHandle: `${tableId}-target`,
          type: "smoothstep",
          style: {
            stroke: isSelected ? "#dc2626" : (isDimmed ? "#fca5a5" : "#ef4444"),
            strokeWidth: isSelected ? 4 : (isFocused ? 3 : (isDimmed ? 1 : 2)),
            opacity: isDimmed ? 0.4 : 1,
            cursor: isFocusActive ? "default" : "pointer",
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isSelected ? "#dc2626" : (isDimmed ? "#fca5a5" : "#ef4444"),
          },
          label: `${trigger.name} (writes)`,
          labelStyle: {
            fontSize: 10,
            fill: isSelected ? "#991b1b" : (isDimmed ? "#fca5a5" : "#dc2626"),
          },
          labelBgStyle: {
            fill: "#ffffff",
            fillOpacity: 0.8,
          },
        };
      });
  });

  // Create "affects" edges from stored procedures to tables they write to (INSERT/UPDATE/DELETE)
  const procedureAffectsEdges: Edge[] = filteredProcedures.flatMap((procedure) => {
    return (procedure.affectedTables || [])
      .filter((tableId) => tableIds.has(tableId) || viewIds.has(tableId))
      .map((tableId) => {
        const edgeId = `proc-affects-${procedure.id}-${tableId}`;
        const isDimmed = isFocusActive && tableId !== focusedTableId;
        const isFocused = isFocusActive && !isDimmed;
        const isSelected = !isFocusActive && (selectedEdgeIds?.has(edgeId) ?? false);

        return {
          id: edgeId,
          source: procedure.id,
          sourceHandle: `${procedure.id}-source`,
          target: tableId,
          targetHandle: `${tableId}-target`,
          type: "smoothstep",
          style: {
            stroke: isSelected ? "#dc2626" : (isDimmed ? "#fca5a5" : "#ef4444"),
            strokeWidth: isSelected ? 4 : (isFocused ? 3 : (isDimmed ? 1 : 2)),
            opacity: isDimmed ? 0.4 : 1,
            cursor: isFocusActive ? "default" : "pointer",
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isSelected ? "#dc2626" : (isDimmed ? "#fca5a5" : "#ef4444"),
          },
          label: `${procedure.name} (writes)`,
          labelStyle: {
            fontSize: 10,
            fill: isSelected ? "#991b1b" : (isDimmed ? "#fca5a5" : "#dc2626"),
          },
          labelBgStyle: {
            fill: "#ffffff",
            fillOpacity: 0.8,
          },
        };
      });
  });

  // Create edges from view columns to their source table columns
  const allNodeIds = new Set([...tableIds, ...viewIds]);
  const viewEdges: Edge[] = filteredViews.flatMap((view) => {
    return view.columns
      .filter((col) => col.sourceTable && col.sourceColumn)
      .map((col) => {
        // Find the source table ID by matching table name
        const sourceTableId = [...allNodeIds].find(
          (id) => id.endsWith(`.${col.sourceTable}`) || id === col.sourceTable
        );
        return { col, sourceTableId };
      })
      .filter(({ sourceTableId }) => sourceTableId !== undefined)
      .map(({ col, sourceTableId }) => {
        const edgeId = `view-col-edge-${view.id}-${col.name}`;
        const isDimmed =
          isFocusActive &&
          view.id !== focusedTableId &&
          sourceTableId !== focusedTableId;
        const isFocused = isFocusActive && !isDimmed;
        const isSelected = !isFocusActive && (selectedEdgeIds?.has(edgeId) ?? false);

        return {
          id: edgeId,
          source: sourceTableId!,
          sourceHandle: `${sourceTableId}-${col.sourceColumn}-source`,
          target: view.id,
          targetHandle: `${view.id}-${col.name}-target`,
          type: "smoothstep",
          style: {
            stroke: isSelected ? "#059669" : (isDimmed ? "#6ee7b7" : "#10b981"),
            strokeWidth: isSelected ? 4 : (isFocused ? 3 : (isDimmed ? 1 : 2)),
            opacity: isDimmed ? 0.4 : 1,
            cursor: isFocusActive ? "default" : "pointer",
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isSelected ? "#059669" : (isDimmed ? "#6ee7b7" : "#10b981"),
          },
          label: view.name,
          labelStyle: {
            fontSize: 10,
            fill: isSelected ? "#065f46" : (isDimmed ? "#6ee7b7" : "#047857"),
          },
          labelBgStyle: {
            fill: "#ffffff",
            fillOpacity: 0.8,
          },
        };
      });
  });

  // Apply edge type filter
  const edges: Edge[] = [
    ...(!edgeTypeFilter || edgeTypeFilter.has("foreignKeys") ? fkEdges : []),
    ...(!edgeTypeFilter || edgeTypeFilter.has("triggerDependencies") ? [...triggerEdges, ...triggerRefEdges] : []),
    ...(!edgeTypeFilter || edgeTypeFilter.has("triggerWrites") ? triggerAffectsEdges : []),
    ...(!edgeTypeFilter || edgeTypeFilter.has("procedureReads") ? procedureEdges : []),
    ...(!edgeTypeFilter || edgeTypeFilter.has("procedureWrites") ? procedureAffectsEdges : []),
    ...(!edgeTypeFilter || edgeTypeFilter.has("viewDependencies") ? viewEdges : []),
  ];

  return { nodes, edges, handleEdgeTypes };
}

export function SchemaGraphView({
  schema,
  focusedTableId,
  searchFilter,
  schemaFilter,
  objectTypeFilter,
  edgeTypeFilter,
}: SchemaGraphProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<DetailModalData | null>(null);
  const { selectedEdgeIds, toggleEdgeSelection } = useSchemaStore();

  const onEdgeClick: EdgeMouseHandler = useCallback(
    (_event, edge) => {
      // Don't allow selection when focus is active - focused edges are already highlighted
      if (focusedTableId) return;
      toggleEdgeSelection(edge.id);
    },
    [toggleEdgeSelection, focusedTableId]
  );

  const handleTableClick = (table: TableNodeType) => {
    setModalData({ type: "table", data: table });
    setModalOpen(true);
  };

  const handleViewClick = (view: ViewNodeType) => {
    setModalData({ type: "view", data: view });
    setModalOpen(true);
  };

  const handleTriggerClick = (trigger: Trigger) => {
    setModalData({ type: "trigger", data: trigger });
    setModalOpen(true);
  };

  const handleProcedureClick = (procedure: StoredProcedure) => {
    setModalData({ type: "storedProcedure", data: procedure });
    setModalOpen(true);
  };

  const options: ConvertOptions = {
    onTableClick: handleTableClick,
    onViewClick: handleViewClick,
    onTriggerClick: handleTriggerClick,
    onProcedureClick: handleProcedureClick,
  };

  // Memoize columns that need handles (only depends on schema relationships)
  const columnsWithHandles = useMemo(
    () => computeColumnsWithHandles(schema),
    [schema]
  );

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () =>
      convertToFlowElements(
        schema,
        focusedTableId,
        searchFilter,
        schemaFilter,
        objectTypeFilter,
        edgeTypeFilter,
        selectedEdgeIds,
        options,
        columnsWithHandles
      ),
    [schema, focusedTableId, searchFilter, schemaFilter, objectTypeFilter, edgeTypeFilter, selectedEdgeIds, columnsWithHandles]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes/edges when dependencies change, preserving node positions
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = convertToFlowElements(
      schema,
      focusedTableId,
      searchFilter,
      schemaFilter,
      objectTypeFilter,
      edgeTypeFilter,
      selectedEdgeIds,
      options,
      columnsWithHandles
    );

    // Preserve existing node positions - only update data, not positions
    setNodes((currentNodes) => {
      const currentPositions = new Map(currentNodes.map(n => [n.id, n.position]));
      return newNodes.map(node => ({
        ...node,
        position: currentPositions.get(node.id) ?? node.position,
      }));
    });
    setEdges(newEdges);
  }, [schema, focusedTableId, searchFilter, schemaFilter, objectTypeFilter, edgeTypeFilter, selectedEdgeIds, columnsWithHandles, setNodes, setEdges]);

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onEdgeClick={onEdgeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        proOptions={{ hideAttribution: true }}
        onlyRenderVisibleElements={true}
        nodesConnectable={false}
      >
        <Background className="!bg-background [&>pattern>circle]:!fill-border" gap={20} />
        <Controls className="!bg-background !border-border !shadow-sm [&>button]:!bg-background [&>button]:!border-border [&>button]:!text-foreground [&>button:hover]:!bg-muted" />
        <MiniMap
          nodeColor={getMinimapNodeColor}
          maskColor="rgba(0, 0, 0, 0.1)"
          className="!bg-background !border-border"
        />
      </ReactFlow>
      <DetailModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        modalData={modalData}
      />
    </div>
  );
}
