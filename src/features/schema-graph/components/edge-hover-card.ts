import { type Edge } from "@xyflow/react";

export interface EdgeHoverEndpoint {
  objectId: string;
  column?: string;
}

export interface EdgeHoverCardContent {
  title?: string;
  from: EdgeHoverEndpoint;
  to: EdgeHoverEndpoint;
}

interface EdgeHoverData {
  edgeLabel?: unknown;
  sourceColumn?: unknown;
  targetColumn?: unknown;
}

function normalizeText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function buildEdgeHoverCardContent(edge: Edge): EdgeHoverCardContent {
  const edgeData = (edge.data as EdgeHoverData | undefined) ?? {};
  const title = normalizeText(edgeData.edgeLabel);
  const sourceColumn = normalizeText(edgeData.sourceColumn);
  const targetColumn = normalizeText(edgeData.targetColumn);

  return {
    title,
    from: {
      objectId: edge.source,
      column: sourceColumn,
    },
    to: {
      objectId: edge.target,
      column: targetColumn,
    },
  };
}
