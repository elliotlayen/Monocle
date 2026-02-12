import { SchemaGraph as SchemaGraphType } from "../types";
import { getTableViewNodeHeight } from "./node-geometry";

export const DEFAULT_NODE_HEIGHT = 150;

export interface PositionedBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxBottom: number;
}

export interface GridItem {
  id: string;
}

export interface GridLayoutOptions {
  startX?: number;
  startY: number;
  cols: number;
  nodeWidth: number;
  gapX: number;
  gapY: number;
  getHeight: (nodeId: string) => number;
  getWidth?: (nodeId: string) => number;
}

export interface GridLayoutResult {
  positions: Record<string, { x: number; y: number }>;
  nextY: number;
  minX: number;
  maxX: number;
  maxBottom: number;
}

export interface AuxGroupsSideBySideOptions {
  leftNodeIds: string[];
  rightNodeIds: string[];
  startX: number;
  startY: number;
  leftNodeWidthFallback: number;
  rightNodeWidthFallback: number;
  gapX: number;
  gapY: number;
  laneGapY: number;
  leftCols?: number;
  rightCols?: number;
  getHeight: (nodeId: string) => number;
  getWidth: (nodeId: string, fallbackWidth: number) => number;
}

export interface AuxGroupsSideBySideResult {
  positions: Record<string, { x: number; y: number }>;
  nextY: number;
  bounds: PositionedBounds;
}

export function buildNodeHeightMap(schema: SchemaGraphType): Map<string, number> {
  const heights = new Map<string, number>();

  schema.tables.forEach((table) => {
    heights.set(table.id, getTableViewNodeHeight(table.columns.length));
  });

  (schema.views || []).forEach((view) => {
    heights.set(view.id, getTableViewNodeHeight(view.columns.length));
  });

  (schema.triggers || []).forEach((trigger) => {
    heights.set(trigger.id, DEFAULT_NODE_HEIGHT);
  });

  (schema.storedProcedures || []).forEach((procedure) => {
    heights.set(procedure.id, DEFAULT_NODE_HEIGHT);
  });

  (schema.scalarFunctions || []).forEach((fn) => {
    heights.set(fn.id, DEFAULT_NODE_HEIGHT);
  });

  return heights;
}

export function getNodeHeight(
  nodeHeights: Map<string, number>,
  nodeId: string
): number {
  return nodeHeights.get(nodeId) ?? DEFAULT_NODE_HEIGHT;
}

export function layoutItemsInGridRows(
  items: GridItem[],
  options: GridLayoutOptions
): GridLayoutResult {
  const {
    startX = 0,
    startY,
    cols,
    nodeWidth,
    gapX,
    gapY,
    getHeight,
    getWidth,
  } = options;
  const positions: Record<string, { x: number; y: number }> = {};

  if (items.length === 0) {
    return {
      positions,
      nextY: startY,
      minX: startX,
      maxX: startX,
      maxBottom: startY,
    };
  }

  let currentY = startY;
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxBottom = startY;

  for (let start = 0; start < items.length; start += cols) {
    const row = items.slice(start, start + cols);
    const rowMaxHeight = Math.max(...row.map((item) => getHeight(item.id)));
    const rowWidths = row.map((item) => getWidth?.(item.id) ?? nodeWidth);

    let xCursor = startX;
    row.forEach((item, index) => {
      const width = rowWidths[index];
      const x = xCursor;
      const height = getHeight(item.id);
      positions[item.id] = { x, y: currentY };
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x + width);
      maxBottom = Math.max(maxBottom, currentY + height);
      xCursor += width + gapX;
    });

    currentY += rowMaxHeight + gapY;
  }

  return {
    positions,
    nextY: currentY,
    minX,
    maxX,
    maxBottom,
  };
}

