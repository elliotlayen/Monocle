import type { TreeNode, ValidationProblem, ValidationStatus } from "../types";

export interface FilterTreeOptions {
  showIssuesOnly?: boolean;
  validationCache?: Map<
    string,
    { problems: ValidationProblem[] }
  >;
  folderBadgeCache?: Map<string, ValidationStatus>;
}

export function filterTreeNodes(
  nodes: TreeNode[],
  filter: string,
  options?: FilterTreeOptions
): TreeNode[] {
  const { showIssuesOnly, validationCache, folderBadgeCache } = options ?? {};

  // Apply text filter first
  let result = nodes;
  if (filter && filter.trim()) {
    const lowerFilter = filter.toLowerCase();
    result = filterByText(result, lowerFilter);
  }

  // Apply issues-only filter
  if (showIssuesOnly) {
    result = filterByIssues(result, validationCache, folderBadgeCache);
  }

  return result;
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

function filterByIssues(
  nodes: TreeNode[],
  validationCache?: Map<string, { problems: ValidationProblem[] }>,
  folderBadgeCache?: Map<string, ValidationStatus>
): TreeNode[] {
  // If neither cache has any data, pass through everything (no data = no filter)
  if (
    (!validationCache || validationCache.size === 0) &&
    (!folderBadgeCache || folderBadgeCache.size === 0)
  ) {
    return nodes;
  }

  return nodes.reduce<TreeNode[]>((result, node) => {
    if (node.isDir) {
      // Folder node: check badge cache for issues
      const badge = folderBadgeCache?.get(node.path);
      if (badge === "error" || badge === "warning") {
        result.push(node);
        return result;
      }

      // Recursively check children
      if (node.children) {
        const filteredChildren = filterByIssues(
          node.children,
          validationCache,
          folderBadgeCache
        );
        if (filteredChildren.length > 0) {
          result.push({ ...node, children: filteredChildren });
          return result;
        }
      }

      // Node has no validation data in its subtree -- pass through
      if (!subtreeHasValidationData(node, validationCache, folderBadgeCache)) {
        result.push(node);
        return result;
      }

      // Subtree has validation data but no issues -- filter out
      return result;
    }

    // File node: check validation cache for problems
    const cached = validationCache?.get(node.path);
    if (cached && cached.problems.length > 0) {
      result.push(node);
      return result;
    }

    // File has no validation data -- pass through
    if (!cached) {
      result.push(node);
      return result;
    }

    // File was scanned but has no issues -- filter out
    return result;
  }, []);
}

/**
 * Returns true if any node in the subtree has validation data
 * (i.e., is present in either cache).
 */
function subtreeHasValidationData(
  node: TreeNode,
  validationCache?: Map<string, { problems: ValidationProblem[] }>,
  folderBadgeCache?: Map<string, ValidationStatus>
): boolean {
  // Check self
  if (folderBadgeCache?.has(node.path)) return true;
  if (validationCache?.has(node.path)) return true;

  // Check children
  if (node.children) {
    for (const child of node.children) {
      if (subtreeHasValidationData(child, validationCache, folderBadgeCache)) {
        return true;
      }
    }
  }

  return false;
}
