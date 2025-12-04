import { useMemo, useCallback, useEffect } from "react";
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

import { SchemaGraph as SchemaGraphType } from "@/types/schema";
import { TableNode } from "./table-node";

// Define custom node types outside component to prevent re-renders
const nodeTypes = {
  tableNode: TableNode,
};

interface SchemaGraphProps {
  schema: SchemaGraphType;
  focusedTableId?: string | null;
  searchFilter?: string;
  schemaFilter?: string;
}

// Convert SchemaGraph to React Flow format
function convertToFlowElements(
  schema: SchemaGraphType,
  focusedTableId?: string | null,
  searchFilter?: string,
  schemaFilter?: string
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

  const nodes: Node[] = filteredTables.map((table, index) => {
    const col = index % GRID_COLS;
    const row = Math.floor(index / GRID_COLS);

    const isDimmed =
      focusedTableId !== null &&
      focusedTableId !== undefined &&
      table.id !== focusedTableId &&
      !focusedNeighbors.has(table.id);

    return {
      id: table.id,
      type: "tableNode",
      position: {
        x: col * (NODE_WIDTH + GAP_X),
        y: row * (NODE_HEIGHT + GAP_Y),
      },
      data: {
        table,
        isFocused: table.id === focusedTableId,
        isDimmed,
      },
    };
  });

  // Convert relationships to edges (only for visible tables)
  const edges: Edge[] = schema.relationships
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

  return { nodes, edges };
}

export function SchemaGraphView({
  schema,
  focusedTableId,
  searchFilter,
  schemaFilter,
}: SchemaGraphProps) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () =>
      convertToFlowElements(schema, focusedTableId, searchFilter, schemaFilter),
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
      schemaFilter
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
            return "#64748b";
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
          className="!bg-white !border-slate-200"
        />
      </ReactFlow>
    </div>
  );
}
