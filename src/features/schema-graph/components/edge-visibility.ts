import { parseHandleBase } from "@/features/schema-graph/utils/handle-ids";

export interface EdgeHandleRef {
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

function stripHandleSuffix(handleId: string): string {
  return handleId.replace(/-source$/, "").replace(/-target$/, "");
}

export function isHandleRenderable(
  handleId: string | undefined,
  renderableNodeIds: Set<string>,
  columnsByNodeId: Map<string, Set<string>>
): boolean {
  if (!handleId) return true;
  const parsed = parseHandleBase(stripHandleSuffix(handleId));
  if (!renderableNodeIds.has(parsed.nodeId)) return false;
  if (!parsed.columnName) return true;
  const knownColumns = columnsByNodeId.get(parsed.nodeId);
  return knownColumns?.has(parsed.columnName) ?? false;
}

export function isEdgeRenderable(
  edge: EdgeHandleRef,
  renderableNodeIds: Set<string>,
  columnsByNodeId: Map<string, Set<string>>
): boolean {
  if (!renderableNodeIds.has(edge.source) || !renderableNodeIds.has(edge.target)) {
    return false;
  }
  return (
    isHandleRenderable(edge.sourceHandle, renderableNodeIds, columnsByNodeId) &&
    isHandleRenderable(edge.targetHandle, renderableNodeIds, columnsByNodeId)
  );
}
