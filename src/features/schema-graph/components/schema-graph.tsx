import { useMemo, useState, useEffect, useCallback, useRef, useDeferredValue } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useReactFlow,
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
  ScalarFunction,
} from "../types";
import { ObjectType, EdgeType, useSchemaStore } from "../store";
import { getSchemaIndex } from "@/lib/schema-index";
import { useShallow } from "zustand/shallow";
import { TableNode } from "./table-node";
import { ViewNode } from "./view-node";
import { TriggerNode } from "./trigger-node";
import { StoredProcedureNode } from "./stored-procedure-node";
import { ScalarFunctionNode } from "./scalar-function-node";
import { SchemaBrowserSidebar } from "./schema-browser-sidebar";
import { DetailPopover } from "./detail-popover";
import { SidebarToggle } from "./sidebar-toggle";
import { useDetailPopover } from "../hooks/use-detail-popover";
import type { DetailSidebarData } from "./detail-content";
import { cn } from "@/lib/utils";

const GRID_COLS = 3;
const NODE_WIDTH = 300;
const NODE_HEIGHT = 250;
const GAP_X = 120;
const GAP_Y = 100;
const TRIGGER_OFFSET_X = NODE_WIDTH + 60;
const TRIGGER_GAP_Y = 120;
const PROCEDURE_GAP_Y = 180;
const PROCEDURE_OFFSET_X = NODE_WIDTH + GAP_X + 300;
const FUNCTION_OFFSET_X = 320;
const COMPACT_ZOOM = 0.6;
const FOCUS_COMPACT_ZOOM = 0.4;
const FORCE_COMPACT_ZOOM = 0.3;
const EDGE_LABEL_ZOOM = 0.8;
const EMPTY_SET: ReadonlySet<string> = new Set<string>();

/**
 * Calculate actual node height based on column count.
 * Expanded mode: 52 + (columnCount * 28) pixels
 * Default for triggers/procedures/functions: 150px
 */
function getNodeHeight(nodeId: string, schema: SchemaGraphType): number {
  const table = schema.tables.find((t) => t.id === nodeId);
  if (table) {
    return 52 + table.columns.length * 28;
  }
  const view = (schema.views || []).find((v) => v.id === nodeId);
  if (view) {
    return 52 + view.columns.length * 28;
  }
  return 150; // Default for triggers/procedures/functions
}

const EDGE_STYLE: Record<
  EdgeType,
  {
    base: string;
    dimmed: string;
    selected: string;
    label: string;
    labelDimmed: string;
    labelSelected: string;
  }
> = {
  foreignKeys: {
    base: "#3b82f6",
    dimmed: "#cbd5e1",
    selected: "#1d4ed8",
    label: "#475569",
    labelDimmed: "#94a3b8",
    labelSelected: "#1e40af",
  },
  triggerDependencies: {
    base: "#f59e0b",
    dimmed: "#fcd34d",
    selected: "#d97706",
    label: "#b45309",
    labelDimmed: "#fcd34d",
    labelSelected: "#92400e",
  },
  triggerWrites: {
    base: "#ef4444",
    dimmed: "#fca5a5",
    selected: "#dc2626",
    label: "#dc2626",
    labelDimmed: "#fca5a5",
    labelSelected: "#991b1b",
  },
  procedureReads: {
    base: "#8b5cf6",
    dimmed: "#c4b5fd",
    selected: "#7c3aed",
    label: "#7c3aed",
    labelDimmed: "#c4b5fd",
    labelSelected: "#5b21b6",
  },
  procedureWrites: {
    base: "#ef4444",
    dimmed: "#fca5a5",
    selected: "#dc2626",
    label: "#dc2626",
    labelDimmed: "#fca5a5",
    labelSelected: "#991b1b",
  },
  viewDependencies: {
    base: "#10b981",
    dimmed: "#6ee7b7",
    selected: "#059669",
    label: "#047857",
    labelDimmed: "#6ee7b7",
    labelSelected: "#065f46",
  },
  functionReads: {
    base: "#06b6d4",
    dimmed: "#67e8f9",
    selected: "#0891b2",
    label: "#0891b2",
    labelDimmed: "#67e8f9",
    labelSelected: "#155e75",
  },
};

// Define custom node types outside component to prevent re-renders
const nodeTypes = {
  tableNode: TableNode,
  viewNode: ViewNode,
  triggerNode: TriggerNode,
  storedProcedureNode: StoredProcedureNode,
  scalarFunctionNode: ScalarFunctionNode,
};

