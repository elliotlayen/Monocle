import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useUpdateNodeInternals,
  type Node,
  type Edge,
  type EdgeMouseHandler,
  type Connection,
  type NodeMouseHandler,
  type OnNodeDrag,
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
import { OBJECT_COLORS } from "@/constants/edge-colors";
import { getSchemaIndex } from "@/lib/schema-index";
import { useShallow } from "zustand/shallow";
import { TableNode } from "./table-node";
import { ViewNode } from "./view-node";
import { TriggerNode } from "./trigger-node";
import { StoredProcedureNode } from "./stored-procedure-node";
import { ScalarFunctionNode } from "./scalar-function-node";
import {
  DirectedEdge,
  buildNodeHeightMap,
  getCombinedPositionedBounds,
  getNodeHeight,
  layoutLayeredLeftToRight,
  layoutRightAnchoredChildrenByBands,
} from "./layout";
import {
  buildNodeWidthMap,
  getNodeWidth,
  ROUTINE_MIN_WIDTH,
  TABLE_VIEW_MIN_WIDTH,
  TRIGGER_MIN_WIDTH,
} from "./node-width";
import { TABLE_VIEW_HEADER_HEIGHT } from "./node-geometry";
import { SchemaBrowserSidebar } from "./schema-browser-sidebar";
import { DetailInspector } from "./detail-inspector";
import { DetailDrawer } from "./detail-drawer";
import { SidebarToggle } from "@/components/ui/sidebar-toggle";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { useDetailView } from "../hooks/use-detail-view";
import type { DetailSidebarData } from "./detail-content";
import {
  menuToggleSidebarHub,
  menuFitViewHub,
  menuActualSizeHub,
  menuZoomInHub,
  menuZoomOutHub,
  menuExportPngHub,
  menuExportPdfHub,
  menuExportJsonHub,
  menuDeleteSelectionHub,
  useTauriEvent,
} from "@/services/events";
import { useExport } from "@/features/export/hooks/useExport";
import { CanvasContextMenu } from "@/features/canvas/components/canvas-context-menu";
import { ImportFromDatabaseDialog } from "@/features/canvas/components/import-from-database-dialog";
import { CreateTableDialog } from "@/features/canvas/components/create-table-dialog";
import { CreateViewDialog } from "@/features/canvas/components/create-view-dialog";
import { CreateTriggerDialog } from "@/features/canvas/components/create-trigger-dialog";
import { CreateProcedureDialog } from "@/features/canvas/components/create-procedure-dialog";
import { CreateFunctionDialog } from "@/features/canvas/components/create-function-dialog";
import { CreateEdgeDialog } from "@/features/canvas/components/create-edge-dialog";
import { getAllowedEdgeKinds } from "@/features/canvas/utils/edge-kinds";
import {
  buildColumnHandleBase,
  buildNodeHandleBase,
  parseHandleBase,
  stripHandleSuffix,
} from "@/features/schema-graph/utils/handle-ids";
import {
  areEdgesEquivalent,
  deriveEdgeState,
  type EdgeMeta,
  type EdgeStateResult,
} from "./edge-state";
import { getFilteredObjectBuckets } from "../utils/object-filtering";
import { computeFocusState } from "./focus-state";
import {
  computeBrowseVisibleIds,
  countHiddenNeighbors,
} from "../utils/browse-visibility";
import {
  buildEdgeHoverCardContent,
  type EdgeHoverEndpoint,
} from "./edge-hover-card";
import { applyNodeRenderPatch } from "./node-render-update";
import {
  getFocusTransition,
  isFocusSessionActive,
  shouldForceEdgeFlush,
  type FocusSnapshot,
} from "./focus-transition";
import {
  getZoomBand,
  isCompactForZoomBand,
  isFocusModerateCompactForZoomBand,
  shouldShowEdgeLabelsAtZoom,
  type ZoomBand,
} from "./zoom-band";
import {
  GAP_Y,
  TRIGGER_PARENT_GAP_X,
  TRIGGER_STACK_GAP_Y,
  clampValue,
  placeAuxGroupsSideBySide,
  placeAuxLane,
} from "./aux-layout";
import { calculateCompactLayout } from "./focus-layout";

const OVERVIEW_LAYER_GAP_X = 140;
const OVERVIEW_LAYER_LANE_GAP_X = 72;
const OVERVIEW_TARGET_ASPECT_RATIO = 2.1;
const OVERVIEW_MIN_LANES = 5;
const OVERVIEW_MAX_LANES = 20;
const OVERVIEW_AUX_MAX_COLS = 20;
const TRIGGER_MIN_INTER_BAND_GAP_X_OVERVIEW = OVERVIEW_LAYER_GAP_X;
const EDGE_HOVER_CARD_OFFSET_X = 12;
const EDGE_HOVER_CARD_OFFSET_Y = 12;
const DEFAULT_OBJECT_TEXT_COLOR = "var(--muted-foreground)";

// Define custom node types outside component to prevent re-renders
const nodeTypes = {
  tableNode: TableNode,
  viewNode: ViewNode,
  triggerNode: TriggerNode,
  storedProcedureNode: StoredProcedureNode,
  scalarFunctionNode: ScalarFunctionNode,
};

const EMPTY_ID_SET: Set<string> = new Set();
const ALL_OBJECT_TYPES_FALLBACK: Set<ObjectType> = new Set([
  "tables",
  "views",
  "triggers",
  "storedProcedures",
  "scalarFunctions",
]);

// MiniMap node color function - defined outside component for stable reference
function getMinimapNodeColor(node: Node): string {
  if (node.data?.isFocused) return "var(--accent-blue)";
  if (node.data?.isDimmed) return "var(--color-muted)";
  if (node.type === "viewNode") return OBJECT_COLORS.views;
  if (node.type === "triggerNode") return OBJECT_COLORS.triggers;
  if (node.type === "storedProcedureNode") return OBJECT_COLORS.storedProcedures;
  if (node.type === "scalarFunctionNode") return OBJECT_COLORS.scalarFunctions;
  return OBJECT_COLORS.tables;
}

interface SchemaGraphProps {
  schema: SchemaGraphType;
  focusedTableId?: string | null;
  searchFilter?: string;
  schemaFilter?: string;
  objectTypeFilter?: Set<ObjectType>;
  excludedObjectIds?: Set<string>;
  edgeTypeFilter?: Set<EdgeType>;
  canvasMode?: boolean;
  importDialogOpen?: boolean;
  onImportDialogOpenChange?: (open: boolean) => void;
}

function parseHandleId(handleId: string | null | undefined): {
  tableId: string;
  columnName: string;
} {
  if (!handleId) return { tableId: "", columnName: "" };
  const parsed = parseHandleBase(stripHandleSuffix(handleId));
  return { tableId: parsed.nodeId, columnName: parsed.columnName };
}

function buildMainDirectedEdges(
  schema: SchemaGraphType,
  viewColumnSources: Map<
    string,
    { columnName: string; sourceTableId: string; sourceColumn: string }[]
  >
): DirectedEdge[] {
  const edges: DirectedEdge[] = [];
  const seen = new Set<string>();
  const tableLikeIds = new Set<string>([
    ...schema.tables.map((table) => table.id),
    ...(schema.views || []).map((view) => view.id),
  ]);

  const pushEdge = (from: string, to: string) => {
    if (!from || !to || from === to) return;
    const key = `${from}=>${to}`;
    if (seen.has(key)) return;
    seen.add(key);
    edges.push({ from, to });
  };

  schema.relationships.forEach((rel) => {
    pushEdge(rel.from, rel.to);
  });

  for (const [viewId, sources] of viewColumnSources.entries()) {
    for (const source of sources) {
      pushEdge(source.sourceTableId, viewId);
    }
  }

  (schema.views || []).forEach((view) => {
    (view.referencedTables || []).forEach((sourceId) => {
      if (!tableLikeIds.has(sourceId)) return;
      pushEdge(sourceId, view.id);
    });
  });

  return edges;
}

const getOverviewMainMaxLanes = (nodeCount: number) =>
  clampValue(
    Math.ceil(Math.sqrt(Math.max(1, nodeCount)) * 1.8),
    OVERVIEW_MIN_LANES,
    OVERVIEW_MAX_LANES
  );

