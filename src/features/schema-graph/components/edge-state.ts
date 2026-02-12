import { type Edge, MarkerType } from "@xyflow/react";
import { type EdgeType } from "../store";
import { isEdgeRenderable } from "./edge-visibility";

export interface EdgeMeta {
  id: string;
  type: EdgeType;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  sourceColumn?: string;
  targetColumn?: string;
}

const EDGE_STYLE: Record<
  EdgeType,
  {
    base: string;
    dimmed: string;
    selected: string;
    label: string;
    labelDimmed: string;
    labelSelected: string;
  }
> = {
  relationships: {
    base: "#3b82f6",
    dimmed: "#93c5fd",
    selected: "#2563eb",
    label: "#2563eb",
    labelDimmed: "#93c5fd",
    labelSelected: "#1d4ed8",
  },
  triggerDependencies: {
    base: "#f59e0b",
    dimmed: "#fcd34d",
    selected: "#d97706",
    label: "#b45309",
    labelDimmed: "#fcd34d",
    labelSelected: "#92400e",
  },
  triggerWrites: {
    base: "#ef4444",
    dimmed: "#fca5a5",
    selected: "#dc2626",
    label: "#dc2626",
    labelDimmed: "#fca5a5",
    labelSelected: "#991b1b",
  },
  procedureReads: {
    base: "#8b5cf6",
    dimmed: "#c4b5fd",
    selected: "#7c3aed",
    label: "#7c3aed",
    labelDimmed: "#c4b5fd",
    labelSelected: "#5b21b6",
  },
  procedureWrites: {
    base: "#ef4444",
    dimmed: "#fca5a5",
    selected: "#dc2626",
    label: "#dc2626",
    labelDimmed: "#fca5a5",
    labelSelected: "#991b1b",
  },
  viewDependencies: {
    base: "#10b981",
    dimmed: "#6ee7b7",
    selected: "#059669",
    label: "#047857",
    labelDimmed: "#6ee7b7",
    labelSelected: "#065f46",
  },
  functionReads: {
    base: "#06b6d4",
    dimmed: "#67e8f9",
    selected: "#0891b2",
    label: "#0891b2",
    labelDimmed: "#67e8f9",
    labelSelected: "#155e75",
  },
};

export interface EdgeStateInput {
  edges: EdgeMeta[];
  edgeTypeFilter?: Set<EdgeType>;
  renderableNodeIds: Set<string>;
  columnsByNodeId: Map<string, Set<string>>;
  focusedTableId?: string | null;
  selectedEdgeIds: Set<string>;
  hoveredEdgeId: string | null;
  showLabels: boolean;
  showInlineLabelOnHover: boolean;
  previousHandleEdgeTypes?: Map<string, Set<EdgeType>>;
}

export interface EdgeStateResult {
  edges: Edge[];
  handleEdgeTypes: Map<string, Set<EdgeType>>;
  visibleEdgeIds: Set<string>;
}

function getStyleValue(
  edge: Edge,
  key: "stroke" | "strokeWidth" | "opacity"
): string | number | undefined {
  const style = edge.style as Record<string, unknown> | undefined;
  const value = style?.[key];
  return typeof value === "string" || typeof value === "number"
    ? value
    : undefined;
}

export function areEdgesEquivalent(current: Edge[], next: Edge[]): boolean {
  if (current === next) return true;
  if (current.length !== next.length) return false;

  for (let i = 0; i < current.length; i += 1) {
    const currentEdge = current[i];
    const nextEdge = next[i];
    if (
      currentEdge.id !== nextEdge.id ||
      currentEdge.source !== nextEdge.source ||
      currentEdge.target !== nextEdge.target ||
      currentEdge.sourceHandle !== nextEdge.sourceHandle ||
      currentEdge.targetHandle !== nextEdge.targetHandle ||
      currentEdge.label !== nextEdge.label ||
      getStyleValue(currentEdge, "stroke") !== getStyleValue(nextEdge, "stroke") ||
      getStyleValue(currentEdge, "strokeWidth") !==
        getStyleValue(nextEdge, "strokeWidth") ||
      getStyleValue(currentEdge, "opacity") !== getStyleValue(nextEdge, "opacity")
    ) {
      return false;
    }
  }

  return true;
}

