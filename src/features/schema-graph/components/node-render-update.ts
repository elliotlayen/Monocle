import { type Node } from "@xyflow/react";
import { type EdgeType } from "../store";

interface NodeRenderData {
  isFocused?: boolean;
  isDimmed?: boolean;
  isCompact?: boolean;
  nodeWidth?: number;
  columnsWithHandles?: Set<string>;
  handleEdgeTypes?: Map<string, Set<EdgeType>>;
  [key: string]: unknown;
}

export interface NodeRenderPatch {
  position: { x: number; y: number };
  hidden: boolean;
  isFocused: boolean;
  isDimmed: boolean;
  nodeWidth: number;
  isCompact?: boolean;
  columnsWithHandles?: Set<string>;
  handleEdgeTypes?: Map<string, Set<EdgeType>>;
  includeTableViewFields: boolean;
}

export interface NodeRenderUpdateResult {
  node: Node;
  changed: boolean;
  geometryChanged: boolean;
}

export function applyNodeRenderPatch(
  node: Node,
  patch: NodeRenderPatch
): NodeRenderUpdateResult {
  const previousData = (node.data as NodeRenderData | undefined) ?? {};
  const positionChanged =
    patch.position.x !== node.position.x || patch.position.y !== node.position.y;
  const hiddenChanged = Boolean(node.hidden) !== patch.hidden;
  const coreDataChanged =
    previousData.isFocused !== patch.isFocused ||
    previousData.isDimmed !== patch.isDimmed ||
    previousData.nodeWidth !== patch.nodeWidth;

  const tableViewDataChanged =
    patch.includeTableViewFields &&
    (previousData.isCompact !== patch.isCompact ||
      previousData.columnsWithHandles !== patch.columnsWithHandles ||
      previousData.handleEdgeTypes !== patch.handleEdgeTypes);

  const dataChanged = coreDataChanged || tableViewDataChanged;
  if (!positionChanged && !hiddenChanged && !dataChanged) {
    return {
      node,
      changed: false,
      geometryChanged: false,
    };
  }

  const nextData = dataChanged
    ? {
        ...previousData,
        isFocused: patch.isFocused,
        isDimmed: patch.isDimmed,
        nodeWidth: patch.nodeWidth,
        ...(patch.includeTableViewFields
          ? {
              isCompact: patch.isCompact,
              columnsWithHandles: patch.columnsWithHandles,
              handleEdgeTypes: patch.handleEdgeTypes,
            }
          : {}),
      }
    : previousData;

  const geometryChanged =
    positionChanged ||
    hiddenChanged ||
    previousData.nodeWidth !== patch.nodeWidth ||
    (patch.includeTableViewFields && previousData.isCompact !== patch.isCompact);

  return {
    node: {
      ...node,
      position: patch.position,
      hidden: patch.hidden,
      data: nextData,
    },
    changed: true,
    geometryChanged,
  };
}