// MiniMap node color function - defined outside component for stable reference
function getMinimapNodeColor(node: Node): string {
  if (node.data?.isFocused) return "#3b82f6";
  if (node.data?.isDimmed) return "var(--color-muted)";
  if (node.type === "viewNode") return "#10b981";
  if (node.type === "triggerNode") return "#f59e0b";
  if (node.type === "storedProcedureNode") return "#8b5cf6";
  if (node.type === "scalarFunctionNode") return "#06b6d4";
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

/**
 * Position a tier of nodes with row wrapping.
 * Centers each row horizontally and stacks rows vertically.
 * Uses dynamic height calculation based on column count.
 * Returns the final Y position after positioning all rows.
 */
function positionTier(
  nodeIds: string[],
  baseY: number,
  positions: Map<string, { x: number; y: number }>,
  direction: "up" | "down",
  schema: SchemaGraphType
): number {
  if (nodeIds.length === 0) return baseY;

  const MAX_PER_ROW = 4;
  const NODE_GAP_X = NODE_WIDTH + 80; // 380px horizontal spacing
  const VERTICAL_GAP = 60;

  // Group nodes into rows
  const rows: string[][] = [];
  for (let i = 0; i < nodeIds.length; i += MAX_PER_ROW) {
    rows.push(nodeIds.slice(i, i + MAX_PER_ROW));
  }

  let cumulativeY = baseY;

  rows.forEach((rowNodes) => {
    // Calculate max height in this row for proper spacing
    const maxHeight = Math.max(...rowNodes.map((id) => getNodeHeight(id, schema)));

    // For "up" direction, first move up by maxHeight before positioning
    if (direction === "up") {
      cumulativeY -= maxHeight;
    }

    // Position nodes in this row (centered horizontally)
    const rowWidth = rowNodes.length * NODE_GAP_X;
    const startX = -rowWidth / 2 + NODE_GAP_X / 2;

    rowNodes.forEach((id, col) => {
      positions.set(id, {
        x: startX + col * NODE_GAP_X,
        y: cumulativeY,
      });
    });

    // Move to next row position
    if (direction === "up") {
      cumulativeY -= VERTICAL_GAP; // Additional gap for next row above
    } else {
      cumulativeY += maxHeight + VERTICAL_GAP; // Move below current row
    }
  });

  return cumulativeY;
}

/**
 * Calculate compact layout positions when focus mode is "hide".
 * Uses directional flow layout with upstream tables above and downstream below.
 * Calculates dynamic heights based on column count to prevent overlap.
 */
function calculateCompactLayout(
  focusedNodeId: string,
  visibleNodeIds: ReadonlySet<string>,
  neighbors: ReadonlySet<string>,
  schema: SchemaGraphType
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();

  // Focused node at center
  positions.set(focusedNodeId, { x: 0, y: 0 });
  const focusedHeight = getNodeHeight(focusedNodeId, schema);

  // Categorize neighbors by FK direction
  const upstream: string[] = [];   // Tables that reference focused (FK points to focused)
  const downstream: string[] = []; // Tables that focused references (FK points away)
  const visibleNeighbors = [...neighbors].filter((id) => visibleNodeIds.has(id));

  for (const neighborId of visibleNeighbors) {
    // Check if this is a table/view (not trigger/procedure)
    const isTableOrView = schema.tables.some(t => t.id === neighborId) ||
                          (schema.views || []).some(v => v.id === neighborId);

    if (!isTableOrView) continue;

    // Check FK direction
    // referencedByFocused: focused table has FK pointing to this neighbor
    const referencedByFocused = schema.relationships.some(
      rel => rel.from === focusedNodeId && rel.to === neighborId
    );
    // referencesFocused: this neighbor has FK pointing to focused table
    const referencesFocused = schema.relationships.some(
      rel => rel.from === neighborId && rel.to === focusedNodeId
    );

    if (referencesFocused && !referencedByFocused) {
      upstream.push(neighborId);
    } else if (referencedByFocused && !referencesFocused) {
      downstream.push(neighborId);
    } else {
      // Bidirectional or view dependency - put in upstream
      upstream.push(neighborId);
    }
  }

  // Gap between focused node and tiers
  const TIER_GAP = 60;

  // Position upstream tables (above focused) - position so bottom of first row ends at y = -TIER_GAP
  // Focused node at (0, 0) occupies y from 0 to focusedHeight (top-left positioning)
  const upstreamBaseY = -TIER_GAP;
  positionTier(upstream, upstreamBaseY, positions, "up", schema);

  // Position downstream tables (below focused) - first row at y = focusedHeight + TIER_GAP
  const downstreamBaseY = focusedHeight + TIER_GAP;
  const bottomY = positionTier(downstream, downstreamBaseY, positions, "down", schema);

  // Position triggers near their parent tables
  (schema.triggers || []).forEach((trigger) => {
    if (!visibleNodeIds.has(trigger.id)) return;
    const parentPos = positions.get(trigger.tableId);
    if (parentPos) {
      // Count triggers for this table to stack them
      const existingTriggers = [...positions.keys()].filter((id) =>
        (schema.triggers || []).some((t) => t.id === id && t.tableId === trigger.tableId)
      );
      positions.set(trigger.id, {
        x: parentPos.x + TRIGGER_OFFSET_X,
        y: parentPos.y + existingTriggers.length * TRIGGER_GAP_Y,
      });
    }
  });

  // Calculate bottom Y position for procedures/functions
  // Use bottomY from positionTier if downstream has nodes, otherwise calculate from positions
  const allYPositions = [...positions.values()].map(p => p.y);
  const maxY = Math.max(...allYPositions, 0);
  const procedureY = downstream.length > 0 ? bottomY : maxY + NODE_HEIGHT + GAP_Y;

  // Position procedures below the main cluster
  let procIndex = 0;
  (schema.storedProcedures || []).forEach((proc) => {
    if (!visibleNodeIds.has(proc.id)) return;
    positions.set(proc.id, {
      x: -200 + procIndex * 320,
      y: procedureY,
    });
    procIndex++;
  });

  // Position functions next to procedures
  let funcIndex = 0;
  (schema.scalarFunctions || []).forEach((fn) => {
    if (!visibleNodeIds.has(fn.id)) return;
    positions.set(fn.id, {
      x: -200 + (procIndex + funcIndex) * 320,
      y: procedureY,
    });
    funcIndex++;
  });

  return positions;
}

// Callback types for node clicks
interface ConvertOptions {
  onTableClick?: (table: TableNodeType, event: React.MouseEvent) => void;
  onViewClick?: (view: ViewNodeType, event: React.MouseEvent) => void;
  onTriggerClick?: (trigger: Trigger, event: React.MouseEvent) => void;
  onProcedureClick?: (procedure: StoredProcedure, event: React.MouseEvent) => void;
  onFunctionClick?: (fn: ScalarFunction, event: React.MouseEvent) => void;
}

interface EdgeMeta {
  id: string;
  type: EdgeType;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
}

function buildBaseNodes(
  schema: SchemaGraphType,
  options: ConvertOptions,
  columnsWithHandles: Set<string>
): Node[] {
  const tablePositions: Record<string, { x: number; y: number }> = {};

  const tableNodes: Node[] = schema.tables.map((table, index) => {
    const col = index % GRID_COLS;
    const row = Math.floor(index / GRID_COLS);
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
        isFocused: false,
        isDimmed: false,
        isCompact: false,
        columnsWithHandles,
        handleEdgeTypes: undefined,
        onClick: (e: React.MouseEvent) => options?.onTableClick?.(table, e),
      },
    };
  });

  const tableRowCount = Math.ceil(schema.tables.length / GRID_COLS);
  const viewStartY = tableRowCount * (NODE_HEIGHT + GAP_Y);

  const viewNodes: Node[] = (schema.views || []).map((view, index) => {
    const col = index % GRID_COLS;
    const row = Math.floor(index / GRID_COLS);

    return {
      id: view.id,
      type: "viewNode",
      position: {
        x: col * (NODE_WIDTH + GAP_X),
        y: viewStartY + row * (NODE_HEIGHT + GAP_Y),
      },
      data: {
        view,
        isFocused: false,
        isDimmed: false,
        isCompact: false,
        columnsWithHandles,
        handleEdgeTypes: undefined,
        onClick: (e: React.MouseEvent) => options?.onViewClick?.(view, e),
      },
    };
  });

  const triggersByTable: Record<string, Trigger[]> = {};
  (schema.triggers || []).forEach((trigger) => {
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
      triggerNodes.push({
        id: trigger.id,
        type: "triggerNode",
        position: {
          x: tablePos.x + TRIGGER_OFFSET_X,
          y: tablePos.y + idx * TRIGGER_GAP_Y,
        },
        data: {
          trigger,
          isDimmed: false,
          onClick: (e: React.MouseEvent) => options?.onTriggerClick?.(trigger, e),
        },
      });
    });
  });

  const maxTableX = Math.max(
    ...Object.values(tablePositions).map((p) => p.x),
    0
  );
  const procedureStartX = maxTableX + PROCEDURE_OFFSET_X;

  const procedureNodes: Node[] = (schema.storedProcedures || []).map(
    (procedure, index) => ({
      id: procedure.id,
      type: "storedProcedureNode",
      position: {
        x: procedureStartX,
        y: index * PROCEDURE_GAP_Y,
      },
      data: {
        procedure,
        isDimmed: false,
        onClick: (e: React.MouseEvent) => options?.onProcedureClick?.(procedure, e),
      },
    })
  );

  const functionStartX = procedureStartX + FUNCTION_OFFSET_X;

  const functionNodes: Node[] = (schema.scalarFunctions || []).map(
    (fn, index) => ({
      id: fn.id,
      type: "scalarFunctionNode",
      position: {
        x: functionStartX,
        y: index * PROCEDURE_GAP_Y,
      },
      data: {
        function: fn,
        isDimmed: false,
        onClick: (e: React.MouseEvent) => options?.onFunctionClick?.(fn, e),
      },
    })
  );

  return [
    ...tableNodes,
    ...viewNodes,
    ...triggerNodes,
    ...procedureNodes,
    ...functionNodes,
  ];
}

