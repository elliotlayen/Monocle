import type { VisibleXmlNode } from "./xml-tree-model";

export const XML_NODE_HEIGHT = 44;
export const XML_GAP_X = 72;
export const XML_GAP_Y = 16;
export const XML_NODE_MIN_WIDTH = 140;
export const XML_NODE_MAX_WIDTH = 640;

// JetBrains Mono is the UI face, so character-count width estimation is
// accurate: ~7.2px/char at the 12px label size, ~6px/char at the 10px
// attribute size.
const LABEL_CHAR_W = 7.2;
const ATTR_CHAR_W = 6;
const VALUE_CHAR_W = 6.6; // 11px value text
const BASE_PADDING = 46; // horizontal padding + kind icon + gaps
const PILL_RESERVE = 44; // room for the +N children pill

/** Content-fitted node width so labels, attributes, and inlined values never truncate. */
export function estimateXmlNodeWidth(node: VisibleXmlNode): number {
  let width = BASE_PADDING + node.label.length * LABEL_CHAR_W;
  for (const attr of node.attrs) {
    // name="value" plus inter-attribute gap
    width += (attr.name.length + attr.value.length + 3) * ATTR_CHAR_W + 8;
  }
  if (node.value) {
    width += node.value.length * VALUE_CHAR_W + 14;
  }
  if (node.hasChildren) width += PILL_RESERVE;
  return Math.round(
    Math.min(XML_NODE_MAX_WIDTH, Math.max(XML_NODE_MIN_WIDTH, width))
  );
}

export interface XmlTreeLayoutOptions {
  nodeHeight?: number;
  gapX?: number;
  gapY?: number;
  /** Per-node width; defaults to estimateXmlNodeWidth. */
  getWidth?: (node: VisibleXmlNode) => number;
}

export interface XmlTreeLayoutResult {
  positions: Record<string, { x: number; y: number }>;
  widths: Record<string, number>;
  bounds: { x: number; y: number; width: number; height: number };
}

/**
 * Left-to-right tidy tree layout over the expansion-visible node list
 * (document order, parents before children): each depth forms a column as
 * wide as its widest node, leaves and collapsed nodes stack downward in
 * document order, and parents center on their first and last child. O(n).
 */
export function layoutXmlTree(
  visibleNodes: VisibleXmlNode[],
  options: XmlTreeLayoutOptions = {}
): XmlTreeLayoutResult {
  const nodeHeight = options.nodeHeight ?? XML_NODE_HEIGHT;
  const gapX = options.gapX ?? XML_GAP_X;
  const gapY = options.gapY ?? XML_GAP_Y;
  const getWidth = options.getWidth ?? estimateXmlNodeWidth;

  const positions: Record<string, { x: number; y: number }> = {};
  const widths: Record<string, number> = {};
  if (visibleNodes.length === 0) {
    return { positions, widths, bounds: { x: 0, y: 0, width: 0, height: 0 } };
  }

  const byId = new Map(visibleNodes.map((node) => [node.id, node]));
  const childrenOf = new Map<string, string[]>();
  const columnWidth: number[] = [];
  for (const node of visibleNodes) {
    const width = getWidth(node);
    widths[node.id] = width;
    columnWidth[node.depth] = Math.max(columnWidth[node.depth] ?? 0, width);
    if (node.parentId === null) continue;
    const siblings = childrenOf.get(node.parentId);
    if (siblings) {
      siblings.push(node.id);
    } else {
      childrenOf.set(node.parentId, [node.id]);
    }
  }

  // x offset of each depth column: previous columns' widths plus gaps.
  const columnX: number[] = [];
  let runningX = 0;
  for (let depth = 0; depth < columnWidth.length; depth++) {
    columnX[depth] = runningX;
    runningX += (columnWidth[depth] ?? 0) + gapX;
  }

  let cursorY = 0;

  const place = (id: string): number => {
    const node = byId.get(id)!;
    const x = columnX[node.depth];
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
    widths,
    bounds: {
      x: 0,
      y: 0,
      width: runningX - gapX,
      height: Math.max(cursorY - gapY, nodeHeight),
    },
  };
}