export function layoutAuxGroupsSideBySide(
  options: AuxGroupsSideBySideOptions
): AuxGroupsSideBySideResult {
  const {
    leftNodeIds,
    rightNodeIds,
    startX,
    startY,
    leftNodeWidthFallback,
    rightNodeWidthFallback,
    gapX,
    gapY,
    laneGapY,
    leftCols,
    rightCols,
    getHeight,
    getWidth,
  } = options;

  const defaultCols = (count: number) =>
    Math.max(1, Math.ceil(Math.sqrt(Math.max(1, count))));

  const leftLayout = layoutItemsInGridRows(
    leftNodeIds.map((id) => ({ id })),
    {
      startX,
      startY,
      cols: leftCols ?? defaultCols(leftNodeIds.length),
      nodeWidth: leftNodeWidthFallback,
      gapX,
      gapY,
      getHeight,
      getWidth: (nodeId) => getWidth(nodeId, leftNodeWidthFallback),
    }
  );

  const rightStartX =
    leftNodeIds.length > 0 ? leftLayout.maxX + gapX : startX;

  const rightLayout = layoutItemsInGridRows(
    rightNodeIds.map((id) => ({ id })),
    {
      startX: rightStartX,
      startY,
      cols: rightCols ?? defaultCols(rightNodeIds.length),
      nodeWidth: rightNodeWidthFallback,
      gapX,
      gapY,
      getHeight,
      getWidth: (nodeId) => getWidth(nodeId, rightNodeWidthFallback),
    }
  );

  const positions = {
    ...leftLayout.positions,
    ...rightLayout.positions,
  };
  const hasLeft = leftNodeIds.length > 0;
  const hasRight = rightNodeIds.length > 0;
  const hasAny = hasLeft || hasRight;

  if (!hasAny) {
    return {
      positions,
      nextY: startY,
      bounds: createEmptyBounds(),
    };
  }

  const maxBottom = Math.max(
    startY,
    hasLeft ? leftLayout.maxBottom : Number.NEGATIVE_INFINITY,
    hasRight ? rightLayout.maxBottom : Number.NEGATIVE_INFINITY
  );

  return {
    positions,
    nextY: maxBottom + laneGapY,
    bounds: {
      minX: Math.min(
        hasLeft ? leftLayout.minX : Number.POSITIVE_INFINITY,
        hasRight ? rightLayout.minX : Number.POSITIVE_INFINITY
      ),
      maxX: Math.max(
        hasLeft ? leftLayout.maxX : Number.NEGATIVE_INFINITY,
        hasRight ? rightLayout.maxX : Number.NEGATIVE_INFINITY
      ),
      minY: startY,
      maxBottom,
    },
  };
}

export interface DirectedEdge {
  from: string;
  to: string;
}

export interface LayeredLayoutOptions {
  nodeIds: string[];
  edges: DirectedEdge[];
  layerGapX: number;
  laneGapX: number;
  gapY: number;
  maxLanes?: number;
  targetAspectRatio?: number;
  getHeight: (nodeId: string) => number;
  getWidth: (nodeId: string) => number;
}

export interface LayeredLayoutResult {
  positions: Record<string, { x: number; y: number }>;
  bounds: PositionedBounds;
  layerByNode: Map<string, number>;
}

export interface SideBandLayoutOptions {
  nodeIds: string[];
  direction: "left" | "right";
  anchorX: number;
  bandGapX: number;
  laneGapX: number;
  gapY: number;
  maxLanes?: number;
  maxRowsPerLane?: number;
  getHeight: (nodeId: string) => number;
  getWidth: (nodeId: string) => number;
}

export interface PositionedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RightAnchoredChildLayoutOptions {
  childIds: string[];
  getParentId: (childId: string) => string | null | undefined;
  parentPositions:
    | Record<string, { x: number; y: number }>
    | Map<string, { x: number; y: number }>;
  getParentWidth: (parentId: string) => number;
  getParentHeight: (parentId: string) => number;
  getChildWidth: (childId: string) => number;
  getChildHeight: (childId: string) => number;
  baseGapX: number;
  stackGapY: number;
  collisionStepX: number;
  occupiedRects?: PositionedRect[];
  getChildStackStartY?: (params: {
    parentId: string;
    parentTopY: number;
    parentHeight: number;
    totalStackHeight: number;
  }) => number;
}

export interface RightAnchoredChildLayoutResult {
  positions: Record<string, { x: number; y: number }>;
  unplacedChildIds: string[];
  bounds: PositionedBounds;
}

export interface RightAnchoredChildrenByBandsOptions {
  orderedBandIds: string[];
  parentIdsByBand: Map<string, string[]>;
  childIdsByParent: Map<string, string[]>;
  parentPositions:
    | Record<string, { x: number; y: number }>
    | Map<string, { x: number; y: number }>;
  getParentWidth: (parentId: string) => number;
  getParentHeight: (parentId: string) => number;
  getChildWidth: (childId: string) => number;
  getChildHeight: (childId: string) => number;
  baseGapX: number;
  stackGapY: number;
  minLaneGapX: number;
  minBandGapX: number;
  getChildStackStartY?: (params: {
    parentId: string;
    parentTopY: number;
    parentHeight: number;
    totalStackHeight: number;
  }) => number;
}

