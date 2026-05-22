import { useMemo } from "react";
import { useShallow } from "zustand/shallow";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useExplorerStore } from "../store";
import { filterTreeNodes } from "../utils/tree-filter";
import { FolderTreeNode, FolderTreeSourceNode } from "./folder-tree-node";
import type { TreeNode } from "../types";

export function FolderTree() {
  const {
    folderSources,
    treeNodes,
    expandedIds,
    filterText,
    dateSortOrder,
    expandNode,
    collapseNode,
    cancelLoad,
    toggleFavorite,
  } = useExplorerStore(
    useShallow((state) => ({
      folderSources: state.folderSources,
      treeNodes: state.treeNodes,
      expandedIds: state.expandedIds,
      filterText: state.filterText,
      dateSortOrder: state.dateSortOrder,
      expandNode: state.expandNode,
      collapseNode: state.collapseNode,
      cancelLoad: state.cancelLoad,
      toggleFavorite: state.toggleFavorite,
    }))
  );

  // Build visible tree from root nodes in source order
  const rootNodes = useMemo(() => {
    return folderSources
      .map((source) => treeNodes.get(source.id))
      .filter((n): n is TreeNode => n !== undefined);
  }, [folderSources, treeNodes]);

  // Apply date sorting to children of client nodes
  const sortDateChildren = (children: TreeNode[]): TreeNode[] => {
    const dateNodes: TreeNode[] = [];
    const nonDateNodes: TreeNode[] = [];

    for (const child of children) {
      if (child.isDir && /^\d{8}$/.test(child.name)) {
        dateNodes.push(child);
      } else {
        nonDateNodes.push(child);
      }
    }

    dateNodes.sort((a, b) => {
      if (dateSortOrder === "newest") {
        return b.name.localeCompare(a.name);
      }
      return a.name.localeCompare(b.name);
    });

    nonDateNodes.sort((a, b) => a.name.localeCompare(b.name));

    return [...dateNodes, ...nonDateNodes];
  };

  // Sort file children alphabetically
  const sortFileChildren = (children: TreeNode[]): TreeNode[] => {
    return [...children].sort((a, b) => a.name.localeCompare(b.name));
  };

  // Apply filter
  const visibleRoots = useMemo(() => {
    if (!filterText.trim()) return rootNodes;
    return filterTreeNodes(rootNodes, filterText);
  }, [rootNodes, filterText]);

  const renderChildren = (node: TreeNode, depth: number, sourceId: string) => {
    if (!expandedIds.has(node.id) || !node.children) return null;

    let sortedChildren: TreeNode[];

    if (node.type === "source") {
      // Sort clients alphabetically
      sortedChildren = [...node.children]
        .filter((c) => c.isDir || c.type === "file")
        .sort((a, b) => a.name.localeCompare(b.name));
    } else if (node.type === "client") {
      sortedChildren = sortDateChildren(node.children);
    } else if (node.type === "date") {
      sortedChildren = sortFileChildren(node.children);
    } else {
      sortedChildren = node.children;
    }

    // Get favorites for this source
    const source = folderSources.find((s) => s.id === sourceId);
    const favorites = source?.favorites ?? [];
    const hasFavorites = node.type === "source" && favorites.length > 0;

    // Build favorites section for source nodes
    const favoritedChildren = hasFavorites
      ? sortedChildren.filter(
          (child) => child.type === "client" && child.isFavorite
        )
      : [];

    return (
      <div>
        {/* Favorites section */}
        {hasFavorites && favoritedChildren.length > 0 && (
          <div>
            <div
              className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-1"
              style={{ paddingLeft: `${(depth + 1) * 16}px` }}
            >
              Favorites
            </div>
            {favoritedChildren.map((child) => (
              <div key={`fav-${child.id}`}>
                <FolderTreeNode
                  node={child}
                  depth={depth + 1}
                  sourceId={sourceId}
                  isExpanded={expandedIds.has(child.id)}
                  onExpand={expandNode}
                  onCollapse={collapseNode}
                  onCancel={cancelLoad}
                  onToggleFavorite={toggleFavorite}
                />
                {renderChildren(child, depth + 1, sourceId)}
              </div>
            ))}
          </div>
        )}

        {/* All children alphabetically */}
        {sortedChildren.map((child) => (
          <div key={child.id}>
            <FolderTreeNode
              node={child}
              depth={depth + 1}
              sourceId={sourceId}
              isExpanded={expandedIds.has(child.id)}
              onExpand={expandNode}
              onCollapse={collapseNode}
              onCancel={cancelLoad}
              onToggleFavorite={toggleFavorite}
            />
            {renderChildren(child, depth + 1, sourceId)}
          </div>
        ))}
      </div>
    );
  };

  if (folderSources.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-muted-foreground text-center px-4">
          No folder sources configured
        </p>
      </div>
    );
  }

  if (visibleRoots.length === 0 && filterText.trim()) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-muted-foreground text-center px-4">
          No matches found
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-2">
        {visibleRoots.map((root) => {
          const source = folderSources.find((s) => s.id === root.id);
          return (
            <div key={root.id} className="mb-1">
              <FolderTreeSourceNode
                node={root}
                depth={0}
                sourceId={root.id}
                isExpanded={expandedIds.has(root.id)}
                onExpand={expandNode}
                onCollapse={collapseNode}
                onCancel={cancelLoad}
                onToggleFavorite={toggleFavorite}
                tag={source?.tag}
              />
              {renderChildren(root, 0, root.id)}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
