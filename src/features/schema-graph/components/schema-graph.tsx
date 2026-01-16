import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
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
import { DetailModal, DetailModalData } from "./detail-modal";

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
  visibleNodeIds: Set<string>,
  neighbors: Set<string>,
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
  onTableClick?: (table: TableNodeType) => void;
  onViewClick?: (view: ViewNodeType) => void;
  onTriggerClick?: (trigger: Trigger) => void;
  onProcedureClick?: (procedure: StoredProcedure) => void;
  onFunctionClick?: (fn: ScalarFunction) => void;
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
        onClick: () => options?.onTableClick?.(table),
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
        onClick: () => options?.onViewClick?.(view),
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
          onClick: () => options?.onTriggerClick?.(trigger),
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
        onClick: () => options?.onProcedureClick?.(procedure),
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
        onClick: () => options?.onFunctionClick?.(fn),
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
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<DetailModalData | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
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

  const [zoom, setZoom] = useState(0.8);
  const showEdgeLabels = zoom >= EDGE_LABEL_ZOOM;

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

  const handleTableClick = useCallback((table: TableNodeType) => {
    setModalData({ type: "table", data: table });
    setModalOpen(true);
  }, []);

  const handleViewClick = useCallback((view: ViewNodeType) => {
    setModalData({ type: "view", data: view });
    setModalOpen(true);
  }, []);

  const handleTriggerClick = useCallback((trigger: Trigger) => {
    setModalData({ type: "trigger", data: trigger });
    setModalOpen(true);
  }, []);

  const handleProcedureClick = useCallback((procedure: StoredProcedure) => {
    setModalData({ type: "storedProcedure", data: procedure });
    setModalOpen(true);
  }, []);

  const handleFunctionClick = useCallback((fn: ScalarFunction) => {
    setModalData({ type: "scalarFunction", data: fn });
    setModalOpen(true);
  }, []);

  const options: ConvertOptions = useMemo(
    () => ({
      onTableClick: handleTableClick,
      onViewClick: handleViewClick,
      onTriggerClick: handleTriggerClick,
      onProcedureClick: handleProcedureClick,
      onFunctionClick: handleFunctionClick,
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
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    setNodes(baseNodes);
  }, [baseNodes, setNodes]);

  // Store original positions when baseNodes change
  useEffect(() => {
    const positions = new Map<string, { x: number; y: number }>();
    baseNodes.forEach((node) => positions.set(node.id, { ...node.position }));
    originalPositionsRef.current = positions;
  }, [baseNodes]);

  useEffect(() => {
    const lowerSearch = searchFilter?.trim().toLowerCase() ?? "";
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

    let filteredProcedures = showProcedures ? (schema.storedProcedures || []) : [];
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

    const focusedNeighbors = focusedTableId
      ? schemaIndex.neighbors.get(focusedTableId) ?? new Set<string>()
      : new Set<string>();

    // Calculate which nodes would be dimmed for focus mode
    const dimmedNodeIds = new Set<string>();
    if (focusedTableId) {
      visibleNodeIds.forEach((nodeId) => {
        // Tables and views: dimmed if not focused and not a neighbor
        if (visibleTableIds.has(nodeId) || visibleViewIds.has(nodeId)) {
          if (nodeId !== focusedTableId && !focusedNeighbors.has(nodeId)) {
            dimmedNodeIds.add(nodeId);
          }
        }
        // Triggers: dimmed if their table is not focused and not a neighbor
        else if (visibleTriggerIds.has(nodeId)) {
          const trigger = (schema.triggers || []).find((t) => t.id === nodeId);
          if (trigger && trigger.tableId !== focusedTableId && !focusedNeighbors.has(trigger.tableId)) {
            dimmedNodeIds.add(nodeId);
          }
        }
        // Procedures: dimmed if none of their tables are focused or neighbors
        else if (visibleProcedureIds.has(nodeId)) {
          const procedure = (schema.storedProcedures || []).find((p) => p.id === nodeId);
          if (procedure) {
            const refs = [...(procedure.referencedTables || []), ...(procedure.affectedTables || [])];
            if (!refs.some((tableId) => tableId === focusedTableId || focusedNeighbors.has(tableId))) {
              dimmedNodeIds.add(nodeId);
            }
          }
        }
        // Functions: dimmed if none of their tables are focused or neighbors
        else if (visibleFunctionIds.has(nodeId)) {
          const fn = (schema.scalarFunctions || []).find((f) => f.id === nodeId);
          if (fn) {
            const refs = fn.referencedTables || [];
            if (!refs.some((tableId) => tableId === focusedTableId || focusedNeighbors.has(tableId))) {
              dimmedNodeIds.add(nodeId);
            }
          }
        }
      });
    }

    // Count visible non-dimmed tables/views for per-node compact calculation
    const visibleNonDimmedCount = [...visibleTableIds, ...visibleViewIds]
      .filter((id) => !dimmedNodeIds.has(id)).length;
    const moderateThreshold = Math.ceil(focusExpandThreshold * 1.67);

    // For edge building, exclude dimmed nodes when focus mode is "hide"
    const edgeVisibleNodeIds = focusMode === "hide"
      ? new Set([...visibleNodeIds].filter((id) => !dimmedNodeIds.has(id)))
      : visibleNodeIds;

    const { edges: nextEdges, handleEdgeTypes } = buildEdgeState(
      baseEdges,
      edgeTypeFilter,
      edgeVisibleNodeIds,
      focusedTableId ?? null,
      selectedEdgeIds,
      hoveredEdgeId,
      showEdgeLabels
    );
    setEdges(nextEdges);

    // Check if we're entering or exiting focus mode (for one-time position changes)
    const prevState = prevFocusStateRef.current;
    const justEnteredFocus =
      focusMode === "hide" &&
      focusedTableId &&
      (prevState.focusedTableId !== focusedTableId || prevState.focusMode !== "hide");

    // Detect if we JUST exited focus mode (restore positions once, not continuously)
    const justExitedFocus =
      !(focusMode === "hide" && focusedTableId) &&
      prevState.focusMode === "hide" &&
      prevState.focusedTableId !== null;

    // Calculate compact positions when focus mode is "hide" and focused
    const shouldUseCompactLayout = focusMode === "hide" && focusedTableId;
    const compactPositions = shouldUseCompactLayout
      ? calculateCompactLayout(focusedTableId, edgeVisibleNodeIds, focusedNeighbors, schema)
      : null;

    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        const isVisible = visibleNodeIds.has(node.id);
        let isFocused = false;
        let isDimmed = false;

        if (focusedTableId) {
          if (node.type === "tableNode" || node.type === "viewNode") {
            isFocused = node.id === focusedTableId;
            isDimmed = !isFocused && !focusedNeighbors.has(node.id);
          } else if (node.type === "triggerNode") {
            const trigger = (node.data as { trigger?: Trigger }).trigger;
            if (trigger) {
              isDimmed =
                trigger.tableId !== focusedTableId &&
                !focusedNeighbors.has(trigger.tableId);
            }
          } else if (node.type === "storedProcedureNode") {
            const procedure = (node.data as { procedure?: StoredProcedure }).procedure;
            if (procedure) {
              const refs = [...(procedure.referencedTables || []), ...(procedure.affectedTables || [])];
              isDimmed = !refs.some(
                (tableId) => tableId === focusedTableId || focusedNeighbors.has(tableId)
              );
            }
          } else if (node.type === "scalarFunctionNode") {
            const fn = (node.data as { function?: ScalarFunction }).function;
            if (fn) {
              const refs = fn.referencedTables || [];
              isDimmed = !refs.some(
                (tableId) => tableId === focusedTableId || focusedNeighbors.has(tableId)
              );
            }
          }
        }

        const nextData: Record<string, unknown> = {
          ...(node.data as Record<string, unknown>),
          isFocused,
          isDimmed,
        };

        if (node.type === "tableNode" || node.type === "viewNode") {
          nextData.columnsWithHandles = schemaIndex.columnsWithHandles;
          nextData.handleEdgeTypes = handleEdgeTypes;

          // Per-node compact calculation
          let nodeIsCompact = zoom < COMPACT_ZOOM;

          if (zoom < FORCE_COMPACT_ZOOM) {
            nodeIsCompact = true;
          } else if (focusedTableId) {
            if (node.id === focusedTableId) {
              // Focused node is always expanded (unless below FORCE_COMPACT_ZOOM)
              nodeIsCompact = false;
            } else if (focusedNeighbors.has(node.id)) {
              // Neighbors: expand based on count thresholds
              if (visibleNonDimmedCount <= focusExpandThreshold) {
                nodeIsCompact = false;
              } else if (visibleNonDimmedCount <= moderateThreshold) {
                nodeIsCompact = zoom < FOCUS_COMPACT_ZOOM;
              }
            }
          }
          nextData.isCompact = nodeIsCompact;
        }

        // Hide node if not visible by filters, or if dimmed and focus mode is "hide"
        const shouldHide = !isVisible || (focusMode === "hide" && isDimmed);

        // Apply compact position (only when entering focus) or restore original (only when exiting)
        let position = node.position;  // Keep current position by default (preserves user drag)
        if (justEnteredFocus && compactPositions && compactPositions.has(node.id)) {
          position = compactPositions.get(node.id)!;
        } else if (justExitedFocus && originalPositionsRef.current.has(node.id)) {
          // Only restore original position when JUST exiting focus mode
          position = originalPositionsRef.current.get(node.id)!;
        }

        return {
          ...node,
          position,
          hidden: shouldHide,
          data: nextData,
        };
      })
    );

    // Call fitView when entering focus mode
    // minZoom: 0.6 ensures we zoom in enough for full node rendering (not compact mode)
    if (justEnteredFocus) {
      setTimeout(() => {
        fitView({ padding: 0.2, maxZoom: 1.5, minZoom: 0.6, duration: 300 });
      }, 50);
    }

    // Update ref for next comparison
    prevFocusStateRef.current = { focusedTableId: focusedTableId ?? null, focusMode };
  }, [
    baseEdges,
    edgeTypeFilter,
    focusedTableId,
    focusMode,
    focusExpandThreshold,
    zoom,
    schema,
    schemaFilter,
    schemaIndex,
    searchFilter,
    selectedEdgeIds,
    hoveredEdgeId,
    setEdges,
    setNodes,
    showEdgeLabels,
    objectTypeFilter,
    fitView,
  ]);

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
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
      <DetailModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        modalData={modalData}
      />
    </div>
  );
}

export function SchemaGraphView(props: SchemaGraphProps) {
  return <SchemaGraphInner {...props} />;
}