function estimateOverviewAuxCols(
  nodeIds: string[],
  nodeHeights: Map<string, number>,
  nodeWidths: Map<string, number>,
  fallbackWidth: number
): number {
  if (nodeIds.length === 0) {
    return 1;
  }

  const totalStackHeight =
    nodeIds.reduce((sum, nodeId) => sum + getNodeHeight(nodeHeights, nodeId), 0) +
    GAP_Y * Math.max(0, nodeIds.length - 1);
  const avgNodeWidth =
    nodeIds.reduce(
      (sum, nodeId) => sum + getNodeWidth(nodeWidths, nodeId, fallbackWidth),
      0
    ) / nodeIds.length;
  const safeAvgWidth = Math.max(1, avgNodeWidth);

  return clampValue(
    Math.ceil(
      Math.sqrt((OVERVIEW_TARGET_ASPECT_RATIO * totalStackHeight) / safeAvgWidth)
    ),
    1,
    OVERVIEW_AUX_MAX_COLS
  );
}

// Callback types for node clicks
interface ConvertOptions {
  onTableClick?: (table: TableNodeType, event: React.MouseEvent) => void;
  onViewClick?: (view: ViewNodeType, event: React.MouseEvent) => void;
  onTriggerClick?: (trigger: Trigger, event: React.MouseEvent) => void;
  onProcedureClick?: (
    procedure: StoredProcedure,
    event: React.MouseEvent
  ) => void;
  onFunctionClick?: (fn: ScalarFunction, event: React.MouseEvent) => void;
  onExpandNeighbors?: (nodeId: string) => void;
}

interface EdgeEditState {
  id: string;
  edgeType: EdgeType;
  sourceId: string;
  targetId: string;
  sourceColumn?: string;
  targetColumn?: string;
}

interface EdgeHoverCardState {
  edgeId: string;
  title?: string;
  from: EdgeHoverEndpoint;
  to: EdgeHoverEndpoint;
  x: number;
  y: number;
}