function areHandleEdgeTypesEquivalent(
  current: Map<string, Set<EdgeType>>,
  next: Map<string, Set<EdgeType>>
): boolean {
  if (current === next) return true;
  if (current.size !== next.size) return false;

  for (const [handleId, nextTypes] of next.entries()) {
    const currentTypes = current.get(handleId);
    if (!currentTypes || currentTypes.size !== nextTypes.size) {
      return false;
    }
    for (const type of nextTypes.values()) {
      if (!currentTypes.has(type)) {
        return false;
      }
    }
  }

  return true;
}

export function deriveEdgeState({
  edges,
  edgeTypeFilter,
  renderableNodeIds,
  columnsByNodeId,
  focusedTableId,
  selectedEdgeIds,
  hoveredEdgeId,
  showLabels,
  showInlineLabelOnHover,
  previousHandleEdgeTypes,
}: EdgeStateInput): EdgeStateResult {
  const nextHandleEdgeTypes = new Map<string, Set<EdgeType>>();
  const visibleEdgeIds = new Set<string>();
  const addHandle = (handleId: string | undefined, type: EdgeType) => {
    if (!handleId) return;
    if (!nextHandleEdgeTypes.has(handleId)) {
      nextHandleEdgeTypes.set(handleId, new Set());
    }
    nextHandleEdgeTypes.get(handleId)!.add(type);
  };

  const isFocusActive = Boolean(focusedTableId);
  const nextEdges: Edge[] = [];

  for (const edge of edges) {
    const typeVisible = !edgeTypeFilter || edgeTypeFilter.has(edge.type);
    const isVisible =
      typeVisible && isEdgeRenderable(edge, renderableNodeIds, columnsByNodeId);
    if (!isVisible) continue;

    visibleEdgeIds.add(edge.id);
    addHandle(edge.sourceHandle, edge.type);
    addHandle(edge.targetHandle, edge.type);

    const isDimmed =
      isFocusActive &&
      edge.source !== focusedTableId &&
      edge.target !== focusedTableId;
    const isFocused = isFocusActive && !isDimmed;
    const isSelected = !isFocusActive && selectedEdgeIds.has(edge.id);

    const colors = EDGE_STYLE[edge.type];
    const stroke = isSelected
      ? colors.selected
      : isDimmed
        ? colors.dimmed
        : colors.base;
    const strokeWidth = isSelected ? 4 : isFocused ? 3 : isDimmed ? 1 : 2;
    const labelColor = isSelected
      ? colors.labelSelected
      : isDimmed
        ? colors.labelDimmed
        : colors.label;
    const isHovered = hoveredEdgeId === edge.id;
    const shouldShowLabel =
      (showLabels || isSelected || (showInlineLabelOnHover && isHovered)) &&
      !isDimmed;
    const label = shouldShowLabel ? edge.label : undefined;

    nextEdges.push({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      type: "smoothstep",
      interactionWidth: 16,
      data: {
        edgeType: edge.type,
        sourceColumn: edge.sourceColumn,
        targetColumn: edge.targetColumn,
        edgeLabel: edge.label,
      },
      style: {
        stroke,
        strokeWidth,
        opacity: isDimmed ? 0.4 : 1,
        cursor: isFocusActive ? "default" : "pointer",
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: stroke,
      },
      label,
      labelStyle: label
        ? {
            fontSize: 10,
            fill: labelColor,
          }
        : undefined,
      labelBgStyle: label
        ? {
            fill: "#ffffff",
            fillOpacity: 0.8,
          }
        : undefined,
    });
  }

  const handleEdgeTypes =
    previousHandleEdgeTypes &&
    areHandleEdgeTypesEquivalent(previousHandleEdgeTypes, nextHandleEdgeTypes)
      ? previousHandleEdgeTypes
      : nextHandleEdgeTypes;

  return { edges: nextEdges, handleEdgeTypes, visibleEdgeIds };
}