function buildBaseEdges(
  schema: SchemaGraphType,
  viewColumnSources: Map<string, { columnName: string; sourceTableId: string; sourceColumn: string }[]>
): EdgeMeta[] {
  const edges: EdgeMeta[] = [];

  schema.relationships.forEach((rel) => {
    edges.push({
      id: rel.id,
      type: "foreignKeys",
      source: rel.from,
      target: rel.to,
      sourceHandle: `${rel.from}-${rel.fromColumn}-source`,
      targetHandle: `${rel.to}-${rel.toColumn}-target`,
      label: `${rel.fromColumn} → ${rel.toColumn}`,
    });
  });

  (schema.triggers || []).forEach((trigger) => {
    edges.push({
      id: `trigger-edge-${trigger.id}`,
      type: "triggerDependencies",
      source: trigger.tableId,
      target: trigger.id,
      sourceHandle: `${trigger.tableId}-source`,
      label: trigger.name,
    });

    (trigger.referencedTables || []).forEach((tableId) => {
      if (tableId === trigger.tableId) return;
      edges.push({
        id: `trigger-ref-edge-${trigger.id}-${tableId}`,
        type: "triggerDependencies",
        source: trigger.id,
        target: tableId,
        sourceHandle: `${trigger.id}-source`,
        targetHandle: `${tableId}-target`,
        label: trigger.name,
      });
    });

    (trigger.affectedTables || []).forEach((tableId) => {
      if (tableId === trigger.tableId) return;
      edges.push({
        id: `trigger-affects-${trigger.id}-${tableId}`,
        type: "triggerWrites",
        source: trigger.id,
        target: tableId,
        sourceHandle: `${trigger.id}-source`,
        targetHandle: `${tableId}-target`,
        label: `${trigger.name} (writes)`,
      });
    });
  });

  (schema.storedProcedures || []).forEach((procedure) => {
    (procedure.referencedTables || []).forEach((tableId) => {
      edges.push({
        id: `proc-edge-${procedure.id}-${tableId}`,
        type: "procedureReads",
        source: tableId,
        target: procedure.id,
        sourceHandle: `${tableId}-source`,
        targetHandle: `${procedure.id}-target`,
        label: procedure.name,
      });
    });

    (procedure.affectedTables || []).forEach((tableId) => {
      edges.push({
        id: `proc-affects-${procedure.id}-${tableId}`,
        type: "procedureWrites",
        source: procedure.id,
        target: tableId,
        sourceHandle: `${procedure.id}-source`,
        targetHandle: `${tableId}-target`,
        label: `${procedure.name} (writes)`,
      });
    });
  });

  (schema.scalarFunctions || []).forEach((fn) => {
    (fn.referencedTables || []).forEach((tableId) => {
      edges.push({
        id: `func-edge-${fn.id}-${tableId}`,
        type: "functionReads",
        source: tableId,
        target: fn.id,
        sourceHandle: `${tableId}-source`,
        targetHandle: `${fn.id}-target`,
        label: fn.name,
      });
    });
  });

  (schema.views || []).forEach((view) => {
    const sources = viewColumnSources.get(view.id) ?? [];
    sources.forEach((source) => {
      edges.push({
        id: `view-col-edge-${view.id}-${source.columnName}`,
        type: "viewDependencies",
        source: source.sourceTableId,
        target: view.id,
        sourceHandle: `${source.sourceTableId}-${source.sourceColumn}-source`,
        targetHandle: `${view.id}-${source.columnName}-target`,
        label: view.name,
      });
    });
  });

  return edges;
}