function buildBaseNodes(
  schema: SchemaGraphType,
  options: ConvertOptions,
  columnsWithHandles: Set<string>,
  fkColumnUsage: Map<string, { outgoing: number; incoming: number }>,
  fkColumnLinks: Map<
    string,
    { direction: "outgoing" | "incoming"; tableId: string; column: string }[]
  >,
  nodeHeights: Map<string, number>,
  nodeWidths: Map<string, number>,
  mainDependencyEdges: DirectedEdge[],
  // Browse mode: only build (and lay out) this subset; null renders everything.
  includeIds: Set<string> | null,
  neighbors: Map<string, Set<string>>
): Node[] {
  if (includeIds && includeIds.size === 0) return [];
  const includes = (id: string) => !includeIds || includeIds.has(id);
  const tables = schema.tables.filter((table) => includes(table.id));
  const views = (schema.views || []).filter((view) => includes(view.id));
  const hiddenNeighborCount = (id: string) =>
    includeIds ? countHiddenNeighbors(id, includeIds, neighbors) : 0;
  const mainNodeIds = [...tables.map((table) => table.id), ...views.map((view) => view.id)];
  const overviewMaxLanes = getOverviewMainMaxLanes(mainNodeIds.length);
  const layered = layoutLayeredLeftToRight({
    nodeIds: mainNodeIds,
    edges: mainDependencyEdges,
    layerGapX: OVERVIEW_LAYER_GAP_X,
    laneGapX: OVERVIEW_LAYER_LANE_GAP_X,
    gapY: GAP_Y,
    maxLanes: overviewMaxLanes,
    targetAspectRatio: OVERVIEW_TARGET_ASPECT_RATIO,
    getHeight: (nodeId) => getNodeHeight(nodeHeights, nodeId),
    getWidth: (nodeId) => getNodeWidth(nodeWidths, nodeId, TABLE_VIEW_MIN_WIDTH),
  });
  const mainPositions = layered.positions;
  const orderedRanks = [
    ...new Set(mainNodeIds.map((nodeId) => layered.layerByNode.get(nodeId) ?? 0)),
  ].sort((a, b) => a - b);
  const orderedBandIds = orderedRanks.map((rank) => `overview-rank-${rank}`);
  const bandIdByRank = new Map<number, string>();
  orderedRanks.forEach((rank, index) => {
    bandIdByRank.set(rank, orderedBandIds[index]);
  });
  const parentIdsByBand = new Map<string, string[]>();
  orderedBandIds.forEach((bandId) => parentIdsByBand.set(bandId, []));
  mainNodeIds.forEach((nodeId) => {
    const rank = layered.layerByNode.get(nodeId) ?? 0;
    const bandId = bandIdByRank.get(rank);
    if (!bandId) return;
    parentIdsByBand.get(bandId)!.push(nodeId);
  });

  const triggerEntries = (schema.triggers || []).filter((trigger) =>
    includes(trigger.id)
  );
  const childIdsByParent = new Map<string, string[]>();
  triggerEntries.forEach((trigger) => {
    if (!childIdsByParent.has(trigger.tableId)) {
      childIdsByParent.set(trigger.tableId, []);
    }
    childIdsByParent.get(trigger.tableId)!.push(trigger.id);
  });
  const triggerLayout = layoutRightAnchoredChildrenByBands({
    orderedBandIds,
    parentIdsByBand,
    childIdsByParent,
    parentPositions: mainPositions,
    getParentWidth: (parentId) =>
      getNodeWidth(nodeWidths, parentId, TABLE_VIEW_MIN_WIDTH),
    getParentHeight: (parentId) => getNodeHeight(nodeHeights, parentId),
    getChildWidth: (childId) =>
      getNodeWidth(nodeWidths, childId, TRIGGER_MIN_WIDTH),
    getChildHeight: (childId) => getNodeHeight(nodeHeights, childId),
    baseGapX: TRIGGER_PARENT_GAP_X,
    stackGapY: TRIGGER_STACK_GAP_Y,
    minLaneGapX: OVERVIEW_LAYER_LANE_GAP_X,
    minBandGapX: TRIGGER_MIN_INTER_BAND_GAP_X_OVERVIEW,
    getChildStackStartY: ({ parentTopY }) =>
      parentTopY + TABLE_VIEW_HEADER_HEIGHT,
  });

  const shiftedMainPositions: Record<string, { x: number; y: number }> = {};
  mainNodeIds.forEach((nodeId) => {
    const position = mainPositions[nodeId];
    if (!position) return;
    const shiftX = triggerLayout.parentShiftById.get(nodeId) ?? 0;
    shiftedMainPositions[nodeId] = { x: position.x + shiftX, y: position.y };
  });

  const tableNodes: Node[] = tables.map((table) => {
    const position = shiftedMainPositions[table.id];

    return {
      id: table.id,
      type: "tableNode",
      position,
      data: {
        table,
        isFocused: false,
        isDimmed: false,
        isCompact: false,
        nodeWidth: getNodeWidth(nodeWidths, table.id, TABLE_VIEW_MIN_WIDTH),
        columnsWithHandles,
        fkColumnUsage,
        fkColumnLinks,
        handleEdgeTypes: undefined,
        hiddenNeighborCount: hiddenNeighborCount(table.id),
        onExpandNeighbors: () => options?.onExpandNeighbors?.(table.id),
        onClick: (e: React.MouseEvent) => options?.onTableClick?.(table, e),
      },
    };
  });

  const viewNodes: Node[] = views.map((view) => {
    const position = shiftedMainPositions[view.id];

    return {
      id: view.id,
      type: "viewNode",
      position,
      data: {
        view,
        isFocused: false,
        isDimmed: false,
        isCompact: false,
        nodeWidth: getNodeWidth(nodeWidths, view.id, TABLE_VIEW_MIN_WIDTH),
        columnsWithHandles,
        fkColumnUsage,
        fkColumnLinks,
        handleEdgeTypes: undefined,
        hiddenNeighborCount: hiddenNeighborCount(view.id),
        onExpandNeighbors: () => options?.onExpandNeighbors?.(view.id),
        onClick: (e: React.MouseEvent) => options?.onViewClick?.(view, e),
      },
    };
  });

  const bottomPositions = new Map<string, { x: number; y: number }>();
  Object.entries(triggerLayout.positions).forEach(([id, position]) => {
    bottomPositions.set(id, position);
  });

  const mainAndTriggerBounds = getCombinedPositionedBounds(
    [shiftedMainPositions, triggerLayout.positions],
    (nodeId) => getNodeHeight(nodeHeights, nodeId),
    (nodeId) => {
      if (shiftedMainPositions[nodeId]) {
        return getNodeWidth(nodeWidths, nodeId, TABLE_VIEW_MIN_WIDTH);
      }
      return getNodeWidth(nodeWidths, nodeId, TRIGGER_MIN_WIDTH);
    }
  );
  let nextY = mainAndTriggerBounds.maxBottom + GAP_Y;

  const orphanTriggerIds = triggerLayout.unplacedChildIds;
  const orphanTriggerCols = estimateOverviewAuxCols(
    orphanTriggerIds,
    nodeHeights,
    nodeWidths,
    TRIGGER_MIN_WIDTH
  );
  nextY = placeAuxLane(
    bottomPositions,
    orphanTriggerIds,
    mainAndTriggerBounds.minX,
    nextY,
    nodeHeights,
    nodeWidths,
    TRIGGER_MIN_WIDTH,
    orphanTriggerCols
  );

  const procedures = (schema.storedProcedures || []).filter((proc) =>
    includes(proc.id)
  );
  const scalarFunctions = (schema.scalarFunctions || []).filter((fn) =>
    includes(fn.id)
  );
  const procedureIds = procedures.map((proc) => proc.id);
  const functionIds = scalarFunctions.map((fn) => fn.id);
  const procedureCols = estimateOverviewAuxCols(
    procedureIds,
    nodeHeights,
    nodeWidths,
    ROUTINE_MIN_WIDTH
  );
  const functionCols = estimateOverviewAuxCols(
    functionIds,
    nodeHeights,
    nodeWidths,
    ROUTINE_MIN_WIDTH
  );
  placeAuxGroupsSideBySide(
    bottomPositions,
    procedureIds,
    functionIds,
    mainAndTriggerBounds.minX,
    nextY,
    nodeHeights,
    nodeWidths,
    ROUTINE_MIN_WIDTH,
    ROUTINE_MIN_WIDTH,
    procedureCols,
    functionCols
  );

  const triggerNodes: Node[] = triggerEntries.map((trigger) => ({
    id: trigger.id,
    type: "triggerNode",
    position: bottomPositions.get(trigger.id) ?? { x: 0, y: 0 },
    data: {
      trigger,
      isDimmed: false,
      nodeWidth: getNodeWidth(nodeWidths, trigger.id, TRIGGER_MIN_WIDTH),
      onClick: (e: React.MouseEvent) => options?.onTriggerClick?.(trigger, e),
    },
  }));

  const procedureNodes: Node[] = procedures.map(
    (procedure) => ({
      id: procedure.id,
      type: "storedProcedureNode",
      position: bottomPositions.get(procedure.id) ?? { x: 0, y: 0 },
      data: {
        procedure,
        isDimmed: false,
        nodeWidth: getNodeWidth(nodeWidths, procedure.id, ROUTINE_MIN_WIDTH),
        onClick: (e: React.MouseEvent) =>
          options?.onProcedureClick?.(procedure, e),
      },
    })
  );

  const functionNodes: Node[] = scalarFunctions.map((fn) => ({
    id: fn.id,
    type: "scalarFunctionNode",
    position: bottomPositions.get(fn.id) ?? { x: 0, y: 0 },
    data: {
      function: fn,
      isDimmed: false,
      nodeWidth: getNodeWidth(nodeWidths, fn.id, ROUTINE_MIN_WIDTH),
      onClick: (e: React.MouseEvent) => options?.onFunctionClick?.(fn, e),
    },
  }));

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
  viewColumnSources: Map<
    string,
    { columnName: string; sourceTableId: string; sourceColumn: string }[]
  >
): EdgeMeta[] {
  const edges: EdgeMeta[] = [];
  const tableLikeIds = new Set<string>([
    ...schema.tables.map((table) => table.id),
    ...(schema.views || []).map((view) => view.id),
  ]);

  schema.relationships.forEach((rel) => {
    const sourceHandle = rel.fromColumn
      ? `${buildColumnHandleBase(rel.from, rel.fromColumn)}-source`
      : `${buildNodeHandleBase(rel.from)}-source`;
    const targetHandle = rel.toColumn
      ? `${buildColumnHandleBase(rel.to, rel.toColumn)}-target`
      : `${buildNodeHandleBase(rel.to)}-target`;
    const columnLabel =
      rel.fromColumn && rel.toColumn
        ? `${rel.fromColumn} → ${rel.toColumn}`
        : undefined;
    edges.push({
      id: rel.id,
      type: "relationships",
      source: rel.from,
      target: rel.to,
      sourceHandle,
      targetHandle,
      sourceColumn: rel.fromColumn,
      targetColumn: rel.toColumn,
      label:
        columnLabel && rel.isDisabled ? `${columnLabel} (disabled)` : columnLabel,
      isDisabled: rel.isDisabled,
    });
  });

  (schema.triggers || []).forEach((trigger) => {
    const affectedTableIds = new Set(trigger.affectedTables || []);

    // Reads flow table -> trigger (data-flow convention shared with
    // procedure/function reads); writes flow trigger -> table.
    (trigger.referencedTables || []).forEach((tableId) => {
      if (tableId === trigger.tableId) return;
      // A write edge to the same table already implies the read dependency.
      if (affectedTableIds.has(tableId)) return;
      edges.push({
        id: `trigger-ref-edge-${trigger.id}-${tableId}`,
        type: "triggerReads",
        source: tableId,
        target: trigger.id,
        sourceHandle: `${buildNodeHandleBase(tableId)}-source`,
        targetHandle: `${buildNodeHandleBase(trigger.id)}-target`,
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
        sourceHandle: `${buildNodeHandleBase(trigger.id)}-source`,
        targetHandle: `${buildNodeHandleBase(tableId)}-target`,
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
        sourceHandle: `${buildNodeHandleBase(tableId)}-source`,
        targetHandle: `${buildNodeHandleBase(procedure.id)}-target`,
        label: procedure.name,
      });
    });

    (procedure.affectedTables || []).forEach((tableId) => {
      edges.push({
        id: `proc-affects-${procedure.id}-${tableId}`,
        type: "procedureWrites",
        source: procedure.id,
        target: tableId,
        sourceHandle: `${buildNodeHandleBase(procedure.id)}-source`,
        targetHandle: `${buildNodeHandleBase(tableId)}-target`,
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
        sourceHandle: `${buildNodeHandleBase(tableId)}-source`,
        targetHandle: `${buildNodeHandleBase(fn.id)}-target`,
        label: fn.name,
      });
    });
  });

  // Code-to-code call edges: caller -> callee.
  const seenCalls = new Set<string>();
  (schema.codeDependencies || []).forEach((dep) => {
    if (!dep.from || !dep.to || dep.from === dep.to) return;
    const key = `${dep.from}=>${dep.to}`;
    if (seenCalls.has(key)) return;
    seenCalls.add(key);
    edges.push({
      id: `call-edge-${dep.from}-${dep.to}`,
      type: "codeCalls",
      source: dep.from,
      target: dep.to,
      sourceHandle: `${buildNodeHandleBase(dep.from)}-source`,
      targetHandle: `${buildNodeHandleBase(dep.to)}-target`,
    });
  });

  (schema.views || []).forEach((view) => {
    const sources = viewColumnSources.get(view.id) ?? [];
    const representedSourceIds = new Set<string>();

    sources.forEach((source) => {
      representedSourceIds.add(source.sourceTableId);
      edges.push({
        id: `view-col-edge-${view.id}-${source.columnName}-${source.sourceTableId}-${source.sourceColumn}`,
        type: "viewDependencies",
        source: source.sourceTableId,
        target: view.id,
        sourceHandle: `${buildColumnHandleBase(
          source.sourceTableId,
          source.sourceColumn
        )}-source`,
        targetHandle: `${buildColumnHandleBase(
          view.id,
          source.columnName
        )}-target`,
        label: view.name,
        sourceColumn: source.sourceColumn,
        targetColumn: source.columnName,
      });
    });

    (view.referencedTables || []).forEach((sourceId) => {
      if (!sourceId || sourceId === view.id) return;
      if (!tableLikeIds.has(sourceId)) return;
      if (representedSourceIds.has(sourceId)) return;

      representedSourceIds.add(sourceId);
      edges.push({
        id: `view-ref-edge-${view.id}-${sourceId}`,
        type: "viewDependencies",
        source: sourceId,
        target: view.id,
        sourceHandle: `${buildNodeHandleBase(sourceId)}-source`,
        targetHandle: `${buildNodeHandleBase(view.id)}-target`,
        label: view.name,
      });
    });
  });

  return edges;
}

