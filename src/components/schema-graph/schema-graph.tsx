import { useMemo, useState, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import {
  SchemaGraph as SchemaGraphType,
  TableNode as TableNodeType,
  Trigger,
  StoredProcedure,
} from "@/types/schema";
import { TableNode } from "./table-node";
import { TriggerNode } from "./trigger-node";
import { StoredProcedureNode } from "./stored-procedure-node";
import { DetailModal, DetailModalData } from "./detail-modal";

// Define custom node types outside component to prevent re-renders
const nodeTypes = {
  tableNode: TableNode,
  triggerNode: TriggerNode,
  storedProcedureNode: StoredProcedureNode,
};

interface SchemaGraphProps {
  schema: SchemaGraphType;
  focusedTableId?: string | null;
  searchFilter?: string;
  schemaFilter?: string;
}

// Callback types for node clicks
interface ConvertOptions {
  onTableClick?: (table: TableNodeType) => void;
  onTriggerClick?: (trigger: Trigger) => void;
  onProcedureClick?: (procedure: StoredProcedure) => void;
}

// Convert SchemaGraph to React Flow format
function convertToFlowElements(
  schema: SchemaGraphType,
  focusedTableId?: string | null,
  searchFilter?: string,
  schemaFilter?: string,
  options?: ConvertOptions
): { nodes: Node[]; edges: Edge[] } {
  // Filter tables based on search and schema
  let filteredTables = schema.tables;

  if (searchFilter) {
    const lowerSearch = searchFilter.toLowerCase();
    filteredTables = filteredTables.filter(
      (t) =>
        t.name.toLowerCase().includes(lowerSearch) ||
        t.schema.toLowerCase().includes(lowerSearch) ||
        t.id.toLowerCase().includes(lowerSearch)
    );
  }

  if (schemaFilter && schemaFilter !== "all") {
    filteredTables = filteredTables.filter((t) => t.schema === schemaFilter);
  }

  const tableIds = new Set(filteredTables.map((t) => t.id));

  // Filter triggers and stored procedures based on schema filter
  const triggers = schema.triggers || [];
  const storedProcedures = schema.storedProcedures || [];

  let filteredTriggers = triggers.filter((tr) => tableIds.has(tr.tableId));
  let filteredProcedures = storedProcedures;

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

  // Track table positions for trigger placement
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
        onClick: () => options?.onTableClick?.(table),
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

  const nodes: Node[] = [...tableNodes, ...triggerNodes, ...procedureNodes];

  // Convert relationships to edges (only for visible tables)
  const fkEdges: Edge[] = schema.relationships
    .filter((rel) => tableIds.has(rel.from) && tableIds.has(rel.to))
    .map((rel) => {
      const isDimmed =
        focusedTableId !== null &&
        focusedTableId !== undefined &&
        rel.from !== focusedTableId &&
        rel.to !== focusedTableId;

      return {
        id: rel.id,
        source: rel.from,
        target: rel.to,
        sourceHandle: `${rel.from}-${rel.fromColumn}`,
        targetHandle: `${rel.to}-${rel.toColumn}`,
        type: "smoothstep",
        animated: !isDimmed,
        style: {
          stroke: isDimmed ? "#cbd5e1" : "#3b82f6",
          strokeWidth: isDimmed ? 1 : 2,
          opacity: isDimmed ? 0.4 : 1,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isDimmed ? "#cbd5e1" : "#3b82f6",
        },
        label: `${rel.fromColumn} → ${rel.toColumn}`,
        labelStyle: {
          fontSize: 10,
          fill: isDimmed ? "#94a3b8" : "#475569",
        },
        labelBgStyle: {
          fill: "#ffffff",
          fillOpacity: 0.8,
        },
      };
    });

  // Create edges from triggers to their parent tables
  const triggerEdges: Edge[] = filteredTriggers
    .filter((tr) => tableIds.has(tr.tableId))
    .map((trigger) => {
      const isDimmed =
        focusedTableId !== null &&
        focusedTableId !== undefined &&
        trigger.tableId !== focusedTableId;

      return {
        id: `trigger-edge-${trigger.id}`,
        source: trigger.tableId,
        target: trigger.id,
        type: "smoothstep",
        animated: false,
        style: {
          stroke: isDimmed ? "#fcd34d" : "#f59e0b",
          strokeWidth: isDimmed ? 1 : 2,
          strokeDasharray: "5,5",
          opacity: isDimmed ? 0.4 : 1,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: isDimmed ? "#fcd34d" : "#f59e0b",
        },
      };
    });

  const edges: Edge[] = [...fkEdges, ...triggerEdges];

  return { nodes, edges };
}

export function SchemaGraphView({
  schema,
  focusedTableId,
  searchFilter,
  schemaFilter,
}: SchemaGraphProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState<DetailModalData | null>(null);

  const handleTableClick = (table: TableNodeType) => {
    setModalData({ type: "table", data: table });
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
    onTriggerClick: handleTriggerClick,
    onProcedureClick: handleProcedureClick,
  };

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () =>
      convertToFlowElements(
        schema,
        focusedTableId,
        searchFilter,
        schemaFilter,
        options
      ),
    [schema, focusedTableId, searchFilter, schemaFilter]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when filters change
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = convertToFlowElements(
      schema,
      focusedTableId,
      searchFilter,
      schemaFilter,
      options
    );
    setNodes(newNodes);
    setEdges(newEdges);
  }, [schema, focusedTableId, searchFilter, schemaFilter, setNodes, setEdges]);

  return (
    <div className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#e2e8f0" gap={20} />
        <Controls className="!bg-white !border-slate-200 !shadow-sm" />
        <MiniMap
          nodeColor={(node) => {
            if (node.data?.isFocused) return "#3b82f6";
            if (node.data?.isDimmed) return "#e2e8f0";
            if (node.type === "triggerNode") return "#f59e0b";
            if (node.type === "storedProcedureNode") return "#8b5cf6";
            return "#64748b";
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
          className="!bg-white !border-slate-200"
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
