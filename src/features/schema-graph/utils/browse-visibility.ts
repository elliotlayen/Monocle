import type { SchemaIndex } from "@/lib/schema-index";

/**
 * The set of node IDs visible in browse mode: the focus roots, their direct
 * neighbors, and the direct neighbors of every expanded node that is itself
 * visible. Returns null when browse mode is not active (everything visible).
 */
export function computeBrowseVisibleIds(
  viewMode: "full" | "browse",
  focusRoots: Set<string>,
  expandedNodeIds: Set<string>,
  schemaIndex: SchemaIndex
): Set<string> | null {
  if (viewMode !== "browse") return null;

  const visible = new Set<string>();
  for (const root of focusRoots) {
    visible.add(root);
    for (const neighbor of schemaIndex.neighbors.get(root) ?? []) {
      visible.add(neighbor);
    }
  }

  // Expansions only apply while their node is visible; iterate to a fixpoint
  // so chained expansions resolve regardless of set order.
  const pending = new Set(expandedNodeIds);
  let changed = true;
  while (changed && pending.size > 0) {
    changed = false;
    for (const id of [...pending]) {
      if (!visible.has(id)) continue;
      pending.delete(id);
      for (const neighbor of schemaIndex.neighbors.get(id) ?? []) {
        if (!visible.has(neighbor)) {
          visible.add(neighbor);
          changed = true;
        }
      }
    }
  }

  return visible;
}

/**
 * Count how many of a node's direct neighbors are outside the visible set —
 * the "+N" expansion affordance on boundary nodes.
 */
export function countHiddenNeighbors(
  nodeId: string,
  visibleIds: Set<string>,
  neighbors: Map<string, Set<string>>
): number {
  let hidden = 0;
  for (const neighbor of neighbors.get(nodeId) ?? []) {
    if (!visibleIds.has(neighbor)) hidden += 1;
  }
  return hidden;
}