export interface RightAnchoredChildrenByBandsResult {
  positions: Record<string, { x: number; y: number }>;
  unplacedChildIds: string[];
  parentShiftById: Map<string, number>;
  bandShiftById: Map<string, number>;
  bounds: PositionedBounds;
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const getStableId = (ids: string[]) =>
  ids.length > 0 ? [...ids].sort()[0] : "";

function createEmptyBounds(): PositionedBounds {
  return { minX: 0, maxX: 0, minY: 0, maxBottom: 0 };
}

function buildBounds(
  positions: Record<string, { x: number; y: number }>,
  getHeight: (nodeId: string) => number,
  getWidth?: (nodeId: string) => number
): PositionedBounds {
  const entries = Object.entries(positions);
  if (entries.length === 0) {
    return createEmptyBounds();
  }

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxBottom = Number.NEGATIVE_INFINITY;

  for (const [nodeId, position] of entries) {
    minX = Math.min(minX, position.x);
    const width = getWidth ? getWidth(nodeId) : 0;
    maxX = Math.max(maxX, position.x + width);
    minY = Math.min(minY, position.y);
    maxBottom = Math.max(maxBottom, position.y + getHeight(nodeId));
  }

  return { minX, maxX, minY, maxBottom };
}

function pickShortestLane(laneHeights: number[]): number {
  let target = 0;
  let best = laneHeights[0] ?? 0;
  for (let idx = 1; idx < laneHeights.length; idx++) {
    if (laneHeights[idx] < best) {
      best = laneHeights[idx];
      target = idx;
    }
  }
  return target;
}

function getLaneCountForLayer(
  layerNodes: string[],
  maxLanes: number,
  gapY: number,
  getHeight: (nodeId: string) => number,
  getWidth: (nodeId: string) => number,
  targetAspectRatio?: number
): number {
  if (layerNodes.length === 0) {
    return 1;
  }

  if (!targetAspectRatio || targetAspectRatio <= 0) {
    return clamp(Math.ceil(Math.sqrt(layerNodes.length)), 1, maxLanes);
  }

  const totalStackHeight =
    layerNodes.reduce((sum, nodeId) => sum + getHeight(nodeId), 0) +
    gapY * Math.max(0, layerNodes.length - 1);
  const avgNodeWidth =
    layerNodes.reduce((sum, nodeId) => sum + getWidth(nodeId), 0) /
    layerNodes.length;
  const safeAvgWidth = Math.max(1, avgNodeWidth);
  const balancedLaneCount = Math.ceil(
    Math.sqrt((targetAspectRatio * totalStackHeight) / safeAvgWidth)
  );

  return clamp(balancedLaneCount, 1, maxLanes);
}

function splitIntoChunks<T>(items: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
}

function intersectsRect(a: PositionedRect, b: PositionedRect): boolean {
  return (
    a.x < b.x + b.width &&
    b.x < a.x + a.width &&
    a.y < b.y + b.height &&
    b.y < a.y + a.height
  );
}

function toPositionRecord(
  positions:
    | Record<string, { x: number; y: number }>
    | Map<string, { x: number; y: number }>
): Record<string, { x: number; y: number }> {
  if (!(positions instanceof Map)) {
    return positions;
  }

  const asRecord: Record<string, { x: number; y: number }> = {};
  positions.forEach((value, key) => {
    asRecord[key] = value;
  });
  return asRecord;
}

function buildBandMainRects(
  parentIds: string[],
  parentPositions: Record<string, { x: number; y: number }>,
  bandShiftX: number,
  getParentWidth: (parentId: string) => number,
  getParentHeight: (parentId: string) => number
): PositionedRect[] {
  return parentIds
    .map((parentId) => {
      const position = parentPositions[parentId];
      if (!position) return null;
      return {
        x: position.x + bandShiftX,
        y: position.y,
        width: getParentWidth(parentId),
        height: getParentHeight(parentId),
      };
    })
    .filter((rect): rect is PositionedRect => rect !== null);
}

function buildTarjanComponents(
  nodeIds: string[],
  adjacency: Map<string, Set<string>>
): string[][] {
  const indices = new Map<string, number>();
  const lowLinks = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const components: string[][] = [];
  let index = 0;

  const strongConnect = (nodeId: string) => {
    indices.set(nodeId, index);
    lowLinks.set(nodeId, index);
    index++;
    stack.push(nodeId);
    onStack.add(nodeId);

    for (const next of adjacency.get(nodeId) ?? []) {
      if (!indices.has(next)) {
        strongConnect(next);
        lowLinks.set(
          nodeId,
          Math.min(lowLinks.get(nodeId)!, lowLinks.get(next)!)
        );
      } else if (onStack.has(next)) {
        lowLinks.set(
          nodeId,
          Math.min(lowLinks.get(nodeId)!, indices.get(next)!)
        );
      }
    }

    if (lowLinks.get(nodeId) === indices.get(nodeId)) {
      const component: string[] = [];
      while (stack.length > 0) {
        const popped = stack.pop()!;
        onStack.delete(popped);
        component.push(popped);
        if (popped === nodeId) break;
      }
      components.push(component);
    }
  };

  for (const nodeId of nodeIds) {
    if (!indices.has(nodeId)) {
      strongConnect(nodeId);
    }
  }

  return components;
}

function computeLayerRanks(
  nodeIds: string[],
  edges: DirectedEdge[]
): { layerByNode: Map<string, number>; layers: Map<number, string[]> } {
  const nodeSet = new Set(nodeIds);
  const adjacency = new Map<string, Set<string>>();
  nodeIds.forEach((id) => adjacency.set(id, new Set()));

  edges.forEach((edge) => {
    if (!nodeSet.has(edge.from) || !nodeSet.has(edge.to)) return;
    if (edge.from === edge.to) return;
    adjacency.get(edge.from)!.add(edge.to);
  });

  const components = buildTarjanComponents(nodeIds, adjacency);
  const componentByNode = new Map<string, number>();
  components.forEach((component, index) => {
    component.forEach((nodeId) => componentByNode.set(nodeId, index));
  });

  const componentAdj = new Map<number, Set<number>>();
  const indegree = new Map<number, number>();
  components.forEach((_, idx) => {
    componentAdj.set(idx, new Set());
    indegree.set(idx, 0);
  });

  edges.forEach((edge) => {
    if (!nodeSet.has(edge.from) || !nodeSet.has(edge.to)) return;
    const fromComp = componentByNode.get(edge.from);
    const toComp = componentByNode.get(edge.to);
    if (fromComp === undefined || toComp === undefined || fromComp === toComp) {
      return;
    }
    const next = componentAdj.get(fromComp)!;
    if (!next.has(toComp)) {
      next.add(toComp);
      indegree.set(toComp, (indegree.get(toComp) ?? 0) + 1);
    }
  });

  const queue = [...indegree.entries()]
    .filter(([, deg]) => deg === 0)
    .map(([compId]) => compId)
    .sort((a, b) =>
      getStableId(components[a]).localeCompare(getStableId(components[b]))
    );

  const topoOrder: number[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    topoOrder.push(current);
    const outgoing = [...(componentAdj.get(current) ?? [])].sort((a, b) =>
      getStableId(components[a]).localeCompare(getStableId(components[b]))
    );
    outgoing.forEach((target) => {
      const nextIn = (indegree.get(target) ?? 0) - 1;
      indegree.set(target, nextIn);
      if (nextIn === 0) {
        queue.push(target);
        queue.sort((a, b) =>
          getStableId(components[a]).localeCompare(getStableId(components[b]))
        );
      }
    });
  }

  const ranks = new Map<number, number>();
  topoOrder.forEach((componentId) => {
    const currentRank = ranks.get(componentId) ?? 0;
    for (const target of componentAdj.get(componentId) ?? []) {
      const nextRank = Math.max(ranks.get(target) ?? 0, currentRank + 1);
      ranks.set(target, nextRank);
    }
  });

  components.forEach((_, idx) => {
    if (!ranks.has(idx)) {
      ranks.set(idx, 0);
    }
  });

  const layerByNode = new Map<string, number>();
  const layers = new Map<number, string[]>();
  components.forEach((component, idx) => {
    const rank = ranks.get(idx) ?? 0;
    component.forEach((nodeId) => layerByNode.set(nodeId, rank));
    if (!layers.has(rank)) {
      layers.set(rank, []);
    }
    layers.get(rank)!.push(...component);
  });

  layers.forEach((layerNodes, rank) => {
    layers.set(rank, layerNodes.sort());
  });

  return { layerByNode, layers };
}

export function layoutLayeredLeftToRight(
  options: LayeredLayoutOptions
): LayeredLayoutResult {
  const {
    nodeIds,
    edges,
    layerGapX,
    laneGapX,
    gapY,
    getHeight,
    getWidth,
    maxLanes = 4,
    targetAspectRatio,
  } = options;

  if (nodeIds.length === 0) {
    return {
      positions: {},
      bounds: createEmptyBounds(),
      layerByNode: new Map<string, number>(),
    };
  }

  const { layerByNode, layers } = computeLayerRanks(nodeIds, edges);
  const positions: Record<string, { x: number; y: number }> = {};
  const ranks = [...layers.keys()].sort((a, b) => a - b);
  let rankStartX = 0;

  ranks.forEach((rank) => {
    const layerNodes = layers.get(rank) ?? [];
    if (layerNodes.length === 0) return;

    const laneCount = getLaneCountForLayer(
      layerNodes,
      maxLanes,
      gapY,
      getHeight,
      getWidth,
      targetAspectRatio
    );
    const laneHeights = Array.from({ length: laneCount }, () => 0);
    const laneNodes = Array.from({ length: laneCount }, () => [] as string[]);
    const laneWidths = Array.from({ length: laneCount }, () => 0);
    const sorted = [...layerNodes].sort((a, b) => {
      const heightDiff = getHeight(b) - getHeight(a);
      return heightDiff !== 0 ? heightDiff : a.localeCompare(b);
    });

    sorted.forEach((nodeId) => {
      const lane = pickShortestLane(laneHeights);
      laneNodes[lane].push(nodeId);
      laneWidths[lane] = Math.max(laneWidths[lane], getWidth(nodeId));
      laneHeights[lane] += getHeight(nodeId) + gapY;
    });

    const laneStarts: number[] = [];
    let laneStart = rankStartX;
    laneWidths.forEach((laneWidth, laneIdx) => {
      laneStarts[laneIdx] = laneStart;
      laneStart += laneWidth + (laneIdx < laneWidths.length - 1 ? laneGapX : 0);
    });

    laneNodes.forEach((nodesInLane, laneIdx) => {
      let yCursor = 0;
      nodesInLane.forEach((nodeId) => {
        positions[nodeId] = { x: laneStarts[laneIdx], y: yCursor };
        yCursor += getHeight(nodeId) + gapY;
      });
    });

    const rankWidth =
      laneWidths.reduce((total, width) => total + width, 0) +
      laneGapX * Math.max(0, laneWidths.length - 1);
    rankStartX += rankWidth + layerGapX;
  });

  return {
    positions,
    bounds: buildBounds(positions, getHeight, getWidth),
    layerByNode,
  };
}

export function layoutSideBands(
  options: SideBandLayoutOptions
): { positions: Record<string, { x: number; y: number }>; bounds: PositionedBounds } {
  const {
    nodeIds,
    direction,
    anchorX,
    bandGapX,
    laneGapX,
    gapY,
    getHeight,
    getWidth,
    maxLanes = 4,
    maxRowsPerLane = 6,
  } = options;
  const positions: Record<string, { x: number; y: number }> = {};

  if (nodeIds.length === 0) {
    return { positions, bounds: createEmptyBounds() };
  }

  const laneCount = clamp(Math.ceil(Math.sqrt(nodeIds.length)), 1, maxLanes);
  const bandCapacity = laneCount * maxRowsPerLane;
  const bands = splitIntoChunks(
    [...nodeIds].sort((a, b) => {
      const heightDiff = getHeight(b) - getHeight(a);
      return heightDiff !== 0 ? heightDiff : a.localeCompare(b);
    }),
    bandCapacity
  );

  bands.forEach((bandNodes, bandIndex) => {
    const laneHeights = Array.from({ length: laneCount }, () => 0);
    const laneNodes = Array.from({ length: laneCount }, () => [] as string[]);
    const laneWidths = Array.from({ length: laneCount }, () => 0);

    bandNodes.forEach((nodeId) => {
      const lane = pickShortestLane(laneHeights);
      laneNodes[lane].push(nodeId);
      laneWidths[lane] = Math.max(laneWidths[lane], getWidth(nodeId));
      laneHeights[lane] += getHeight(nodeId) + gapY;
    });

    const bandWidth =
      laneWidths.reduce((total, width) => total + width, 0) +
      laneGapX * Math.max(0, laneWidths.length - 1);
    const bandOffset = bandIndex * (bandWidth + bandGapX);
    const laneStarts: number[] = [];

    if (direction === "right") {
      let laneStart = anchorX + bandOffset;
      laneWidths.forEach((laneWidth, laneIdx) => {
        laneStarts[laneIdx] = laneStart;
        laneStart += laneWidth + (laneIdx < laneWidths.length - 1 ? laneGapX : 0);
      });
    } else {
      let laneRight = anchorX - bandOffset;
      laneWidths.forEach((laneWidth, laneIdx) => {
        laneStarts[laneIdx] = laneRight - laneWidth;
        laneRight -= laneWidth + (laneIdx < laneWidths.length - 1 ? laneGapX : 0);
      });
    }

    laneNodes.forEach((nodesInLane, laneIdx) => {
      let yCursor = 0;
      nodesInLane.forEach((nodeId) => {
        positions[nodeId] = { x: laneStarts[laneIdx], y: yCursor };
        yCursor += getHeight(nodeId) + gapY;
      });
    });
  });

  return {
    positions,
    bounds: buildBounds(positions, getHeight, getWidth),
  };
}

export function layoutRightAnchoredChildren(
  options: RightAnchoredChildLayoutOptions
): RightAnchoredChildLayoutResult {
  const {
    childIds,
    getParentId,
    parentPositions,
    getParentWidth,
    getParentHeight,
    getChildWidth,
    getChildHeight,
    baseGapX,
    stackGapY,
    collisionStepX,
    occupiedRects = [],
    getChildStackStartY,
  } = options;

  const positions: Record<string, { x: number; y: number }> = {};
  const unplacedChildIds: string[] = [];
  const parentPos = toPositionRecord(parentPositions);
  const groupedByParent = new Map<string, string[]>();
  const occupied = [...occupiedRects];

  childIds.forEach((childId) => {
    const parentId = getParentId(childId);
    if (!parentId || !parentPos[parentId]) {
      unplacedChildIds.push(childId);
      return;
    }
    if (!groupedByParent.has(parentId)) {
      groupedByParent.set(parentId, []);
    }
    groupedByParent.get(parentId)!.push(childId);
  });

  const sortedParents = [...groupedByParent.keys()].sort();
  sortedParents.forEach((parentId) => {
    const parentPosition = parentPos[parentId];
    if (!parentPosition) {
      unplacedChildIds.push(...(groupedByParent.get(parentId) ?? []));
      return;
    }

    const children = [...(groupedByParent.get(parentId) ?? [])].sort();
    if (children.length === 0) {
      return;
    }

    const totalStackHeight =
      children.reduce((sum, childId) => sum + getChildHeight(childId), 0) +
      stackGapY * Math.max(0, children.length - 1);
    const parentHeight = getParentHeight(parentId);
    const parentCenterY = parentPosition.y + parentHeight / 2;
    const centeredStartY = parentCenterY - totalStackHeight / 2;
    let yCursor = getChildStackStartY
      ? getChildStackStartY({
          parentId,
          parentTopY: parentPosition.y,
          parentHeight,
          totalStackHeight,
        })
      : centeredStartY;

    children.forEach((childId) => {
      const width = getChildWidth(childId);
      const height = getChildHeight(childId);
      let x = parentPosition.x + getParentWidth(parentId) + baseGapX;
      let candidate: PositionedRect = { x, y: yCursor, width, height };
      let hasCollision = occupied.some((rect) => intersectsRect(candidate, rect));
      let guard = 0;

      while (hasCollision && guard < 200) {
        x += collisionStepX;
        candidate = { x, y: yCursor, width, height };
        hasCollision = occupied.some((rect) => intersectsRect(candidate, rect));
        guard++;
      }

      positions[childId] = { x, y: yCursor };
      occupied.push(candidate);
      yCursor += height + stackGapY;
    });
  });

  return {
    positions,
    unplacedChildIds,
    bounds: buildBounds(positions, getChildHeight, getChildWidth),
  };
}

export function layoutRightAnchoredChildrenByBands(
  options: RightAnchoredChildrenByBandsOptions
): RightAnchoredChildrenByBandsResult {
  const {
    orderedBandIds,
    parentIdsByBand,
    childIdsByParent,
    parentPositions,
    getParentWidth,
    getParentHeight,
    getChildWidth,
    getChildHeight,
    baseGapX,
    stackGapY,
    minLaneGapX,
    minBandGapX,
    getChildStackStartY,
  } = options;

  const positions: Record<string, { x: number; y: number }> = {};
  const parentShiftById = new Map<string, number>();
  const bandShiftById = new Map<string, number>();
  const unplaced = new Set<string>();
  const placed = new Set<string>();
  const parentPos = toPositionRecord(parentPositions);
  const parentBandById = new Map<string, string>();

  orderedBandIds.forEach((bandId) => {
    (parentIdsByBand.get(bandId) ?? []).forEach((parentId) => {
      parentBandById.set(parentId, bandId);
    });
  });

  childIdsByParent.forEach((childIds, parentId) => {
    if (!parentBandById.has(parentId) || !parentPos[parentId]) {
      childIds.forEach((childId) => unplaced.add(childId));
    }
  });

  let cumulativeShift = 0;

  for (let bandIndex = 0; bandIndex < orderedBandIds.length; bandIndex++) {
    const bandId = orderedBandIds[bandIndex];
    bandShiftById.set(bandId, cumulativeShift);
    const parentIds = [...(parentIdsByBand.get(bandId) ?? [])].sort((a, b) => {
      const posA = parentPos[a];
      const posB = parentPos[b];
      if (!posA || !posB) return a.localeCompare(b);
      if (posA.y !== posB.y) return posA.y - posB.y;
      if (posA.x !== posB.x) return posA.x - posB.x;
      return a.localeCompare(b);
    });

    const laneByX = new Map<number, string[]>();
    parentIds.forEach((parentId) => {
      const parentPosition = parentPos[parentId];
      if (!parentPosition) return;
      if (!laneByX.has(parentPosition.x)) {
        laneByX.set(parentPosition.x, []);
      }
      laneByX.get(parentPosition.x)!.push(parentId);
    });

    const occupied: PositionedRect[] = [];
    const laneXs = [...laneByX.keys()].sort((a, b) => a - b);
    let laneCumulativeShift = 0;

    for (let laneIndex = 0; laneIndex < laneXs.length; laneIndex++) {
      const laneX = laneXs[laneIndex];
      const laneParentIds = [...(laneByX.get(laneX) ?? [])].sort((a, b) => {
        const posA = parentPos[a];
        const posB = parentPos[b];
        if (!posA || !posB) return a.localeCompare(b);
        if (posA.y !== posB.y) return posA.y - posB.y;
        return a.localeCompare(b);
      });
      if (laneParentIds.length === 0) continue;

      const laneShift = cumulativeShift + laneCumulativeShift;
      laneParentIds.forEach((parentId) => {
        parentShiftById.set(parentId, laneShift);
      });

      const laneMainRects = buildBandMainRects(
        laneParentIds,
        parentPos,
        laneShift,
        getParentWidth,
        getParentHeight
      );
      occupied.push(...laneMainRects);

      const laneRight = laneMainRects.reduce((maxRight, rect) => {
        return Math.max(maxRight, rect.x + rect.width);
      }, Number.NEGATIVE_INFINITY);
      let laneOccupiedRight = laneRight;

      const laneChildGroups = laneParentIds
        .map((parentId) => ({
          parentId,
          childIds: [...(childIdsByParent.get(parentId) ?? [])].sort(),
        }))
        .filter((entry) => entry.childIds.length > 0);

      if (laneChildGroups.length > 0 && Number.isFinite(laneRight)) {
        const laneTriggerX = laneRight + baseGapX;
        let laneCursorY = Number.NEGATIVE_INFINITY;

        laneChildGroups.forEach(({ parentId, childIds }) => {
          const parentPosition = parentPos[parentId];
          if (!parentPosition) return;
          const totalStackHeight =
            childIds.reduce((sum, childId) => sum + getChildHeight(childId), 0) +
            stackGapY * Math.max(0, childIds.length - 1);
          const parentHeight = getParentHeight(parentId);
          const parentCenterY = parentPosition.y + parentHeight / 2;
          const centeredStartY = parentCenterY - totalStackHeight / 2;
          const stackStartY = getChildStackStartY
            ? getChildStackStartY({
                parentId,
                parentTopY: parentPosition.y,
                parentHeight,
                totalStackHeight,
              })
            : centeredStartY;
          let yCursor = Math.max(
            stackStartY,
            Number.isFinite(laneCursorY) ? laneCursorY + stackGapY : stackStartY
          );

          childIds.forEach((childId) => {
            if (placed.has(childId)) return;
            const width = getChildWidth(childId);
            const height = getChildHeight(childId);
            positions[childId] = { x: laneTriggerX, y: yCursor };
            occupied.push({ x: laneTriggerX, y: yCursor, width, height });
            placed.add(childId);
            laneCursorY = yCursor + height;
            laneOccupiedRight = Math.max(laneOccupiedRight, laneTriggerX + width);
            yCursor += height + stackGapY;
          });
        });
      }

      if (laneIndex >= laneXs.length - 1 || !Number.isFinite(laneOccupiedRight)) {
        continue;
      }

      const nextLaneX = laneXs[laneIndex + 1];
      const nextLaneLeft = nextLaneX + cumulativeShift + laneCumulativeShift;
      const requiredNextLaneLeft = laneOccupiedRight + minLaneGapX;
      const additionalLaneShift = Math.max(
        0,
        requiredNextLaneLeft - nextLaneLeft
      );
      laneCumulativeShift += additionalLaneShift;
    }

    const bandRight = occupied.reduce(
      (maxRight, rect) => Math.max(maxRight, rect.x + rect.width),
      Number.NEGATIVE_INFINITY
    );
    const hasNextBand = bandIndex < orderedBandIds.length - 1;
    if (!hasNextBand || !Number.isFinite(bandRight)) {
      continue;
    }

    const nextBandId = orderedBandIds[bandIndex + 1];
    const nextBandParentIds = parentIdsByBand.get(nextBandId) ?? [];
    const nextBandLeftOriginal = nextBandParentIds.reduce((minLeft, parentId) => {
      const position = parentPos[parentId];
      if (!position) return minLeft;
      return Math.min(minLeft, position.x);
    }, Number.POSITIVE_INFINITY);

    if (!Number.isFinite(nextBandLeftOriginal)) {
      continue;
    }

    const nextBandLeftShifted = nextBandLeftOriginal + cumulativeShift;
    const requiredNextBandLeft = bandRight + minBandGapX;
    const additionalShift = Math.max(
      0,
      requiredNextBandLeft - nextBandLeftShifted
    );
    cumulativeShift += additionalShift;
  }

  childIdsByParent.forEach((childIds) => {
    childIds.forEach((childId) => {
      if (!placed.has(childId) && !unplaced.has(childId)) {
        unplaced.add(childId);
      }
    });
  });

  return {
    positions,
    unplacedChildIds: [...unplaced].sort(),
    parentShiftById,
    bandShiftById,
    bounds: buildBounds(positions, getChildHeight, getChildWidth),
  };
}

export function getPositionedBounds(
  positions:
    | Map<string, { x: number; y: number }>
    | Record<string, { x: number; y: number }>,
  getHeight: (nodeId: string) => number,
  getWidth?: (nodeId: string) => number
): PositionedBounds {
  if (positions instanceof Map) {
    const asRecord: Record<string, { x: number; y: number }> = {};
    positions.forEach((value, key) => {
      asRecord[key] = value;
    });
    return buildBounds(asRecord, getHeight, getWidth);
  }
  return buildBounds(positions, getHeight, getWidth);
}

export function getCombinedPositionedBounds(
  positionSets: Array<
    | Map<string, { x: number; y: number }>
    | Record<string, { x: number; y: number }>
  >,
  getHeight: (nodeId: string) => number,
  getWidth?: (nodeId: string) => number
): PositionedBounds {
  const combined: Record<string, { x: number; y: number }> = {};
  positionSets.forEach((positionSet) => {
    const asRecord = toPositionRecord(positionSet);
    Object.entries(asRecord).forEach(([nodeId, position]) => {
      combined[nodeId] = position;
    });
  });
  return buildBounds(combined, getHeight, getWidth);
}

export function getMaxPositionedNodeBottom(
  positions: Map<string, { x: number; y: number }>,
  getHeight: (nodeId: string) => number
): number {
  let maxBottom = 0;

  positions.forEach((position, nodeId) => {
    const bottom = position.y + getHeight(nodeId);
    if (bottom > maxBottom) {
      maxBottom = bottom;
    }
  });

  return maxBottom;
}
