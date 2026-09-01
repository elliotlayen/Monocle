import {
  getNodeHeight,
  layoutAuxGroupsSideBySide,
  layoutItemsInGridRows,
} from "./layout";
import { getNodeWidth } from "./node-width";

export const GAP_Y = 100;
export const AUX_LANE_GAP_Y = 80;
export const AUX_NODE_GAP_X = 90;
export const AUX_MAX_COLS = 8;
export const TRIGGER_PARENT_GAP_X = 48;
export const TRIGGER_STACK_GAP_Y = 24;

export const clampValue = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

export const getFallbackAuxCols = (count: number) =>
  clampValue(Math.ceil(Math.sqrt(count)), 1, AUX_MAX_COLS);

export function placeAuxLane(
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

export function placeAuxGroupsSideBySide(
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
