import { useCallback, useMemo } from "react";
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
    lastInteractedFolderPath,
    searchMode,
    searchCheckedPaths,
    toggleSearchCheck,
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
      lastInteractedFolderPath: state.lastInteractedFolderPath,
      searchMode: state.searchMode,
      searchCheckedPaths: state.searchCheckedPaths,
      toggleSearchCheck: state.toggleSearchCheck,
    }))
  );

  const handleFileClick = useCallback((filePath: string) => {
    useExplorerStore.getState().openFile(filePath);
  }, []);

  // Build visible tree from root nodes in source order
  const rootNodes = useMemo(() => {
    return folderSources
      .map((source) => treeNodes.get(source.id))
      .filter((n): n is TreeNode => n !== undefined);
  }, [folderSources, treeNodes]);

  // Apply filter
  const visibleRoots = useMemo(() => {
    if (!filterText.trim()) return rootNodes;
    return filterTreeNodes(rootNodes, filterText);
  }, [rootNodes, filterText]);

  const selectedFolderPath = searchMode === "content" ? lastInteractedFolderPath : null;
  const showCheckboxes = searchMode === "content";

  const isPathChecked = useCallback(
    (path: string) => {
      if (searchCheckedPaths.has(path)) return true;
      for (const checked of searchCheckedPaths) {
        if (path.startsWith(checked + "/") || path.startsWith(checked + "\\")) return true;
      }
      return false;
    },
    [searchCheckedPaths]
  );

  const renderChildren = (node: TreeNode, depth: number, sourceId: string) => {
    const current = treeNodes.get(node.id) ?? node;
    if (!expandedIds.has(current.id) || !current.children) return null;

    const sortedChildren = current.children
      .map((child) => treeNodes.get(child.id) ?? child)
      .sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        // Apply dateSortOrder to 8-digit date-pattern folder names (YYYYMMDD)
        if (a.isDir && b.isDir && /^\d{8}$/.test(a.name) && /^\d{8}$/.test(b.name)) {
          return dateSortOrder === "newest"
            ? b.name.localeCompare(a.name)
            : a.name.localeCompare(b.name);
        }
        return a.name.localeCompare(b.name);
      });

    // Get favorites for this source — collect from all depths
    const source = folderSources.find((s) => s.id === sourceId);
    const favorites = source?.favorites ?? [];
    const hasFavorites = node.type === "source" && favorites.length > 0;

    const favoritedNodes: TreeNode[] = [];
    if (hasFavorites) {
      for (const favPath of favorites) {
        const favNode = treeNodes.get(favPath);
        if (favNode) favoritedNodes.push(favNode);
      }
      favoritedNodes.sort((a, b) => a.name.localeCompare(b.name));
    }

    // Direct children that are favorited (to exclude from main list)
    const favoritedChildIds = new Set(favoritedNodes.map((n) => n.id));

    return (
      <div>
        {/* Favorites section */}
        {hasFavorites && favoritedNodes.length > 0 && (
          <div>
            <div
              className="text-xs font-semibold text-muted-foreground uppercase tracking-wide py-1"
              style={{ paddingLeft: `${(depth + 1) * 16}px` }}
            >
              Favorites
            </div>
            {favoritedNodes.map((favNode) => (
              <div key={`fav-${favNode.id}`}>
                <FolderTreeNode
                  node={favNode}
                  depth={depth + 1}
                  sourceId={sourceId}
                  isExpanded={expandedIds.has(favNode.id)}
                  onExpand={expandNode}
                  onCollapse={collapseNode}
                  onCancel={cancelLoad}
                  onToggleFavorite={toggleFavorite}
                  onFileClick={handleFileClick}
                  selectedFolderPath={selectedFolderPath}
                  showCheckbox={showCheckboxes}
                  isChecked={isPathChecked(favNode.path)}
                  onToggleCheck={toggleSearchCheck}
                />
                {renderChildren(favNode, depth + 1, sourceId)}
              </div>
            ))}
          </div>
        )}

        {/* All children alphabetically (exclude favorites already shown above) */}
        {sortedChildren.filter((child) => !favoritedChildIds.has(child.id)).map((child) => (
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
              onFileClick={handleFileClick}
              selectedFolderPath={selectedFolderPath}
              showCheckbox={showCheckboxes}
              isChecked={isPathChecked(child.path)}
              onToggleCheck={toggleSearchCheck}
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
                onFileClick={handleFileClick}
                tag={source?.tag}
                showCheckbox={showCheckboxes}
                isChecked={isPathChecked(root.path ?? root.id)}
                onToggleCheck={toggleSearchCheck}
              />
              {renderChildren(root, 0, root.id)}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
