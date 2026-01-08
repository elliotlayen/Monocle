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
  ScalarFunction,
} from "@/types/schema";
import { ObjectType, EdgeType, useSchemaStore } from "@/stores/schemaStore";
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
const EDGE_LABEL_ZOOM = 0.8;

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
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const { selectedEdgeIds, toggleEdgeSelection, clearEdgeSelection } =
    useSchemaStore(
      useShallow((state) => ({
        selectedEdgeIds: state.selectedEdgeIds,
        toggleEdgeSelection: state.toggleEdgeSelection,
        clearEdgeSelection: state.clearEdgeSelection,
      }))
    );

  const [zoom, setZoom] = useState(0.8);
  const isCompact = zoom < COMPACT_ZOOM;
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

    const { edges: nextEdges, handleEdgeTypes } = buildEdgeState(
      baseEdges,
      edgeTypeFilter,
      visibleNodeIds,
      focusedTableId ?? null,
      selectedEdgeIds,
      hoveredEdgeId,
      showEdgeLabels
    );
    setEdges(nextEdges);

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
          nextData.isCompact = isCompact;
        }

        return {
          ...node,
          hidden: !isVisible,
          data: nextData,
        };
      })
    );
  }, [
    baseEdges,
    edgeTypeFilter,
    focusedTableId,
    isCompact,
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
