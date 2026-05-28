import type { TreeNode } from "../types";

export function filterTreeNodes(
  nodes: TreeNode[],
  filter: string
): TreeNode[] {
  if (!filter || !filter.trim()) return nodes;

  const lowerFilter = filter.toLowerCase();
  return filterByText(nodes, lowerFilter);
}

function filterByText(nodes: TreeNode[], lowerFilter: string): TreeNode[] {
  return nodes.reduce<TreeNode[]>((result, node) => {
    const nameMatches = node.name.toLowerCase().includes(lowerFilter);

    if (nameMatches) {
      result.push(node);
      return result;
    }

    // Check children if they are loaded (not null)
    if (node.children) {
      const filteredChildren = filterByText(node.children, lowerFilter);
      if (filteredChildren.length > 0) {
        result.push({ ...node, children: filteredChildren });
      }
    }

    return result;
  }, []);
}
