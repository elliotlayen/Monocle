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
import {
  DirectedEdge,
  buildNodeHeightMap,
  getCombinedPositionedBounds,
  getNodeHeight,
  layoutAuxGroupsSideBySide,
  layoutLayeredLeftToRight,
  layoutItemsInGridRows,
  layoutRightAnchoredChildrenByBands,
  layoutSideBands,
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
import { DetailPopover } from "./detail-popover";
import { SidebarToggle } from "./sidebar-toggle";
import { useDetailPopover } from "../hooks/use-detail-popover";
import type { DetailSidebarData } from "./detail-content";
import { cn } from "@/lib/utils";
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
} from "@/features/schema-graph/utils/handle-ids";
import {
  areEdgesEquivalent,
  deriveEdgeState,
  type EdgeMeta,
} from "./edge-state";
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

const GAP_Y = 100;
const OVERVIEW_LAYER_GAP_X = 140;
const OVERVIEW_LAYER_LANE_GAP_X = 72;
const OVERVIEW_TARGET_ASPECT_RATIO = 2.1;
const OVERVIEW_MIN_LANES = 5;
const OVERVIEW_MAX_LANES = 20;
const FOCUS_TIER_GAP_X = 60;
const FOCUS_SIDE_BAND_GAP_X = 140;
const FOCUS_SIDE_LANE_GAP_X = 72;
const FOCUS_MAX_ROWS_PER_LANE = 5;
const AUX_LANE_GAP_Y = 80;
const AUX_NODE_GAP_X = 90;
const AUX_MAX_COLS = 8;
const OVERVIEW_AUX_MAX_COLS = 20;
const TRIGGER_PARENT_GAP_X = 48;
const TRIGGER_STACK_GAP_Y = 24;
const TRIGGER_MIN_INTER_BAND_GAP_X_OVERVIEW = OVERVIEW_LAYER_GAP_X;
const TRIGGER_MIN_INTER_BAND_GAP_X_FOCUS = FOCUS_TIER_GAP_X;
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

const clampValue = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

