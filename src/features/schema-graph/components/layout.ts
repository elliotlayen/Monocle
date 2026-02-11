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

function splitIntoChunks<T>(items: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) return [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }
  return chunks;
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

    const laneCount = clamp(
      Math.ceil(Math.sqrt(layerNodes.length)),
      1,
      maxLanes
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
