import type { VisibleXmlNode } from "./xml-tree-model";

export const XML_NODE_WIDTH = 260;
export const XML_NODE_HEIGHT = 44;
export const XML_GAP_X = 80;
export const XML_GAP_Y = 16;

export interface XmlTreeLayoutOptions {
  nodeWidth?: number;
  nodeHeight?: number;
  gapX?: number;
  gapY?: number;
}

export interface XmlTreeLayoutResult {
  positions: Record<string, { x: number; y: number }>;
  bounds: { x: number; y: number; width: number; height: number };
}

/**
 * Left-to-right tidy tree layout over the expansion-visible node list
 * (document order, parents before children): x is depth-based, leaves and
 * collapsed nodes stack downward in document order, and parents center on
 * their first and last child. O(n).
 */
export function layoutXmlTree(
  visibleNodes: VisibleXmlNode[],
  options: XmlTreeLayoutOptions = {}
): XmlTreeLayoutResult {
  const nodeWidth = options.nodeWidth ?? XML_NODE_WIDTH;
  const nodeHeight = options.nodeHeight ?? XML_NODE_HEIGHT;
  const gapX = options.gapX ?? XML_GAP_X;
  const gapY = options.gapY ?? XML_GAP_Y;

  const positions: Record<string, { x: number; y: number }> = {};
  if (visibleNodes.length === 0) {
    return { positions, bounds: { x: 0, y: 0, width: 0, height: 0 } };
  }

  const byId = new Map(visibleNodes.map((node) => [node.id, node]));
  const childrenOf = new Map<string, string[]>();
  for (const node of visibleNodes) {
    if (node.parentId === null) continue;
    const siblings = childrenOf.get(node.parentId);
    if (siblings) {
      siblings.push(node.id);
    } else {
      childrenOf.set(node.parentId, [node.id]);
    }
  }

  let cursorY = 0;
  let maxDepth = 0;

  const place = (id: string): number => {
    const node = byId.get(id)!;
    if (node.depth > maxDepth) maxDepth = node.depth;
    const x = node.depth * (nodeWidth + gapX);
    const childIds = childrenOf.get(id) ?? [];

    let y: number;
    if (childIds.length === 0) {
      y = cursorY;
      cursorY += nodeHeight + gapY;
    } else {
      const childYs = childIds.map(place);
      y = (childYs[0] + childYs[childYs.length - 1]) / 2;
    }
    positions[id] = { x, y };
    return y;
  };

  place(visibleNodes[0].id);

  return {
    positions,
    bounds: {
      x: 0,
      y: 0,
      width: maxDepth * (nodeWidth + gapX) + nodeWidth,
      height: Math.max(cursorY - gapY, nodeHeight),
    },
  };
}