interface SchemaGraphProps {
  schema: SchemaGraphType;
  focusedTableId?: string | null;
  searchFilter?: string;
  schemaFilter?: string;
  objectTypeFilter?: Set<ObjectType>;
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
  const withoutSuffix = handleId.replace(/-source$/, "").replace(/-target$/, "");
  const parsed = parseHandleBase(withoutSuffix);
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

const getFallbackAuxCols = (count: number) =>
  clampValue(Math.ceil(Math.sqrt(count)), 1, AUX_MAX_COLS);

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

function placeAuxLane(
  positions: Map<string, { x: number; y: number }>,
  nodeIds: string[],
  startX: number,
  startY: number,
  nodeHeights: Map<string, number>,
  nodeWidths: Map<string, number>,
  fallbackWidth: number,
  cols?: number
): number {
  if (nodeIds.length === 0) return startY;

  const laneLayout = layoutItemsInGridRows(
    nodeIds.map((id) => ({ id })),
    {
      startX,
      startY,
      cols: cols ?? getFallbackAuxCols(nodeIds.length),
      nodeWidth: fallbackWidth,
      gapX: AUX_NODE_GAP_X,
      gapY: GAP_Y,
      getHeight: (nodeId) => getNodeHeight(nodeHeights, nodeId),
      getWidth: (nodeId) => getNodeWidth(nodeWidths, nodeId, fallbackWidth),
    }
  );

  Object.entries(laneLayout.positions).forEach(([id, position]) => {
    positions.set(id, position);
  });

  return laneLayout.maxBottom + AUX_LANE_GAP_Y;
}

function placeAuxGroupsSideBySide(
  positions: Map<string, { x: number; y: number }>,
  leftNodeIds: string[],
  rightNodeIds: string[],
  startX: number,
  startY: number,
  nodeHeights: Map<string, number>,
  nodeWidths: Map<string, number>,
  leftNodeWidthFallback: number,
  rightNodeWidthFallback: number,
  leftCols?: number,
  rightCols?: number
): number {
  const groupLayout = layoutAuxGroupsSideBySide({
    leftNodeIds,
    rightNodeIds,
    startX,
    startY,
    leftNodeWidthFallback,
    rightNodeWidthFallback,
    gapX: AUX_NODE_GAP_X,
    gapY: GAP_Y,
    laneGapY: AUX_LANE_GAP_Y,
    leftCols,
    rightCols,
    getHeight: (nodeId) => getNodeHeight(nodeHeights, nodeId),
    getWidth: (nodeId, fallbackWidth) =>
      getNodeWidth(nodeWidths, nodeId, fallbackWidth),
  });

  Object.entries(groupLayout.positions).forEach(([id, position]) => {
    positions.set(id, position);
  });

  return groupLayout.nextY;
}

/**
 * Calculate compact layout positions when focus mode is "hide".
 * Uses directional left-to-right flow with upstream tables on the left
 * and downstream tables on the right.
 */
function calculateCompactLayout(
  focusedNodeId: string,
  visibleNodeIds: Set<string>,
  neighbors: Set<string>,
  schema: SchemaGraphType,
  nodeHeights: Map<string, number>,
  nodeWidths: Map<string, number>,
  directedEdges: DirectedEdge[]
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();

  positions.set(focusedNodeId, { x: 0, y: 0 });
  const focusedWidth = getNodeWidth(nodeWidths, focusedNodeId, TABLE_VIEW_MIN_WIDTH);
  const tableOrViewIds = new Set<string>([
    ...schema.tables.map((t) => t.id),
    ...(schema.views || []).map((v) => v.id),
  ]);

  const outgoingByNode = new Map<string, Set<string>>();
  directedEdges.forEach((edge) => {
    if (!outgoingByNode.has(edge.from)) {
      outgoingByNode.set(edge.from, new Set());
    }
    outgoingByNode.get(edge.from)!.add(edge.to);
  });

  const upstream: string[] = [];
  const downstream: string[] = [];
  const visibleNeighbors = [...neighbors].filter((id) =>
    visibleNodeIds.has(id)
  );

  for (const neighborId of visibleNeighbors) {
    if (!tableOrViewIds.has(neighborId)) continue;

    const focusedToNeighbor =
      outgoingByNode.get(focusedNodeId)?.has(neighborId) ?? false;
    const neighborToFocused =
      outgoingByNode.get(neighborId)?.has(focusedNodeId) ?? false;

    if (focusedToNeighbor && !neighborToFocused) {
      upstream.push(neighborId);
    } else if (neighborToFocused && !focusedToNeighbor) {
      downstream.push(neighborId);
    } else {
      downstream.push(neighborId);
    }
  }

  const leftLayout = layoutSideBands({
    nodeIds: upstream,
    direction: "left",
    anchorX: -FOCUS_TIER_GAP_X,
    bandGapX: FOCUS_SIDE_BAND_GAP_X,
    laneGapX: FOCUS_SIDE_LANE_GAP_X,
    gapY: GAP_Y,
    maxRowsPerLane: FOCUS_MAX_ROWS_PER_LANE,
    getHeight: (nodeId) => getNodeHeight(nodeHeights, nodeId),
    getWidth: (nodeId) => getNodeWidth(nodeWidths, nodeId, TABLE_VIEW_MIN_WIDTH),
  });
  const rightLayout = layoutSideBands({
    nodeIds: downstream,
    direction: "right",
    anchorX: focusedWidth + FOCUS_TIER_GAP_X,
    bandGapX: FOCUS_SIDE_BAND_GAP_X,
    laneGapX: FOCUS_SIDE_LANE_GAP_X,
    gapY: GAP_Y,
    maxRowsPerLane: FOCUS_MAX_ROWS_PER_LANE,
    getHeight: (nodeId) => getNodeHeight(nodeHeights, nodeId),
    getWidth: (nodeId) => getNodeWidth(nodeWidths, nodeId, TABLE_VIEW_MIN_WIDTH),
  });

  const applyCenteredBand = (
    bandPositions: Record<string, { x: number; y: number }>,
    bandBounds: { minY: number; maxBottom: number }
  ) => {
    const height = bandBounds.maxBottom - bandBounds.minY;
    const yOffset = -height / 2;
    Object.entries(bandPositions).forEach(([id, position]) => {
      positions.set(id, { x: position.x, y: position.y + yOffset });
    });
  };

  applyCenteredBand(leftLayout.positions, leftLayout.bounds);
  applyCenteredBand(rightLayout.positions, rightLayout.bounds);

  const visibleTriggers = (schema.triggers || []).filter((trigger) =>
    visibleNodeIds.has(trigger.id)
  );
  const visibleProcedures = (schema.storedProcedures || [])
    .map((proc) => proc.id)
    .filter((id) => visibleNodeIds.has(id));
  const visibleFunctions = (schema.scalarFunctions || [])
    .map((fn) => fn.id)
    .filter((id) => visibleNodeIds.has(id));

  const mainTableViewPositions: Record<string, { x: number; y: number }> = {};
  positions.forEach((position, nodeId) => {
    if (tableOrViewIds.has(nodeId)) {
      mainTableViewPositions[nodeId] = position;
    }
  });
  const bandXs = [...new Set(Object.values(mainTableViewPositions).map((p) => p.x))]
    .sort((a, b) => a - b);
  const orderedBandIds = bandXs.map((_, index) => `focus-band-${index}`);
  const bandIdByX = new Map<number, string>();
  const parentIdsByBand = new Map<string, string[]>();
  orderedBandIds.forEach((bandId, index) => {
    bandIdByX.set(bandXs[index], bandId);
    parentIdsByBand.set(bandId, []);
  });

  Object.entries(mainTableViewPositions).forEach(([nodeId, position]) => {
    const bandId = bandIdByX.get(position.x);
    if (!bandId) return;
    parentIdsByBand.get(bandId)!.push(nodeId);
  });

  const childIdsByParent = new Map<string, string[]>();
  visibleTriggers.forEach((trigger) => {
    if (!childIdsByParent.has(trigger.tableId)) {
      childIdsByParent.set(trigger.tableId, []);
    }
    childIdsByParent.get(trigger.tableId)!.push(trigger.id);
  });

  const triggerLayout = layoutRightAnchoredChildrenByBands({
    orderedBandIds,
    parentIdsByBand,
    childIdsByParent,
    parentPositions: mainTableViewPositions,
    getParentWidth: (parentId) =>
      getNodeWidth(nodeWidths, parentId, TABLE_VIEW_MIN_WIDTH),
    getParentHeight: (parentId) => getNodeHeight(nodeHeights, parentId),
    getChildWidth: (childId) =>
      getNodeWidth(nodeWidths, childId, TRIGGER_MIN_WIDTH),
    getChildHeight: (childId) => getNodeHeight(nodeHeights, childId),
    baseGapX: TRIGGER_PARENT_GAP_X,
    stackGapY: TRIGGER_STACK_GAP_Y,
    minLaneGapX: FOCUS_SIDE_LANE_GAP_X,
    minBandGapX: TRIGGER_MIN_INTER_BAND_GAP_X_FOCUS,
    getChildStackStartY: ({ parentTopY }) =>
      parentTopY + TABLE_VIEW_HEADER_HEIGHT,
  });

  const shiftedMainTableViewPositions: Record<string, { x: number; y: number }> = {};
  Object.entries(mainTableViewPositions).forEach(([nodeId, position]) => {
    const shiftX = triggerLayout.parentShiftById.get(nodeId) ?? 0;
    const shifted = { x: position.x + shiftX, y: position.y };
    shiftedMainTableViewPositions[nodeId] = shifted;
    positions.set(nodeId, shifted);
  });

  Object.entries(triggerLayout.positions).forEach(([id, position]) => {
    positions.set(id, position);
  });

  const mainAndTriggerBounds = getCombinedPositionedBounds(
    [shiftedMainTableViewPositions, triggerLayout.positions],
    (nodeId) => getNodeHeight(nodeHeights, nodeId),
    (nodeId) => {
      if (tableOrViewIds.has(nodeId)) {
        return getNodeWidth(nodeWidths, nodeId, TABLE_VIEW_MIN_WIDTH);
      }
      return getNodeWidth(nodeWidths, nodeId, TRIGGER_MIN_WIDTH);
    }
  );

  let nextY = mainAndTriggerBounds.maxBottom + GAP_Y;
  nextY = placeAuxLane(
    positions,
    triggerLayout.unplacedChildIds,
    mainAndTriggerBounds.minX,
    nextY,
    nodeHeights,
    nodeWidths,
    TRIGGER_MIN_WIDTH
  );
  placeAuxGroupsSideBySide(
    positions,
    visibleProcedures,
    visibleFunctions,
    mainAndTriggerBounds.minX,
    nextY,
    nodeHeights,
    nodeWidths,
    ROUTINE_MIN_WIDTH,
    ROUTINE_MIN_WIDTH
  );

  return positions;
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
  viewColumnSources: Map<
    string,
    { columnName: string; sourceTableId: string; sourceColumn: string }[]
  >,
  options: ConvertOptions,
  columnsWithHandles: Set<string>,
  fkColumnUsage: Map<string, { outgoing: number; incoming: number }>,
  fkColumnLinks: Map<
    string,
    { direction: "outgoing" | "incoming"; tableId: string; column: string }[]
  >,
  nodeHeights: Map<string, number>,
  nodeWidths: Map<string, number>
): Node[] {
  const tables = schema.tables;
  const views = schema.views || [];
  const mainNodeIds = [...tables.map((table) => table.id), ...views.map((view) => view.id)];
  const overviewMaxLanes = getOverviewMainMaxLanes(mainNodeIds.length);
  const layered = layoutLayeredLeftToRight({
    nodeIds: mainNodeIds,
    edges: buildMainDirectedEdges(schema, viewColumnSources),
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

  const triggerEntries = schema.triggers || [];
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

  const procedureIds = (schema.storedProcedures || []).map((proc) => proc.id);
  const functionIds = (schema.scalarFunctions || []).map((fn) => fn.id);
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

  const triggerNodes: Node[] = (schema.triggers || []).map((trigger) => ({
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

  const procedureNodes: Node[] = (schema.storedProcedures || []).map(
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

  const functionNodes: Node[] = (schema.scalarFunctions || []).map((fn) => ({
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
        rel.fromColumn && rel.toColumn
          ? `${rel.fromColumn} → ${rel.toColumn}`
          : undefined,
    });
  });

  (schema.triggers || []).forEach((trigger) => {
    edges.push({
      id: `trigger-edge-${trigger.id}`,
      type: "triggerDependencies",
      source: trigger.tableId,
      target: trigger.id,
      sourceHandle: `${buildNodeHandleBase(trigger.tableId)}-source`,
      targetHandle: `${buildNodeHandleBase(trigger.id)}-target`,
      label: trigger.name,
    });

    (trigger.referencedTables || []).forEach((tableId) => {
      if (tableId === trigger.tableId) return;
      edges.push({
        id: `trigger-ref-edge-${trigger.id}-${tableId}`,
        type: "triggerDependencies",
        source: trigger.id,
        target: tableId,
        sourceHandle: `${buildNodeHandleBase(trigger.id)}-source`,
        targetHandle: `${buildNodeHandleBase(tableId)}-target`,
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
  edgeTypeFilter,
  canvasMode,
  importDialogOpen,
  onImportDialogOpenChange,
}: SchemaGraphProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
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
    open: popoverOpen,
    data: popoverData,
    anchorRect,
    openPopover,
    closePopover,
  } = useDetailPopover();
  const {
    selectedEdgeIds,
    toggleEdgeSelection,
    clearEdgeSelection,
    focusExpandThreshold,
    edgeLabelMode,
    showMiniMap,
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
      focusExpandThreshold: state.focusExpandThreshold,
      edgeLabelMode: state.edgeLabelMode,
      showMiniMap: state.showMiniMap,
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
    setSidebarOpen((prev) => !prev);
  }, []);

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
        case "triggerDependencies": {
          const targetIsTrigger = schema.triggers.some(
            (t) => t.id === descriptor.targetId
          );
          if (targetIsTrigger) {
            removeTrigger(descriptor.targetId);
          } else {
            removeTriggerReference(
              descriptor.sourceId,
              descriptor.targetId,
              "reads"
            );
          }
          break;
        }
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
      removeTrigger,
      removeTriggerReference,
      removeViewColumnSource,
      schema.triggers,
    ]
  );

  const handleNodeClick = useCallback(
    (data: DetailSidebarData, event: React.MouseEvent) => {
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
      openPopover(data, rect);
    },
    [openPopover]
  );

  const handleTableClick = useCallback(
    (table: TableNodeType, event: React.MouseEvent) => {
      handleNodeClick({ type: "table", data: table }, event);
    },
    [handleNodeClick]
  );

  const handleViewClick = useCallback(
    (view: ViewNodeType, event: React.MouseEvent) => {
      handleNodeClick({ type: "view", data: view }, event);
    },
    [handleNodeClick]
  );

  const handleTriggerClick = useCallback(
    (trigger: Trigger, event: React.MouseEvent) => {
      handleNodeClick({ type: "trigger", data: trigger }, event);
    },
    [handleNodeClick]
  );

  const handleProcedureClick = useCallback(
    (procedure: StoredProcedure, event: React.MouseEvent) => {
      handleNodeClick({ type: "storedProcedure", data: procedure }, event);
    },
    [handleNodeClick]
  );

  const handleFunctionClick = useCallback(
    (fn: ScalarFunction, event: React.MouseEvent) => {
      handleNodeClick({ type: "scalarFunction", data: fn }, event);
    },
    [handleNodeClick]
  );

  const handleSidebarItemClick = useCallback(
    (data: DetailSidebarData, rect: DOMRect) => {
      openPopover(data, rect);
    },
    [openPopover]
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
  const onNodeDragStop: NodeMouseHandler = useCallback(
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
  const objectTextColorById = useMemo(() => {
    const colors = new Map<string, string>();
    schema.tables.forEach((table) => {
      colors.set(table.id, "#64748b");
    });
    (schema.views || []).forEach((view) => {
      colors.set(view.id, "#10b981");
    });
    (schema.triggers || []).forEach((trigger) => {
      colors.set(trigger.id, "#f59e0b");
    });
    (schema.storedProcedures || []).forEach((procedure) => {
      colors.set(procedure.id, "#8b5cf6");
    });
    (schema.scalarFunctions || []).forEach((fn) => {
      colors.set(fn.id, "#06b6d4");
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
      schemaIndex.viewColumnSources,
      options,
      schemaIndex.columnsWithHandles,
      schemaIndex.fkColumnUsage,
      schemaIndex.fkColumnLinks,
      nodeHeights,
      nodeWidths
    );
    // In canvas mode, override positions from stored positions and pass canvasMode to node data
    if (canvasMode) {
      return nodes.map((node) => {
        const storedPos = storedNodePositions[node.id];
        return {
          ...node,
          position: storedPos ?? node.position,
          data: {
            ...(node.data as Record<string, unknown>),
            canvasMode: true,
          },
        };
      });
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
    canvasMode,
    storedNodePositions,
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
        if (selectedEdgeIds.size > 0) {
          handleDeleteSelectedEdges();
          return;
        }
        const selectedNodes = nodes.filter((n) => n.selected);
        if (selectedNodes.length > 0) {
          handleDeleteSelected(selectedNodes);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    canvasMode,
    nodes,
    selectedEdgeIds,
    handleDeleteSelected,
    handleDeleteSelectedEdges,
  ]);

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

    let filteredViews = showViews ? schema.views || [] : [];
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
      ? schema.storedProcedures || []
      : [];
    let filteredFunctions = showFunctions ? schema.scalarFunctions || [] : [];

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

    // Get direct neighbors of focused node
    const focusedNeighbors = focusedTableId
      ? schemaIndex.neighbors.get(focusedTableId) ?? new Set<string>()
      : new Set<string>();

    // Helper to check if a node is a direct neighbor
    const isNeighbor = (nodeId: string) => focusedNeighbors.has(nodeId);

    // Calculate which nodes would be dimmed for focus mode
    const dimmedNodeIds = new Set<string>();
    if (focusedTableId) {
      visibleNodeIds.forEach((nodeId) => {
        // Tables and views: dimmed if not focused and not a neighbor
        if (visibleTableIds.has(nodeId) || visibleViewIds.has(nodeId)) {
          if (nodeId !== focusedTableId && !isNeighbor(nodeId)) {
            dimmedNodeIds.add(nodeId);
          }
        }
        // Triggers: dimmed if their table is not focused and not a neighbor
        else if (visibleTriggerIds.has(nodeId)) {
          const trigger = (schema.triggers || []).find((t) => t.id === nodeId);
          if (
            trigger &&
            trigger.tableId !== focusedTableId &&
            !isNeighbor(trigger.tableId)
          ) {
            dimmedNodeIds.add(nodeId);
          }
        }
        // Procedures: dimmed if none of their tables are focused or a neighbor
        else if (visibleProcedureIds.has(nodeId)) {
          const procedure = (schema.storedProcedures || []).find(
            (p) => p.id === nodeId
          );
          if (procedure) {
            const refs = [
              ...(procedure.referencedTables || []),
              ...(procedure.affectedTables || []),
            ];
            if (
              !refs.some(
                (tableId) =>
                  tableId === focusedTableId || isNeighbor(tableId)
              )
            ) {
              dimmedNodeIds.add(nodeId);
            }
          }
        }
        // Functions: dimmed if none of their tables are focused or a neighbor
        else if (visibleFunctionIds.has(nodeId)) {
          const fn = (schema.scalarFunctions || []).find(
            (f) => f.id === nodeId
          );
          if (fn) {
            const refs = fn.referencedTables || [];
            if (
              !refs.some(
                (tableId) =>
                  tableId === focusedTableId || isNeighbor(tableId)
              )
            ) {
              dimmedNodeIds.add(nodeId);
            }
          }
        }
      });
    }

    // Count visible non-dimmed tables/views for per-node compact calculation
    const visibleNonDimmedCount = [
      ...visibleTableIds,
      ...visibleViewIds,
    ].filter((id) => !dimmedNodeIds.has(id)).length;
    const moderateThreshold = Math.ceil(focusExpandThreshold * 1.67);

    // Hide-only focus mode: exclude dimmed nodes from rendered edges.
    const renderableNodeIds = new Set(
      [...visibleNodeIds].filter((id) => !dimmedNodeIds.has(id))
    );

    const {
      edges: nextEdges,
      handleEdgeTypes,
      visibleEdgeIds,
    } = deriveEdgeState({
      edges: baseEdges,
      edgeTypeFilter,
      renderableNodeIds,
      columnsByNodeId,
      focusedTableId: focusedTableId ?? null,
      selectedEdgeIds,
      hoveredEdgeId,
      showLabels: showEdgeLabels,
      showInlineLabelOnHover: false,
      previousHandleEdgeTypes: handleEdgeTypesRef.current,
    });
    handleEdgeTypesRef.current = handleEdgeTypes;

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
    } else if (!pendingEdgeFlushRef.current) {
      if (!areEdgesEquivalent(edgesRef.current, nextEdges)) {
        edgesRef.current = nextEdges;
        setEdges(nextEdges);
      }
      if (!transitionNeedsFlush) {
        lastFlushSignatureRef.current = "";
        setIsEdgeFlushInProgress(false);
      }
    }

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
        let isFocused = false;
        let isDimmed = false;
        const isTableOrView = node.type === "tableNode" || node.type === "viewNode";

        if (focusedTableId) {
          if (isTableOrView) {
            isFocused = node.id === focusedTableId;
            isDimmed = !isFocused && !isNeighbor(node.id);
          } else if (node.type === "triggerNode") {
            const trigger = (node.data as { trigger?: Trigger }).trigger;
            if (trigger) {
              isDimmed =
                trigger.tableId !== focusedTableId &&
                !isNeighbor(trigger.tableId);
            }
          } else if (node.type === "storedProcedureNode") {
            const procedure = (node.data as { procedure?: StoredProcedure })
              .procedure;
            if (procedure) {
              const refs = [
                ...(procedure.referencedTables || []),
                ...(procedure.affectedTables || []),
              ];
              isDimmed = !refs.some(
                (tableId) =>
                  tableId === focusedTableId || isNeighbor(tableId)
              );
            }
          } else if (node.type === "scalarFunctionNode") {
            const fn = (node.data as { function?: ScalarFunction }).function;
            if (fn) {
              const refs = fn.referencedTables || [];
              isDimmed = !refs.some(
                (tableId) =>
                  tableId === focusedTableId || isNeighbor(tableId)
              );
            }
          }
        }

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
        if (shouldUseCompactLayout && compactPositions?.has(node.id)) {
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
    baseEdges,
    edgeTypeFilter,
    focusedTableId,
    focusExpandThreshold,
    zoomBand,
    schema,
    schemaFilter,
    schemaIndex,
    searchFilter,
    selectedEdgeIds,
    hoveredEdgeId,
    setEdges,
    setNodes,
    clearEdgeSelection,
    showEdgeLabels,
    objectTypeFilter,
    columnsByNodeId,
    nodeHeights,
    nodeWidths,
    mainDependencyEdges,
    fitView,
    updateNodeInternals,
  ]);

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
      <Controls className="!bg-background !border-border !shadow-sm [&>button]:!bg-background [&>button]:!border-border [&>button]:!text-foreground [&>button:hover]:!bg-muted" />
      {showMiniMap && (
        <MiniMap
          nodeColor={getMinimapNodeColor}
          maskColor="var(--minimap-mask)"
          className="!bg-background"
          pannable
          zoomable
        />
      )}
    </ReactFlow>
  );

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
        onEdit={canvasMode ? handleEditFromPopover : undefined}
      />
      <main
        className={cn(
          "flex-1 h-full transition-all duration-300",
          sidebarOpen && "ml-[280px]"
        )}
      >
        <div
          className="relative w-full h-full"
          onContextMenu={canvasMode ? handleContextMenu : undefined}
        >
          <SidebarToggle
            onClick={() => setSidebarOpen(true)}
            visible={!sidebarOpen}
          />
          {reactFlowContent}
          {hoverCard && (
            <div
              style={{
                position: "fixed",
                left: hoverCard.x + EDGE_HOVER_CARD_OFFSET_X,
                top: hoverCard.y + EDGE_HOVER_CARD_OFFSET_Y,
                zIndex: 120,
              }}
              className="pointer-events-none max-w-[420px] break-words rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md"
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