function SchemaGraphInner({
  schema,
  focusedTableId,
  searchFilter,
  schemaFilter,
  objectTypeFilter,
  excludedObjectIds,
  edgeTypeFilter,
  canvasMode,
  importDialogOpen,
  onImportDialogOpenChange,
}: SchemaGraphProps) {
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [hoverCard, setHoverCard] = useState<EdgeHoverCardState | null>(null);
  const [editDialogState, setEditDialogState] = useState<{
    type: string;
    id: string;
  } | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{
    screen: { x: number; y: number };
    flow: { x: number; y: number };
  } | null>(null);
  const [contextMenuEdge, setContextMenuEdge] = useState<EdgeEditState | null>(
    null
  );
  const [pendingConnection, setPendingConnection] = useState<{
    sourceId: string;
    targetId: string;
    sourceColumn?: string;
    targetColumn?: string;
    edgeType?: EdgeType;
    editEdge?: {
      id: string;
      edgeType: EdgeType;
      sourceId: string;
      targetId: string;
      sourceColumn?: string;
      targetColumn?: string;
    };
  } | null>(null);
  const {
    open: detailOpen,
    data: detailData,
    openDetail,
    closeDetail,
  } = useDetailView();
  const {
    selectedEdgeIds,
    toggleEdgeSelection,
    clearEdgeSelection,
    sidebarOpen,
    setSidebarOpen,
    toggleSidebar,
    viewMode,
    focusRoots,
    expandedNodeIds,
    expandNodeNeighbors,
    showFullGraph,
    focusExpandThreshold,
    edgeLabelMode,
    showMiniMap,
    detailViewMode,
    nodePositions: storedNodePositions,
    updateNodePosition,
    removeTable,
    removeView,
    removeTrigger,
    removeStoredProcedure,
    removeScalarFunction,
    removeRelationship,
    removeTriggerReference,
    removeProcedureReference,
    removeFunctionReference,
    removeViewColumnSource,
  } = useSchemaStore(
    useShallow((state) => ({
      selectedEdgeIds: state.selectedEdgeIds,
      toggleEdgeSelection: state.toggleEdgeSelection,
      clearEdgeSelection: state.clearEdgeSelection,
      sidebarOpen: state.sidebarOpen,
      setSidebarOpen: state.setSidebarOpen,
      toggleSidebar: state.toggleSidebar,
      viewMode: state.viewMode,
      focusRoots: state.focusRoots,
      expandedNodeIds: state.expandedNodeIds,
      expandNodeNeighbors: state.expandNodeNeighbors,
      showFullGraph: state.showFullGraph,
      focusExpandThreshold: state.focusExpandThreshold,
      edgeLabelMode: state.edgeLabelMode,
      showMiniMap: state.showMiniMap,
      detailViewMode: state.detailViewMode,
      nodePositions: state.nodePositions,
      updateNodePosition: state.updateNodePosition,
      removeTable: state.removeTable,
      removeView: state.removeView,
      removeTrigger: state.removeTrigger,
      removeStoredProcedure: state.removeStoredProcedure,
      removeScalarFunction: state.removeScalarFunction,
      removeRelationship: state.removeRelationship,
      removeTriggerReference: state.removeTriggerReference,
      removeProcedureReference: state.removeProcedureReference,
      removeFunctionReference: state.removeFunctionReference,
      removeViewColumnSource: state.removeViewColumnSource,
    }))
  );

  // React Flow hook for programmatic viewport control
  const { fitView, setViewport, getViewport, zoomIn, zoomOut } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();

  // Export hooks
  const { exportPng, exportPdf, exportJson } = useExport();

  // Menu event handlers
  const handleToggleSidebar = useCallback(() => {
    toggleSidebar();
  }, [toggleSidebar]);

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.2, duration: 300 });
  }, [fitView]);

  const handleActualSize = useCallback(() => {
    const viewport = getViewport();
    setViewport({ x: viewport.x, y: viewport.y, zoom: 1 }, { duration: 300 });
  }, [getViewport, setViewport]);

  const handleZoomIn = useCallback(() => {
    zoomIn({ duration: 300 });
  }, [zoomIn]);

  const handleZoomOut = useCallback(() => {
    zoomOut({ duration: 300 });
  }, [zoomOut]);

  const handleExportPng = useCallback(() => {
    exportPng();
  }, [exportPng]);

  const handleExportPdf = useCallback(() => {
    exportPdf(true);
  }, [exportPdf]);

  const handleExportJson = useCallback(() => {
    exportJson();
  }, [exportJson]);

  // Subscribe to menu events
  useTauriEvent(menuToggleSidebarHub.subscribe, handleToggleSidebar);
  useTauriEvent(menuFitViewHub.subscribe, handleFitView);
  useTauriEvent(menuActualSizeHub.subscribe, handleActualSize);
  useTauriEvent(menuZoomInHub.subscribe, handleZoomIn);
  useTauriEvent(menuZoomOutHub.subscribe, handleZoomOut);
  useTauriEvent(menuExportPngHub.subscribe, handleExportPng);
  useTauriEvent(menuExportPdfHub.subscribe, handleExportPdf);
  useTauriEvent(menuExportJsonHub.subscribe, handleExportJson);

  // Store original positions for restoration when focus is cleared
  const originalPositionsRef = useRef<Map<string, { x: number; y: number }>>(
    new Map()
  );
  // Once the user drags a node in focus mode, stop reapplying the compact layout
  const focusLayoutLockedRef = useRef(false);
  // Track previous focus state to detect exit transitions
  const prevFocusStateRef = useRef<FocusSnapshot>({
    focusedTableId: null,
  });
  // Track if fitView has been called for current focus session
  const fitViewCalledRef = useRef(false);
  const pendingEdgeFlushRef = useRef(false);
  const lastFlushSignatureRef = useRef("");
  const zoomRef = useRef(0.8);
  const edgesRef = useRef<Edge[]>([]);
  const handleEdgeTypesRef = useRef<Map<string, Set<EdgeType>>>(new Map());
  const edgeDerivationRef = useRef<EdgeStateResult | null>(null);

  const [zoomBand, setZoomBand] = useState<ZoomBand>(() => getZoomBand(0.8));
  const [autoShowEdgeLabels, setAutoShowEdgeLabels] = useState(() =>
    shouldShowEdgeLabelsAtZoom(0.8)
  );
  const [isEdgeFlushInProgress, setIsEdgeFlushInProgress] = useState(false);
  const showEdgeLabels =
    edgeLabelMode === "always"
      ? true
      : edgeLabelMode === "never"
        ? false
        : autoShowEdgeLabels;

  useEffect(() => {
    if (edgeLabelMode !== "auto") {
      return;
    }
    setAutoShowEdgeLabels(shouldShowEdgeLabelsAtZoom(zoomRef.current));
  }, [edgeLabelMode]);

  const onEdgeClick: EdgeMouseHandler = useCallback(
    (_event, edge) => {
      if (focusedTableId && !canvasMode) return;
      toggleEdgeSelection(edge.id);
    },
    [toggleEdgeSelection, focusedTableId, canvasMode]
  );

  const onPaneClick = useCallback(() => {
    if (selectedEdgeIds.size > 0) {
      clearEdgeSelection();
    }
    setHoveredEdgeId(null);
    setHoverCard(null);
    setContextMenuEdge(null);
    setContextMenuPos(null);
  }, [selectedEdgeIds.size, clearEdgeSelection]);

  const onEdgeMouseEnter: EdgeMouseHandler = useCallback((event, edge) => {
    setHoveredEdgeId(edge.id);
    setHoverCard({
      edgeId: edge.id,
      ...buildEdgeHoverCardContent(edge),
      x: event.clientX,
      y: event.clientY,
    });
  }, []);

  const onEdgeMouseMove: EdgeMouseHandler = useCallback((event, edge) => {
    setHoveredEdgeId((prev) => (prev === edge.id ? prev : edge.id));
    setHoverCard({
      edgeId: edge.id,
      ...buildEdgeHoverCardContent(edge),
      x: event.clientX,
      y: event.clientY,
    });
  }, []);

  const onEdgeMouseLeave = useCallback(() => {
    setHoveredEdgeId(null);
    setHoverCard(null);
  }, []);

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      if (!canvasMode) return;
      const edgeData = edge.data as
        | {
            edgeType?: EdgeType;
            sourceColumn?: string;
            targetColumn?: string;
          }
        | undefined;
      if (!edgeData?.edgeType) return;
      event.preventDefault();
      event.stopPropagation();
      setContextMenuEdge({
        id: edge.id,
        edgeType: edgeData.edgeType,
        sourceId: edge.source,
        targetId: edge.target,
        sourceColumn: edgeData.sourceColumn,
        targetColumn: edgeData.targetColumn,
      });
      setContextMenuPos({
        screen: { x: event.clientX, y: event.clientY },
        flow: { x: 0, y: 0 },
      });
    },
    [canvasMode]
  );

  const onMove = useCallback((_event: unknown, viewport: { zoom: number }) => {
    zoomRef.current = viewport.zoom;
    const nextZoomBand = getZoomBand(viewport.zoom);
    setZoomBand((prev) => (prev === nextZoomBand ? prev : nextZoomBand));

    if (edgeLabelMode === "auto") {
      const nextShowLabels = shouldShowEdgeLabelsAtZoom(viewport.zoom);
      setAutoShowEdgeLabels((prev) =>
        prev === nextShowLabels ? prev : nextShowLabels
      );
    }
  }, [edgeLabelMode]);

  const removeEdgeDescriptor = useCallback(
    (descriptor: EdgeEditState) => {
      switch (descriptor.edgeType) {
        case "relationships":
          removeRelationship(descriptor.id);
          break;
        case "procedureReads":
          removeProcedureReference(
            descriptor.targetId,
            descriptor.sourceId,
            "reads"
          );
          break;
        case "procedureWrites":
          removeProcedureReference(
            descriptor.sourceId,
            descriptor.targetId,
            "writes"
          );
          break;
        case "functionReads":
          removeFunctionReference(descriptor.targetId, descriptor.sourceId);
          break;
        case "triggerWrites":
          removeTriggerReference(
            descriptor.sourceId,
            descriptor.targetId,
            "writes"
          );
          break;
        case "triggerReads":
          // Reads flow table -> trigger, so the trigger is the target.
          removeTriggerReference(
            descriptor.targetId,
            descriptor.sourceId,
            "reads"
          );
          break;
        case "viewDependencies":
          if (
            descriptor.targetColumn &&
            descriptor.sourceColumn
          ) {
            removeViewColumnSource(
              descriptor.targetId,
              descriptor.targetColumn,
              descriptor.sourceId,
              descriptor.sourceColumn
            );
          }
          break;
      }
    },
    [
      removeFunctionReference,
      removeProcedureReference,
      removeRelationship,
      removeTriggerReference,
      removeViewColumnSource,
    ]
  );

  const handleNodeClick = useCallback(
    (data: DetailSidebarData) => {
      openDetail(data);
    },
    [openDetail]
  );

  const handleTableClick = useCallback(
    (table: TableNodeType, _event: React.MouseEvent) => {
      handleNodeClick({ type: "table", data: table });
    },
    [handleNodeClick]
  );

  const handleViewClick = useCallback(
    (view: ViewNodeType, _event: React.MouseEvent) => {
      handleNodeClick({ type: "view", data: view });
    },
    [handleNodeClick]
  );

  const handleTriggerClick = useCallback(
    (trigger: Trigger, _event: React.MouseEvent) => {
      handleNodeClick({ type: "trigger", data: trigger });
    },
    [handleNodeClick]
  );

  const handleProcedureClick = useCallback(
    (procedure: StoredProcedure, _event: React.MouseEvent) => {
      handleNodeClick({ type: "storedProcedure", data: procedure });
    },
    [handleNodeClick]
  );

  const handleFunctionClick = useCallback(
    (fn: ScalarFunction, _event: React.MouseEvent) => {
      handleNodeClick({ type: "scalarFunction", data: fn });
    },
    [handleNodeClick]
  );

  const handleSidebarItemClick = useCallback(
    (data: DetailSidebarData) => {
      openDetail(data);
    },
    [openDetail]
  );

  const handleEditFromPopover = useCallback(
    (data: DetailSidebarData) => {
      if (!canvasMode) return;
      setEditDialogState({ type: data.type, id: data.data.id });
    },
    [canvasMode]
  );

  // Canvas mode: drag-to-connect edges (opens dialog)
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!canvasMode) return;
      const { tableId: sourceId, columnName: sourceColumn } = parseHandleId(
        connection.sourceHandle
      );
      const { tableId: targetId, columnName: targetColumn } = parseHandleId(
        connection.targetHandle
      );
      if (!sourceId || !targetId) return;
      const allowedEdgeTypes = getAllowedEdgeKinds(schema, sourceId, targetId);
      if (allowedEdgeTypes.length === 0) return;

      setPendingConnection({
        sourceId,
        targetId,
        sourceColumn,
        targetColumn,
        edgeType: allowedEdgeTypes.length === 1 ? allowedEdgeTypes[0] : undefined,
      });
    },
    [canvasMode, schema]
  );

  const isValidConnection = useCallback(
    (connection: Connection | Edge) => {
      if (!canvasMode) return false;
      const { tableId: sourceId } = parseHandleId(
        connection.sourceHandle ?? null
      );
      const { tableId: targetId } = parseHandleId(
        connection.targetHandle ?? null
      );
      if (!sourceId || !targetId) return false;
      return getAllowedEdgeKinds(schema, sourceId, targetId).length > 0;
    },
    [canvasMode, schema]
  );

  // Persist node positions on drag stop
  const onNodeDragStop: OnNodeDrag = useCallback(
    (_event, node) => {
      if (canvasMode) {
        updateNodePosition(node.id, node.position);
        return;
      }
      if (focusedTableId) {
        focusLayoutLockedRef.current = true;
      }
    },
    [canvasMode, updateNodePosition, focusedTableId]
  );

  // Canvas mode: double-click to edit node
  const onNodeDoubleClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (!canvasMode) return;
      const typeMap: Record<string, string> = {
        tableNode: "table",
        viewNode: "view",
        triggerNode: "trigger",
        storedProcedureNode: "storedProcedure",
        scalarFunctionNode: "scalarFunction",
      };
      const type = typeMap[node.type ?? ""];
      if (type) {
        setEditDialogState({ type, id: node.id });
      }
    },
    [canvasMode]
  );

  // Canvas mode: delete selected nodes
  const handleDeleteSelected = useCallback(
    (selectedNodes: Node[]) => {
      if (!canvasMode) return;
      for (const node of selectedNodes) {
        switch (node.type) {
          case "tableNode":
            removeTable(node.id);
            break;
          case "viewNode":
            removeView(node.id);
            break;
          case "triggerNode":
            removeTrigger(node.id);
            break;
          case "storedProcedureNode":
            removeStoredProcedure(node.id);
            break;
          case "scalarFunctionNode":
            removeScalarFunction(node.id);
            break;
        }
      }
    },
    [
      canvasMode,
      removeTable,
      removeView,
      removeTrigger,
      removeStoredProcedure,
      removeScalarFunction,
    ]
  );

  // Canvas mode: context menu
  const { screenToFlowPosition } = useReactFlow();

  const handleContextMenu = useCallback(
    (event: React.MouseEvent) => {
      if (!canvasMode) return;
      event.preventDefault();
      setContextMenuEdge(null);
      const flowPos = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      setContextMenuPos({
        screen: { x: event.clientX, y: event.clientY },
        flow: flowPos,
      });
    },
    [canvasMode, screenToFlowPosition]
  );

  const options: ConvertOptions = useMemo(
    () => ({
      onTableClick: (table: TableNodeType, event: React.MouseEvent) =>
        handleTableClick(table, event),
      onViewClick: (view: ViewNodeType, event: React.MouseEvent) =>
        handleViewClick(view, event),
      onTriggerClick: (trigger: Trigger, event: React.MouseEvent) =>
        handleTriggerClick(trigger, event),
      onProcedureClick: (procedure: StoredProcedure, event: React.MouseEvent) =>
        handleProcedureClick(procedure, event),
      onFunctionClick: (fn: ScalarFunction, event: React.MouseEvent) =>
        handleFunctionClick(fn, event),
      onExpandNeighbors: (nodeId: string) => expandNodeNeighbors(nodeId),
    }),
    [
      handleTableClick,
      handleViewClick,
      handleTriggerClick,
      handleProcedureClick,
      handleFunctionClick,
      expandNodeNeighbors,
    ]
  );

  const schemaIndex = useMemo(() => getSchemaIndex(schema), [schema]);
  const browseVisibleIds = useMemo(
    () =>
      canvasMode
        ? null
        : computeBrowseVisibleIds(
            viewMode,
            focusRoots,
            expandedNodeIds,
            schemaIndex
          ),
    [canvasMode, viewMode, focusRoots, expandedNodeIds, schemaIndex]
  );
  const objectTextColorById = useMemo(() => {
    const colors = new Map<string, string>();
    schema.tables.forEach((table) => {
      colors.set(table.id, OBJECT_COLORS.tables);
    });
    (schema.views || []).forEach((view) => {
      colors.set(view.id, OBJECT_COLORS.views);
    });
    (schema.triggers || []).forEach((trigger) => {
      colors.set(trigger.id, OBJECT_COLORS.triggers);
    });
    (schema.storedProcedures || []).forEach((procedure) => {
      colors.set(procedure.id, OBJECT_COLORS.storedProcedures);
    });
    (schema.scalarFunctions || []).forEach((fn) => {
      colors.set(fn.id, OBJECT_COLORS.scalarFunctions);
    });
    return colors;
  }, [schema]);
  const mainDependencyEdges = useMemo(
    () => buildMainDirectedEdges(schema, schemaIndex.viewColumnSources),
    [schema, schemaIndex.viewColumnSources]
  );
  const columnsByNodeId = useMemo(() => {
    const map = new Map<string, Set<string>>();
    schema.tables.forEach((table) => {
      map.set(table.id, new Set(table.columns.map((column) => column.name)));
    });
    (schema.views || []).forEach((view) => {
      map.set(view.id, new Set(view.columns.map((column) => column.name)));
    });
    return map;
  }, [schema]);
  const nodeHeights = useMemo(() => buildNodeHeightMap(schema), [schema]);
  const nodeWidths = useMemo(() => buildNodeWidthMap(schema), [schema]);
  const baseNodes = useMemo(() => {
    const nodes = buildBaseNodes(
      schema,
      options,
      schemaIndex.columnsWithHandles,
      schemaIndex.fkColumnUsage,
      schemaIndex.fkColumnLinks,
      nodeHeights,
      nodeWidths,
      mainDependencyEdges,
      browseVisibleIds,
      schemaIndex.neighbors
    );
    // Canvas mode flags node data; stored positions are applied in the patch
    // effect so a drag does not re-run the full layout.
    if (canvasMode) {
      return nodes.map((node) => ({
        ...node,
        data: {
          ...(node.data as Record<string, unknown>),
          canvasMode: true,
        },
      }));
    }
    return nodes;
  }, [
    schema,
    options,
    schemaIndex.viewColumnSources,
    schemaIndex.columnsWithHandles,
    schemaIndex.fkColumnUsage,
    schemaIndex.fkColumnLinks,
    nodeHeights,
    nodeWidths,
    mainDependencyEdges,
    browseVisibleIds,
    canvasMode,
  ]);
  const baseEdges = useMemo(
    () => buildBaseEdges(schema, schemaIndex.viewColumnSources),
    [schema, schemaIndex.viewColumnSources]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(baseNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  // Canvas mode: delete selected edges
  const handleDeleteSelectedEdges = useCallback(() => {
    if (!canvasMode) return;
    const edgeMap = new Map(edges.map((edge) => [edge.id, edge]));
    selectedEdgeIds.forEach((edgeId) => {
      const edge = edgeMap.get(edgeId);
      if (!edge) return;
      const edgeData = edge.data as
        | {
            edgeType?: EdgeType;
            sourceColumn?: string;
            targetColumn?: string;
          }
        | undefined;
      if (!edgeData?.edgeType) return;

      const descriptor: EdgeEditState = {
        id: edge.id,
        edgeType: edgeData.edgeType,
        sourceId: edge.source,
        targetId: edge.target,
        sourceColumn: edgeData.sourceColumn,
        targetColumn: edgeData.targetColumn,
      };
      removeEdgeDescriptor(descriptor);
    });
    clearEdgeSelection();
  }, [
    canvasMode,
    selectedEdgeIds,
    edges,
    removeEdgeDescriptor,
    clearEdgeSelection,
  ]);

  const handleDeleteSelectionMenu = useCallback(() => {
    if (!canvasMode) return;
    if (selectedEdgeIds.size > 0) {
      handleDeleteSelectedEdges();
      return;
    }
    const selectedNodes = nodes.filter((node) => node.selected);
    if (selectedNodes.length > 0) {
      handleDeleteSelected(selectedNodes);
    }
  }, [
    canvasMode,
    selectedEdgeIds,
    handleDeleteSelectedEdges,
    nodes,
    handleDeleteSelected,
  ]);

  useTauriEvent(menuDeleteSelectionHub.subscribe, handleDeleteSelectionMenu);

  // Canvas mode: keyboard handler for Delete/Backspace
  // Latest delete behavior lives in a ref so the window listener registers
  // once per mode instead of re-registering on every node or selection change.
  const deleteKeyActionRef = useRef<() => void>(() => {});
  deleteKeyActionRef.current = () => {
    if (selectedEdgeIds.size > 0) {
      handleDeleteSelectedEdges();
      return;
    }
    const selectedNodes = nodes.filter((n) => n.selected);
    if (selectedNodes.length > 0) {
      handleDeleteSelected(selectedNodes);
    }
  };

  useEffect(() => {
    if (!canvasMode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        if (
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLTextAreaElement
        ) {
          return;
        }
        deleteKeyActionRef.current();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [canvasMode]);

  useEffect(() => {
    setNodes(baseNodes);
  }, [baseNodes, setNodes]);

  useEffect(() => {
    if (baseNodes.length === 0) {
      return;
    }
    // Preserve the user's zoom/pan while editing node positions in canvas mode.
    if (canvasMode) {
      return;
    }

    const frameId = requestAnimationFrame(() => {
      fitView({ padding: 0.2, duration: 300 });
    });

    return () => cancelAnimationFrame(frameId);
  }, [baseNodes, canvasMode, fitView]);

  // Store original positions when baseNodes change
  useEffect(() => {
    const positions = new Map<string, { x: number; y: number }>();
    baseNodes.forEach((node) => positions.set(node.id, { ...node.position }));
    originalPositionsRef.current = positions;
  }, [baseNodes]);

  // Visibility: which objects survive the search/schema/type/exclusion
  // filters. Shares getFilteredObjectBuckets with useFilteredCounts so the
  // graph, sidebar, and status bar agree by construction. Focus dimming is
  // layered on separately (focusedTableId: null here keeps non-neighbors).
  const visibility = useMemo(
    () =>
      getFilteredObjectBuckets({
        schema,
        searchFilter: searchFilter ?? "",
        schemaFilter: schemaFilter ?? "",
        objectTypeFilter: objectTypeFilter ?? ALL_OBJECT_TYPES_FALLBACK,
        excludedObjectIds: excludedObjectIds ?? EMPTY_ID_SET,
        focusedTableId: null,
        schemaIndex,
      }),
    [
      schema,
      schemaIndex,
      searchFilter,
      schemaFilter,
      objectTypeFilter,
      excludedObjectIds,
    ]
  );

  // Browse mode: the graph only shows roots, their neighbors, and expansions.
  const effectiveVisibility = useMemo(() => {
    if (!browseVisibleIds) return visibility;
    const inBrowse = <T extends { id: string }>(objects: T[]) =>
      objects.filter((object) => browseVisibleIds.has(object.id));
    const tables = inBrowse(visibility.tables);
    const views = inBrowse(visibility.views);
    const triggers = inBrowse(visibility.triggers);
    const storedProcedures = inBrowse(visibility.storedProcedures);
    const scalarFunctions = inBrowse(visibility.scalarFunctions);
    return {
      tables,
      views,
      triggers,
      storedProcedures,
      scalarFunctions,
      tableIds: new Set(tables.map((table) => table.id)),
      viewIds: new Set(views.map((view) => view.id)),
      visibleNodeIds: new Set(
        [
          ...tables,
          ...views,
          ...triggers,
          ...storedProcedures,
          ...scalarFunctions,
        ].map((object) => object.id)
      ),
    };
  }, [visibility, browseVisibleIds]);

  const focusState = useMemo(
    () =>
      computeFocusState(effectiveVisibility, focusedTableId ?? null, schemaIndex),
    [effectiveVisibility, focusedTableId, schemaIndex]
  );

  // Edge derivation is cheap (O(edges)) and re-runs on hover/selection, but
  // handleEdgeTypes keeps its previous reference when equivalent so the node
  // patch effect below does not re-run on hover.
  const edgeDerivation = useMemo(() => {
    const result = deriveEdgeState({
      edges: baseEdges,
      edgeTypeFilter,
      renderableNodeIds: focusState.renderableNodeIds,
      columnsByNodeId,
      focusedTableId: focusedTableId ?? null,
      selectedEdgeIds,
      hoveredEdgeId,
      showLabels: showEdgeLabels,
      showInlineLabelOnHover: false,
      previousHandleEdgeTypes: handleEdgeTypesRef.current,
    });
    handleEdgeTypesRef.current = result.handleEdgeTypes;
    return result;
  }, [
    baseEdges,
    edgeTypeFilter,
    focusState,
    columnsByNodeId,
    focusedTableId,
    selectedEdgeIds,
    hoveredEdgeId,
    showEdgeLabels,
  ]);
  edgeDerivationRef.current = edgeDerivation;

  // Structure/focus orchestration: node visibility patching, focus
  // transitions, compact layout, and the edge flush choreography. Hover and
  // selection changes deliberately do not re-run this effect.
  useEffect(() => {
    const {
      focusedNeighbors,
      dimmedNodeIds,
      renderableNodeIds,
      visibleNonDimmedCount,
    } = focusState;
    const visibleNodeIds = effectiveVisibility.visibleNodeIds;
    const isNeighbor = (nodeId: string) => focusedNeighbors.has(nodeId);
    const moderateThreshold = Math.ceil(focusExpandThreshold * 1.67);
    const handleEdgeTypes = edgeDerivation.handleEdgeTypes;

    const prevState = prevFocusStateRef.current;
    const nextFocusState: FocusSnapshot = {
      focusedTableId: focusedTableId ?? null,
    };
    const focusTransition = getFocusTransition(prevState, nextFocusState);
    const focusSessionActive = isFocusSessionActive(nextFocusState.focusedTableId);
    const prevFocusSessionActive = isFocusSessionActive(prevState.focusedTableId);
    const focusTargetChanged = focusTransition === "target-change";

    if ((focusSessionActive && !prevFocusSessionActive) || focusTargetChanged) {
      focusLayoutLockedRef.current = false;
    }

    const flushSignature = `${focusTransition}:${prevState.focusedTableId ?? ""}->${nextFocusState.focusedTableId ?? ""}`;
    const transitionNeedsFlush = shouldForceEdgeFlush(focusTransition);
    const shouldStartEdgeFlush =
      transitionNeedsFlush &&
      !pendingEdgeFlushRef.current &&
      lastFlushSignatureRef.current !== flushSignature;

    if (shouldStartEdgeFlush) {
      pendingEdgeFlushRef.current = true;
      lastFlushSignatureRef.current = flushSignature;
      setIsEdgeFlushInProgress(true);
      edgesRef.current = [];
      setEdges([]);
    } else if (!pendingEdgeFlushRef.current && !transitionNeedsFlush) {
      lastFlushSignatureRef.current = "";
      setIsEdgeFlushInProgress(false);
    }

    // Detect if we JUST exited focus mode (restore positions once, not continuously)
    const justExitedFocus = focusTransition === "exit";

    // Calculate compact positions when focus mode is "hide" and focused
    const shouldUseCompactLayout =
      focusSessionActive && !focusLayoutLockedRef.current;
    const compactPositions =
      shouldUseCompactLayout && focusedTableId
        ? calculateCompactLayout(
            focusedTableId,
            renderableNodeIds,
            focusedNeighbors,
            schema,
            nodeHeights,
            nodeWidths,
            mainDependencyEdges
          )
        : null;

    const internalsRefreshIds = new Set<string>();
    setNodes((currentNodes) => {
      let changed = false;
      const nextNodes = currentNodes.map((node) => {
        const isVisible = visibleNodeIds.has(node.id);
        const isTableOrView = node.type === "tableNode" || node.type === "viewNode";
        const isFocused = isTableOrView && node.id === focusedTableId;
        const isDimmed = dimmedNodeIds.has(node.id);

        const widthFallback =
          node.type === "triggerNode"
            ? TRIGGER_MIN_WIDTH
            : node.type === "storedProcedureNode" ||
                node.type === "scalarFunctionNode"
              ? ROUTINE_MIN_WIDTH
              : TABLE_VIEW_MIN_WIDTH;
        const nodeWidth = getNodeWidth(nodeWidths, node.id, widthFallback);

        let nodeIsCompact: boolean | undefined;
        if (isTableOrView) {
          // Per-node compact calculation.
          nodeIsCompact = isCompactForZoomBand(zoomBand);

          if (zoomBand === "forceCompact") {
            nodeIsCompact = true;
          } else if (focusedTableId) {
            if (node.id === focusedTableId) {
              // Focused node is always expanded (unless below FORCE_COMPACT_ZOOM).
              nodeIsCompact = false;
            } else if (isNeighbor(node.id)) {
              // Neighbors a neighbor: expand based on count thresholds.
              if (visibleNonDimmedCount <= focusExpandThreshold) {
                nodeIsCompact = false;
              } else if (visibleNonDimmedCount <= moderateThreshold) {
                nodeIsCompact =
                  isFocusModerateCompactForZoomBand(zoomBand);
              }
            }
          }
        }

        // Hide node if not visible by filters, or dimmed in hide-only focus mode.
        const shouldHide = !isVisible || isDimmed;

        // Apply compact position when in focus mode, or restore original when exiting
        let position = node.position; // Keep current position by default (preserves user drag)
        if (canvasMode) {
          position = storedNodePositions[node.id] ?? node.position;
        } else if (shouldUseCompactLayout && compactPositions?.has(node.id)) {
          position = compactPositions.get(node.id)!;
        } else if (
          justExitedFocus &&
          !focusLayoutLockedRef.current &&
          originalPositionsRef.current.has(node.id)
        ) {
          // Only restore original position when JUST exiting focus mode
          position = originalPositionsRef.current.get(node.id)!;
        }

        const nodeUpdate = applyNodeRenderPatch(node, {
          position,
          hidden: shouldHide,
          isFocused,
          isDimmed,
          nodeWidth,
          isCompact: nodeIsCompact,
          columnsWithHandles: isTableOrView
            ? schemaIndex.columnsWithHandles
            : undefined,
          handleEdgeTypes: isTableOrView ? handleEdgeTypes : undefined,
          includeTableViewFields: isTableOrView,
        });

        if (!nodeUpdate.changed) {
          return node;
        }

        changed = true;
        if (nodeUpdate.geometryChanged) {
          internalsRefreshIds.add(node.id);
        }
        return nodeUpdate.node;
      });
      return changed ? nextNodes : currentNodes;
    });
    if (shouldStartEdgeFlush) {
      requestAnimationFrame(() => {
        internalsRefreshIds.forEach((nodeId) => updateNodeInternals(nodeId));
        requestAnimationFrame(() => {
          const nextEdges = edgeDerivationRef.current?.edges ?? [];
          edgesRef.current = nextEdges;
          setEdges(nextEdges);
          pendingEdgeFlushRef.current = false;
          lastFlushSignatureRef.current = "";
          setIsEdgeFlushInProgress(false);
        });
      });
    } else if (internalsRefreshIds.size > 0) {
      requestAnimationFrame(() => {
        internalsRefreshIds.forEach((nodeId) => updateNodeInternals(nodeId));
        if (!pendingEdgeFlushRef.current) {
          // Re-apply visible edges after handle geometry updates to avoid stale paths.
          const nextEdges = edgeDerivationRef.current?.edges ?? [];
          edgesRef.current = nextEdges;
          setEdges([...nextEdges]);
        }
      });
    }

    // Call fitView when entering focus mode
    if (shouldUseCompactLayout && !fitViewCalledRef.current) {
      fitViewCalledRef.current = true;
      setTimeout(() => {
        fitView({ padding: 0.2, maxZoom: 1.5, duration: 300 });
      }, 50);
    } else if (!focusedTableId) {
      fitViewCalledRef.current = false;
    }

    // Update ref for next comparison
    prevFocusStateRef.current = nextFocusState;
    if (justExitedFocus) {
      focusLayoutLockedRef.current = false;
    }
  }, [
    effectiveVisibility,
    focusState,
    focusedTableId,
    focusExpandThreshold,
    zoomBand,
    schema,
    schemaIndex,
    nodeHeights,
    nodeWidths,
    mainDependencyEdges,
    edgeDerivation.handleEdgeTypes,
    canvasMode,
    storedNodePositions,
    setEdges,
    setNodes,
    fitView,
    updateNodeInternals,
  ]);

  // Hover/selection hygiene: drop hover and selection state for edges that
  // are no longer visible.
  useEffect(() => {
    const { visibleEdgeIds } = edgeDerivation;
    if (hoveredEdgeId && !visibleEdgeIds.has(hoveredEdgeId)) {
      setHoveredEdgeId(null);
      setHoverCard(null);
    }
    if (
      selectedEdgeIds.size > 0 &&
      [...selectedEdgeIds].some((id) => !visibleEdgeIds.has(id))
    ) {
      clearEdgeSelection();
    }
  }, [edgeDerivation, hoveredEdgeId, selectedEdgeIds, clearEdgeSelection]);

  // Steady-state edge sync: the intended per-hover cost is this equivalence
  // check plus at most one edge-array commit. During a focus flush the RAF
  // choreography above owns the edge writes instead.
  useEffect(() => {
    if (pendingEdgeFlushRef.current) return;
    if (!areEdgesEquivalent(edgesRef.current, edgeDerivation.edges)) {
      edgesRef.current = edgeDerivation.edges;
      setEdges(edgeDerivation.edges);
    }
  }, [edgeDerivation, setEdges]);

  const renderHoverEndpoint = useCallback(
    (endpoint: EdgeHoverEndpoint) => {
      const objectColor =
        objectTextColorById.get(endpoint.objectId) ?? DEFAULT_OBJECT_TEXT_COLOR;
      return (
        <>
          <span className="font-mono" style={{ color: objectColor }}>
            {endpoint.objectId}
          </span>
          {endpoint.column && (
            <span className="font-mono text-muted-foreground">
              .{endpoint.column}
            </span>
          )}
        </>
      );
    },
    [objectTextColorById]
  );

  const reactFlowContent = (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onEdgeClick={onEdgeClick}
      onEdgeContextMenu={canvasMode ? onEdgeContextMenu : undefined}
      onEdgeMouseEnter={onEdgeMouseEnter}
      onEdgeMouseMove={onEdgeMouseMove}
      onEdgeMouseLeave={onEdgeMouseLeave}
      onPaneClick={onPaneClick}
      onMove={onMove}
      onConnect={canvasMode ? onConnect : undefined}
      isValidConnection={canvasMode ? isValidConnection : undefined}
      onNodeDragStop={onNodeDragStop}
      onNodeDoubleClick={canvasMode ? onNodeDoubleClick : undefined}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.02}
      maxZoom={2}
      defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
      proOptions={{ hideAttribution: true }}
      onlyRenderVisibleElements={!isEdgeFlushInProgress}
      nodesConnectable={canvasMode ?? false}
      nodesDraggable={true}
      selectionOnDrag={canvasMode}
    >
      <Background
        className="!bg-background [&>pattern>circle]:!fill-border"
        gap={20}
      />
      <Controls className="!rounded-lg !border !border-[var(--panel-border)] !bg-[var(--panel-bg)] !shadow-[var(--panel-shadow)] !overflow-hidden [&>button]:!bg-transparent [&>button]:!border-0 [&>button]:!border-b [&>button]:!border-[var(--panel-border)] [&>button]:!text-foreground [&>button:hover]:!bg-muted [&>button>svg]:!fill-current" />
      {showMiniMap && (
        <MiniMap
          nodeColor={getMinimapNodeColor}
          maskColor="var(--minimap-mask)"
          className="!rounded-lg !bg-[var(--panel-bg)]"
          pannable
          zoomable
        />
      )}
    </ReactFlow>
  );

  return (
    // One tooltip provider for the whole graph: column rows previously
    // mounted a provider per FK column.
    <TooltipProvider delayDuration={200}>
    <div className="w-full h-full relative flex">
      <SchemaBrowserSidebar onItemClick={handleSidebarItemClick} />
      {detailViewMode === "drawer" ? (
        <DetailDrawer
          open={detailOpen}
          data={detailData}
          onClose={closeDetail}
          onEdit={canvasMode ? handleEditFromPopover : undefined}
        />
      ) : (
        <DetailInspector
          open={detailOpen}
          data={detailData}
          onClose={closeDetail}
          onEdit={canvasMode ? handleEditFromPopover : undefined}
        />
      )}
      {/* The floating sidebar overlays the canvas; no layout push, so the
          React Flow viewport stays stable when it toggles. */}
      <main className="flex-1 h-full">
        <div
          className="relative w-full h-full"
          onContextMenu={canvasMode ? handleContextMenu : undefined}
        >
          <SidebarToggle
            onClick={() => setSidebarOpen(true)}
            visible={!sidebarOpen}
          />
          {reactFlowContent}
          {viewMode === "browse" && !canvasMode && focusRoots.size === 0 && (
            <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
              <div className="panel-glass pointer-events-auto max-w-md space-y-3 px-8 py-6 text-center">
                <h3 className="text-sm font-semibold">Browse mode</h3>
                <p className="text-xs leading-5 text-muted-foreground">
                  This database is large, so nothing is rendered yet. Pick an
                  object in the sidebar (double-click or the crosshair) to
                  explore its relationships, then expand outward from there.
                </p>
                <Button variant="outline" size="sm" onClick={showFullGraph}>
                  Show full graph anyway
                </Button>
              </div>
            </div>
          )}
          {hoverCard && (
            <div
              style={{
                position: "fixed",
                left: hoverCard.x + EDGE_HOVER_CARD_OFFSET_X,
                top: hoverCard.y + EDGE_HOVER_CARD_OFFSET_Y,
                zIndex: 120,
              }}
              className="panel-glass pointer-events-none max-w-[420px] break-words rounded-md px-2.5 py-1.5 text-xs text-popover-foreground"
            >
              {hoverCard.title && (
                <div className="mb-1 font-medium">{hoverCard.title}</div>
              )}
              <div className="space-y-0.5">
                <div>
                  <span className="font-medium">From:</span>{" "}
                  {renderHoverEndpoint(hoverCard.from)}
                </div>
                <div>
                  <span className="font-medium">To:</span>{" "}
                  {renderHoverEndpoint(hoverCard.to)}
                </div>
              </div>
            </div>
          )}
          {canvasMode && contextMenuPos && !contextMenuEdge && (
            <CanvasContextMenu
              screenPosition={contextMenuPos.screen}
              flowPosition={contextMenuPos.flow}
              onClose={() => setContextMenuPos(null)}
              nodes={nodes}
              schema={schema}
              onEdit={(type, id) => setEditDialogState({ type, id })}
              onDelete={(nodeType, id) => {
                switch (nodeType) {
                  case "tableNode":
                    removeTable(id);
                    break;
                  case "viewNode":
                    removeView(id);
                    break;
                  case "triggerNode":
                    removeTrigger(id);
                    break;
                  case "storedProcedureNode":
                    removeStoredProcedure(id);
                    break;
                  case "scalarFunctionNode":
                    removeScalarFunction(id);
                    break;
                }
              }}
            />
          )}
          {canvasMode && contextMenuPos && contextMenuEdge && (
            <div
              style={{
                position: "fixed",
                left: contextMenuPos.screen.x,
                top: contextMenuPos.screen.y,
                zIndex: 100,
              }}
              className="bg-popover border border-border rounded-md shadow-md py-1 min-w-[140px]"
            >
              <button
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted"
                onClick={() => {
                  setPendingConnection({
                    sourceId: contextMenuEdge.sourceId,
                    targetId: contextMenuEdge.targetId,
                    sourceColumn: contextMenuEdge.sourceColumn,
                    targetColumn: contextMenuEdge.targetColumn,
                    edgeType: contextMenuEdge.edgeType,
                    editEdge: contextMenuEdge,
                  });
                  setContextMenuEdge(null);
                  setContextMenuPos(null);
                }}
              >
                Edit
              </button>
              <button
                className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted text-destructive"
                onClick={() => {
                  removeEdgeDescriptor(contextMenuEdge);
                  clearEdgeSelection();
                  setContextMenuEdge(null);
                  setContextMenuPos(null);
                }}
              >
                Delete
              </button>
            </div>
          )}
        </div>
      </main>
      {canvasMode && (
        <>
          <CanvasEditDialogs
            editState={editDialogState}
            onClose={() => setEditDialogState(null)}
          />
          <ImportFromDatabaseDialog
            open={importDialogOpen ?? false}
            onOpenChange={onImportDialogOpenChange ?? (() => {})}
          />
          <CreateEdgeDialog
            open={pendingConnection !== null}
            onOpenChange={(open) => {
              if (!open) setPendingConnection(null);
            }}
            initialFrom={pendingConnection?.sourceId}
            initialTo={pendingConnection?.targetId}
            initialFromColumn={pendingConnection?.sourceColumn}
            initialToColumn={pendingConnection?.targetColumn}
            initialEdgeType={pendingConnection?.edgeType}
            editEdge={pendingConnection?.editEdge ?? null}
          />
        </>
      )}
    </div>
    </TooltipProvider>
  );
}

function CanvasEditDialogs({
  editState,
  onClose,
}: {
  editState: { type: string; id: string } | null;
  onClose: () => void;
}) {
  if (!editState) return null;

  const handleOpenChange = (open: boolean) => {
    if (!open) onClose();
  };

  switch (editState.type) {
    case "table":
      return (
        <CreateTableDialog
          open={true}
          onOpenChange={handleOpenChange}
          editId={editState.id}
        />
      );
    case "view":
      return (
        <CreateViewDialog
          open={true}
          onOpenChange={handleOpenChange}
          editId={editState.id}
        />
      );
    case "trigger":
      return (
        <CreateTriggerDialog
          open={true}
          onOpenChange={handleOpenChange}
          editId={editState.id}
        />
      );
    case "storedProcedure":
      return (
        <CreateProcedureDialog
          open={true}
          onOpenChange={handleOpenChange}
          editId={editState.id}
        />
      );
    case "scalarFunction":
      return (
        <CreateFunctionDialog
          open={true}
          onOpenChange={handleOpenChange}
          editId={editState.id}
        />
      );
    default:
      return null;
  }
}

export function SchemaGraphView(props: SchemaGraphProps) {
  return <SchemaGraphInner {...props} />;
}
