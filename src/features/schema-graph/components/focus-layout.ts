import { SchemaGraph as SchemaGraphType } from "../types";
import {
  DirectedEdge,
  getCombinedPositionedBounds,
  getNodeHeight,
  layoutRightAnchoredChildrenByBands,
  layoutSideBands,
} from "./layout";
import {
  getNodeWidth,
  ROUTINE_MIN_WIDTH,
  TABLE_VIEW_MIN_WIDTH,
  TRIGGER_MIN_WIDTH,
} from "./node-width";
import { TABLE_VIEW_HEADER_HEIGHT } from "./node-geometry";
import {
  GAP_Y,
  TRIGGER_PARENT_GAP_X,
  TRIGGER_STACK_GAP_Y,
  placeAuxGroupsSideBySide,
  placeAuxLane,
} from "./aux-layout";

const FOCUS_TIER_GAP_X = 60;
const FOCUS_SIDE_BAND_GAP_X = 140;
const FOCUS_SIDE_LANE_GAP_X = 72;
const FOCUS_MAX_ROWS_PER_LANE = 5;
const TRIGGER_MIN_INTER_BAND_GAP_X_FOCUS = FOCUS_TIER_GAP_X;

/**
 * Calculate compact layout positions when focus mode is "hide".
 * Directed edges flow left-to-right, matching the overview layout and the
 * fixed handle geometry (source handles on the right, targets on the left):
 * neighbors the focused node points at land on the right, neighbors pointing
 * at the focused node land on the left.
 */
export function calculateCompactLayout(
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

  const incoming: string[] = [];
  const outgoing: string[] = [];
  const visibleNeighbors = [...neighbors].filter((id) =>
    visibleNodeIds.has(id)
  );

  for (const neighborId of visibleNeighbors) {
    if (!tableOrViewIds.has(neighborId)) continue;

    const focusedToNeighbor =
      outgoingByNode.get(focusedNodeId)?.has(neighborId) ?? false;
    const neighborToFocused =
      outgoingByNode.get(neighborId)?.has(focusedNodeId) ?? false;

    if (neighborToFocused && !focusedToNeighbor) {
      incoming.push(neighborId);
    } else {
      outgoing.push(neighborId);
    }
  }

  const leftLayout = layoutSideBands({
    nodeIds: incoming,
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
    nodeIds: outgoing,
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