function buildEdgeState(
  edges: EdgeMeta[],
  edgeTypeFilter: Set<EdgeType> | undefined,
  visibleNodeIds: Set<string>,
  focusedTableId: string | null | undefined,
  selectedEdgeIds: Set<string>,
  hoveredEdgeId: string | null,
  showLabels: boolean
): { edges: Edge[]; handleEdgeTypes: Map<string, Set<EdgeType>> } {
  const handleEdgeTypes = new Map<string, Set<EdgeType>>();
  const addHandle = (handleId: string | undefined, type: EdgeType) => {
    if (!handleId) return;
    if (!handleEdgeTypes.has(handleId)) {
      handleEdgeTypes.set(handleId, new Set());
    }
    handleEdgeTypes.get(handleId)!.add(type);
  };

  const isFocusActive = Boolean(focusedTableId);

  const nextEdges = edges.map((edge) => {
    const nodesVisible =
      visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target);
    const typeVisible = !edgeTypeFilter || edgeTypeFilter.has(edge.type);
    const isVisible = nodesVisible && typeVisible;

    if (isVisible) {
      addHandle(edge.sourceHandle, edge.type);
      addHandle(edge.targetHandle, edge.type);
    }

    const isDimmed =
      isFocusActive &&
      edge.source !== focusedTableId &&
      edge.target !== focusedTableId;
    const isFocused = isFocusActive && !isDimmed;
    const isSelected = !isFocusActive && selectedEdgeIds.has(edge.id);

    const colors = EDGE_STYLE[edge.type];
    const stroke = isSelected
      ? colors.selected
      : isDimmed
      ? colors.dimmed
      : colors.base;
    const strokeWidth = isSelected ? 4 : isFocused ? 3 : isDimmed ? 1 : 2;
    const labelColor = isSelected
      ? colors.labelSelected
      : isDimmed
      ? colors.labelDimmed
      : colors.label;
    const isHovered = hoveredEdgeId === edge.id;
    const shouldShowLabel = (showLabels || isSelected || isHovered) && !isDimmed;
    const label = shouldShowLabel ? edge.label : undefined;

    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      type: "smoothstep",
      hidden: !isVisible,
      style: {
        stroke,
        strokeWidth,
        opacity: isDimmed ? 0.4 : 1,
        cursor: isFocusActive ? "default" : "pointer",
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: stroke,
      },
      label,
      labelStyle: label
        ? {
            fontSize: 10,
            fill: labelColor,
          }
        : undefined,
      labelBgStyle: label
        ? {
            fill: "#ffffff",
            fillOpacity: 0.8,
          }
        : undefined,
    };
  });

  return { edges: nextEdges, handleEdgeTypes };
}

function SchemaGraphInner({
  schema,
  focusedTableId,
  searchFilter,
  schemaFilter,
  objectTypeFilter,
  edgeTypeFilter,
}: SchemaGraphProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const { open: popoverOpen, data: popoverData, anchorRect, openPopover, closePopover } = useDetailPopover();
  const { selectedEdgeIds, toggleEdgeSelection, clearEdgeSelection, focusMode, focusExpandThreshold } =
    useSchemaStore(
      useShallow((state) => ({
        selectedEdgeIds: state.selectedEdgeIds,
        toggleEdgeSelection: state.toggleEdgeSelection,
        clearEdgeSelection: state.clearEdgeSelection,
        focusMode: state.focusMode,
        focusExpandThreshold: state.focusExpandThreshold,
      }))
    );

  // React Flow hook for programmatic viewport control
  const { fitView } = useReactFlow();

  // Store original positions for restoration when focus is cleared
  const originalPositionsRef = useRef<Map<string, { x: number; y: number }>>(
    new Map()
  );
  // Track previous focus state to detect transitions (for one-time fitView)
  const prevFocusStateRef = useRef<{ focusedTableId: string | null; focusMode: string }>({
    focusedTableId: null,
    focusMode: "fade",
  });
  const processedNodeCacheRef = useRef<Map<string, Node>>(new Map());

  const [zoom, setZoom] = useState(0.8);
  const deferredZoom = useDeferredValue(zoom);
  const showEdgeLabels = deferredZoom >= EDGE_LABEL_ZOOM;

  const onEdgeClick: EdgeMouseHandler = useCallback(
    (_event, edge) => {
      if (focusedTableId) return;
      toggleEdgeSelection(edge.id);
    },
    [toggleEdgeSelection, focusedTableId]
  );

  const onPaneClick = useCallback(() => {
    if (selectedEdgeIds.size > 0) {
      clearEdgeSelection();
    }
  }, [selectedEdgeIds.size, clearEdgeSelection]);

  const onEdgeMouseEnter = useCallback(
    (_event: unknown, edge: Edge) => {
      setHoveredEdgeId(edge.id);
    },
    []
  );

  const onEdgeMouseLeave = useCallback(() => {
    setHoveredEdgeId(null);
  }, []);

  const onMove = useCallback((_event: unknown, viewport: { zoom: number }) => {
    setZoom((prev) =>
      Math.abs(prev - viewport.zoom) > 0.01 ? viewport.zoom : prev
    );
  }, []);

  const handleNodeClick = useCallback((data: DetailSidebarData, event: React.MouseEvent) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    openPopover(data, rect);
  }, [openPopover]);

  const handleTableClick = useCallback((table: TableNodeType, event: React.MouseEvent) => {
    handleNodeClick({ type: "table", data: table }, event);
  }, [handleNodeClick]);

  const handleViewClick = useCallback((view: ViewNodeType, event: React.MouseEvent) => {
    handleNodeClick({ type: "view", data: view }, event);
  }, [handleNodeClick]);

  const handleTriggerClick = useCallback((trigger: Trigger, event: React.MouseEvent) => {
    handleNodeClick({ type: "trigger", data: trigger }, event);
  }, [handleNodeClick]);

  const handleProcedureClick = useCallback((procedure: StoredProcedure, event: React.MouseEvent) => {
    handleNodeClick({ type: "storedProcedure", data: procedure }, event);
  }, [handleNodeClick]);

  const handleFunctionClick = useCallback((fn: ScalarFunction, event: React.MouseEvent) => {
    handleNodeClick({ type: "scalarFunction", data: fn }, event);
  }, [handleNodeClick]);

  const handleSidebarItemClick = useCallback((data: DetailSidebarData, rect: DOMRect) => {
    openPopover(data, rect);
  }, [openPopover]);

  const options: ConvertOptions = useMemo(
    () => ({
      onTableClick: (table: TableNodeType, event: React.MouseEvent) => handleTableClick(table, event),
      onViewClick: (view: ViewNodeType, event: React.MouseEvent) => handleViewClick(view, event),
      onTriggerClick: (trigger: Trigger, event: React.MouseEvent) => handleTriggerClick(trigger, event),
      onProcedureClick: (procedure: StoredProcedure, event: React.MouseEvent) => handleProcedureClick(procedure, event),
      onFunctionClick: (fn: ScalarFunction, event: React.MouseEvent) => handleFunctionClick(fn, event),
    }),
    [
      handleTableClick,
      handleViewClick,
      handleTriggerClick,
      handleProcedureClick,
      handleFunctionClick,
    ]
  );

  const schemaIndex = useMemo(() => getSchemaIndex(schema), [schema]);
  const baseNodes = useMemo(
    () =>
      buildBaseNodes(schema, options, schemaIndex.columnsWithHandles),
    [schema, options, schemaIndex.columnsWithHandles]
  );
  const baseEdges = useMemo(
    () => buildBaseEdges(schema, schemaIndex.viewColumnSources),
    [schema, schemaIndex.viewColumnSources]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(baseNodes);

  useEffect(() => {
    setNodes(baseNodes);
  }, [baseNodes, setNodes]);

  useEffect(() => {
    if (baseNodes.length === 0) {
      return;
    }

    const frameId = requestAnimationFrame(() => {
      fitView({ padding: 0.2, duration: 300 });
    });

    return () => cancelAnimationFrame(frameId);
  }, [baseNodes, fitView]);

  // Store original positions when baseNodes change
  useEffect(() => {
    const positions = new Map<string, { x: number; y: number }>();
    baseNodes.forEach((node) => positions.set(node.id, { ...node.position }));
    originalPositionsRef.current = positions;
  }, [baseNodes]);

  const lowerSearch = useMemo(
    () => searchFilter?.trim().toLowerCase() ?? "",
    [searchFilter]
  );

  const {
    visibleNodeIds,
    visibleTableIds,
    visibleViewIds,
    visibleTriggerIds,
    visibleProcedureIds,
    visibleFunctionIds,
  } = useMemo(() => {
    const hasSearch = lowerSearch.length > 0;
    const matchesSearch = (map: Map<string, string>, id: string) => {
      if (!hasSearch) return true;
      const text = map.get(id);
      return text ? text.includes(lowerSearch) : false;
    };

    const showTables = !objectTypeFilter || objectTypeFilter.has("tables");
    const showViews = !objectTypeFilter || objectTypeFilter.has("views");
    const showTriggers = !objectTypeFilter || objectTypeFilter.has("triggers");
    const showProcedures =
      !objectTypeFilter || objectTypeFilter.has("storedProcedures");
    const showFunctions =
      !objectTypeFilter || objectTypeFilter.has("scalarFunctions");

    let filteredTables = showTables ? schema.tables : [];
    if (hasSearch) {
      filteredTables = filteredTables.filter((t) =>
        matchesSearch(schemaIndex.tableSearch, t.id)
      );
    }
    if (schemaFilter && schemaFilter !== "all") {
      filteredTables = filteredTables.filter((t) => t.schema === schemaFilter);
    }

    let filteredViews = showViews ? (schema.views || []) : [];
    if (hasSearch) {
      filteredViews = filteredViews.filter((v) =>
        matchesSearch(schemaIndex.viewSearch, v.id)
      );
    }
    if (schemaFilter && schemaFilter !== "all") {
      filteredViews = filteredViews.filter((v) => v.schema === schemaFilter);
    }

    const visibleTableIds = new Set(filteredTables.map((t) => t.id));
    const visibleViewIds = new Set(filteredViews.map((v) => v.id));

    let filteredTriggers = showTriggers
      ? (schema.triggers || []).filter((tr) => visibleTableIds.has(tr.tableId))
      : [];
    if (hasSearch) {
      filteredTriggers = filteredTriggers.filter((tr) =>
        matchesSearch(schemaIndex.triggerSearch, tr.id)
      );
    }

    let filteredProcedures = showProcedures
      ? (schema.storedProcedures || [])
      : [];
    let filteredFunctions = showFunctions ? (schema.scalarFunctions || []) : [];

    if (schemaFilter && schemaFilter !== "all") {
      filteredProcedures = filteredProcedures.filter(
        (p) => p.schema === schemaFilter
      );
      filteredFunctions = filteredFunctions.filter(
        (f) => f.schema === schemaFilter
      );
    }
    if (hasSearch) {
      filteredProcedures = filteredProcedures.filter((p) =>
        matchesSearch(schemaIndex.procedureSearch, p.id)
      );
      filteredFunctions = filteredFunctions.filter((f) =>
        matchesSearch(schemaIndex.functionSearch, f.id)
      );
    }

    const visibleTriggerIds = new Set(filteredTriggers.map((t) => t.id));
    const visibleProcedureIds = new Set(filteredProcedures.map((p) => p.id));
    const visibleFunctionIds = new Set(filteredFunctions.map((f) => f.id));

    const visibleNodeIds = new Set<string>([
      ...visibleTableIds,
      ...visibleViewIds,
      ...visibleTriggerIds,
      ...visibleProcedureIds,
      ...visibleFunctionIds,
    ]);

    return {
      visibleNodeIds,
      visibleTableIds,
      visibleViewIds,
      visibleTriggerIds,
      visibleProcedureIds,
      visibleFunctionIds,
    };
  }, [schema, schemaFilter, objectTypeFilter, lowerSearch, schemaIndex]);

  const focusedNeighbors = useMemo(() => {
    if (!focusedTableId) return EMPTY_SET;
    return schemaIndex.neighbors.get(focusedTableId) ?? EMPTY_SET;
  }, [focusedTableId, schemaIndex.neighbors]);

  const dimmedNodeIds = useMemo(() => {
    const dimmed = new Set<string>();
    if (!focusedTableId) return dimmed;

    const triggersById = new Map(
      (schema.triggers || []).map((trigger) => [trigger.id, trigger])
    );
    const proceduresById = new Map(
      (schema.storedProcedures || []).map((procedure) => [procedure.id, procedure])
    );
    const functionsById = new Map(
      (schema.scalarFunctions || []).map((fn) => [fn.id, fn])
    );

    visibleNodeIds.forEach((nodeId) => {
      if (visibleTableIds.has(nodeId) || visibleViewIds.has(nodeId)) {
        if (nodeId !== focusedTableId && !focusedNeighbors.has(nodeId)) {
          dimmed.add(nodeId);
        }
        return;
      }

      if (visibleTriggerIds.has(nodeId)) {
        const trigger = triggersById.get(nodeId);
        if (
          trigger &&
          trigger.tableId !== focusedTableId &&
          !focusedNeighbors.has(trigger.tableId)
        ) {
          dimmed.add(nodeId);
        }
        return;
      }

      if (visibleProcedureIds.has(nodeId)) {
        const procedure = proceduresById.get(nodeId);
        if (procedure) {
          const refs = [
            ...(procedure.referencedTables || []),
            ...(procedure.affectedTables || []),
          ];
          if (
            !refs.some(
              (tableId) =>
                tableId === focusedTableId || focusedNeighbors.has(tableId)
            )
          ) {
            dimmed.add(nodeId);
          }
        }
        return;
      }

      if (visibleFunctionIds.has(nodeId)) {
        const fn = functionsById.get(nodeId);
        if (fn) {
          const refs = fn.referencedTables || [];
          if (
            !refs.some(
              (tableId) =>
                tableId === focusedTableId || focusedNeighbors.has(tableId)
            )
          ) {
            dimmed.add(nodeId);
          }
        }
      }
    });

    return dimmed;
  }, [
    focusedTableId,
    schema,
    visibleNodeIds,
    visibleTableIds,
    visibleViewIds,
    visibleTriggerIds,
    visibleProcedureIds,
    visibleFunctionIds,
    focusedNeighbors,
  ]);

  const visibleNonDimmedCount = useMemo(() => {
    let count = 0;
    visibleTableIds.forEach((id) => {
      if (!dimmedNodeIds.has(id)) count += 1;
    });
    visibleViewIds.forEach((id) => {
      if (!dimmedNodeIds.has(id)) count += 1;
    });
    return count;
  }, [visibleTableIds, visibleViewIds, dimmedNodeIds]);

  const moderateThreshold = useMemo(
    () => Math.ceil(focusExpandThreshold * 1.67),
    [focusExpandThreshold]
  );

  const edgeVisibleNodeIds = useMemo(() => {
    if (focusMode !== "hide") return visibleNodeIds;
    const next = new Set<string>();
    visibleNodeIds.forEach((id) => {
      if (!dimmedNodeIds.has(id)) {
        next.add(id);
      }
    });
    return next;
  }, [focusMode, visibleNodeIds, dimmedNodeIds]);

  const compactPositions = useMemo(() => {
    if (focusMode !== "hide" || !focusedTableId) return null;
    return calculateCompactLayout(
      focusedTableId,
      edgeVisibleNodeIds,
      focusedNeighbors,
      schema
    );
  }, [focusMode, focusedTableId, edgeVisibleNodeIds, focusedNeighbors, schema]);

  const edgeState = useMemo(() => {
    const start = import.meta.env.DEV ? performance.now() : 0;
    const result = buildEdgeState(
      baseEdges,
      edgeTypeFilter,
      edgeVisibleNodeIds,
      focusedTableId ?? null,
      selectedEdgeIds,
      hoveredEdgeId,
      showEdgeLabels
    );
    if (import.meta.env.DEV) {
      const duration = performance.now() - start;
      if (duration > 4) {
        console.log("[perf] buildEdgeState", {
          durationMs: Number(duration.toFixed(2)),
          edgeCount: baseEdges.length,
        });
      }
    }
    return result;
  }, [
    baseEdges,
    edgeTypeFilter,
    edgeVisibleNodeIds,
    focusedTableId,
    selectedEdgeIds,
    hoveredEdgeId,
    showEdgeLabels,
  ]);

  const processedNodes = useMemo(() => {
    const start = import.meta.env.DEV ? performance.now() : 0;
    let updatedCount = 0;
    const previousCache = processedNodeCacheRef.current;
    const nextCache = new Map<string, Node>();

    const nextNodes = nodes.map((node) => {
      const prevNode = previousCache.get(node.id);
      const isVisible = visibleNodeIds.has(node.id);
      const isDimmed = dimmedNodeIds.has(node.id);
      const isFocused =
        focusedTableId &&
        (node.type === "tableNode" || node.type === "viewNode")
          ? node.id === focusedTableId
          : false;

      const shouldHide = !isVisible || (focusMode === "hide" && isDimmed);
      const prevData = (prevNode?.data ?? node.data) as Record<string, unknown>;
      let nextData = prevData;

      const baseDataChanged =
        prevData.isFocused !== isFocused || prevData.isDimmed !== isDimmed;

      if (node.type === "tableNode" || node.type === "viewNode") {
        let nodeIsCompact = deferredZoom < COMPACT_ZOOM;

        if (deferredZoom < FORCE_COMPACT_ZOOM) {
          nodeIsCompact = true;
        } else if (focusedTableId) {
          if (node.id === focusedTableId) {
            nodeIsCompact = false;
          } else if (focusedNeighbors.has(node.id)) {
            if (visibleNonDimmedCount <= focusExpandThreshold) {
              nodeIsCompact = false;
            } else if (visibleNonDimmedCount <= moderateThreshold) {
              nodeIsCompact = deferredZoom < FOCUS_COMPACT_ZOOM;
            }
          }
        }

        const nextColumnsWithHandles = schemaIndex.columnsWithHandles;
        const nextHandleEdgeTypes = edgeState.handleEdgeTypes;

        const nextDataChanged =
          baseDataChanged ||
          prevData.isCompact !== nodeIsCompact ||
          prevData.columnsWithHandles !== nextColumnsWithHandles ||
          prevData.handleEdgeTypes !== nextHandleEdgeTypes;

        if (nextDataChanged) {
          nextData = {
            ...prevData,
            isFocused,
            isDimmed,
            isCompact: nodeIsCompact,
            columnsWithHandles: nextColumnsWithHandles,
            handleEdgeTypes: nextHandleEdgeTypes,
          };
        }
      } else if (baseDataChanged) {
        nextData = {
          ...prevData,
          isFocused,
          isDimmed,
        };
      }

      const prevHidden = prevNode?.hidden ?? node.hidden ?? false;
      const prevPosition = prevNode?.position ?? node.position;
      const positionUnchanged =
        prevPosition.x === node.position.x &&
        prevPosition.y === node.position.y;

      if (
        prevNode &&
        prevHidden === shouldHide &&
        nextData === prevData &&
        positionUnchanged
      ) {
        nextCache.set(node.id, prevNode);
        return prevNode;
      }

      const nextNode = {
        ...node,
        hidden: shouldHide,
        data: nextData,
      };
      updatedCount += 1;
      nextCache.set(node.id, nextNode);
      return nextNode;
    });

    processedNodeCacheRef.current = nextCache;

    if (import.meta.env.DEV) {
      const duration = performance.now() - start;
      if (duration > 4) {
        console.log("[perf] processNodes", {
          durationMs: Number(duration.toFixed(2)),
          nodeCount: nodes.length,
          updatedCount,
        });
      }
    }

    return nextNodes;
  }, [
    nodes,
    visibleNodeIds,
    dimmedNodeIds,
    focusedTableId,
    focusedNeighbors,
    focusMode,
    deferredZoom,
    focusExpandThreshold,
    visibleNonDimmedCount,
    moderateThreshold,
    schemaIndex.columnsWithHandles,
    edgeState.handleEdgeTypes,
  ]);

  const processedEdges = edgeState.edges;

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    console.log("[perf] schema-graph recalculated", {
      baseNodes: baseNodes.length,
      baseEdges: baseEdges.length,
      visibleNodes: visibleNodeIds.size,
      visibleEdges: processedEdges.length,
    });
  }, [baseNodes.length, baseEdges.length, visibleNodeIds, processedEdges.length]);

  useEffect(() => {
    const prevState = prevFocusStateRef.current;
    const nextFocusedId = focusedTableId ?? null;
    const isHideFocusActive = focusMode === "hide" && Boolean(nextFocusedId);
    const justEnteredFocus =
      isHideFocusActive &&
      (prevState.focusedTableId !== nextFocusedId ||
        prevState.focusMode !== "hide");
    const justExitedFocus =
      !isHideFocusActive &&
      prevState.focusMode === "hide" &&
      prevState.focusedTableId !== null;

    let timeoutId: number | undefined;

    if (justEnteredFocus || justExitedFocus) {
      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          let nextPosition = node.position;

          if (justEnteredFocus && compactPositions && compactPositions.has(node.id)) {
            nextPosition = compactPositions.get(node.id)!;
          } else if (
            justExitedFocus &&
            originalPositionsRef.current.has(node.id)
          ) {
            nextPosition = originalPositionsRef.current.get(node.id)!;
          } else {
            return node;
          }

          if (
            nextPosition.x === node.position.x &&
            nextPosition.y === node.position.y
          ) {
            return node;
          }

          return {
            ...node,
            position: nextPosition,
          };
        })
      );

      if (justEnteredFocus) {
        timeoutId = window.setTimeout(() => {
          fitView({ padding: 0.2, maxZoom: 1.5, minZoom: 0.6, duration: 300 });
        }, 50);
      }
    }

    prevFocusStateRef.current = { focusedTableId: nextFocusedId, focusMode };

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [focusedTableId, focusMode, compactPositions, setNodes, fitView]);

  return (
    <div className="w-full h-full relative flex">
      <SchemaBrowserSidebar
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        schema={schema}
        onItemClick={handleSidebarItemClick}
      />
      <DetailPopover
        open={popoverOpen}
        data={popoverData}
        anchorRect={anchorRect}
        onClose={closePopover}
      />
      <main
        className={cn(
          "flex-1 h-full transition-all duration-300",
          sidebarOpen && "ml-[280px]"
        )}
      >
        <div className="relative w-full h-full">
          <SidebarToggle
            onClick={() => setSidebarOpen(true)}
            visible={!sidebarOpen}
          />
          <ReactFlow
            nodes={processedNodes}
            edges={processedEdges}
            onNodesChange={onNodesChange}
            onEdgeClick={onEdgeClick}
            onEdgeMouseEnter={onEdgeMouseEnter}
            onEdgeMouseLeave={onEdgeMouseLeave}
            onPaneClick={onPaneClick}
            onMove={onMove}
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
            <Background
              className="!bg-background [&>pattern>circle]:!fill-border"
              gap={20}
            />
            <Controls className="!bg-background !border-border !shadow-sm [&>button]:!bg-background [&>button]:!border-border [&>button]:!text-foreground [&>button:hover]:!bg-muted" />
            <MiniMap
              nodeColor={getMinimapNodeColor}
              maskColor="var(--minimap-mask)"
              className="!bg-background"
              pannable
              zoomable
            />
          </ReactFlow>
        </div>
      </main>
    </div>
  );
}

export function SchemaGraphView(props: SchemaGraphProps) {
  return <SchemaGraphInner {...props} />;
}
