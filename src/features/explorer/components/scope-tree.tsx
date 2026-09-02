import { useShallow } from "zustand/shallow";
import { ChevronRight, Folder, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useExplorerStore } from "../store";
import { isPathInScope } from "../store/selectors";
import type { TreeNode } from "../types";

/**
 * Compact checkbox tree for picking the search scope. Folders only; drills
 * to any depth (loading lazily) and checking a parent covers its subtree.
 */
export function ScopeTree() {
  const {
    folderSources,
    searchSourceId,
    treeNodes,
    expandedIds,
    activeOperations,
    scopePaths,
  } = useExplorerStore(
    useShallow((state) => ({
      folderSources: state.folderSources,
      searchSourceId: state.searchSourceId,
      treeNodes: state.treeNodes,
      expandedIds: state.expandedIds,
      activeOperations: state.activeOperations,
      scopePaths: state.scopePaths,
    }))
  );

  const activeSource =
    folderSources.find((s) => s.id === searchSourceId) ?? folderSources[0];
  const root = activeSource ? treeNodes.get(activeSource.id) : undefined;

  if (!activeSource || !root) {
    return (
      <p className="px-3 py-4 text-center text-xs text-muted-foreground">
        No folder source configured.
      </p>
    );
  }

  const handleToggleExpand = (node: TreeNode) => {
    const store = useExplorerStore.getState();
    if (expandedIds.has(node.id)) {
      store.collapseNode(node.id);
    } else {
      void store.expandNode(node.id);
    }
  };

  const renderFolder = (node: TreeNode, depth: number): React.ReactNode => {
    const checked = scopePaths.has(node.path);
    const covered =
      !checked && scopePaths.size > 0 && isPathInScope(scopePaths, node.path);
    const open = expandedIds.has(node.id);
    const loading = activeOperations.has(node.id);
    const childFolders = (node.children ?? []).filter((c) => c.isDir);

    return (
      <div key={node.id}>
        <div
          className="flex items-center gap-1.5 rounded-md py-1 pr-2 transition-colors duration-[var(--duration-fast)] hover:bg-muted"
          style={{ paddingLeft: `${6 + depth * 14}px` }}
        >
          <input
            type="checkbox"
            className="h-3.5 w-3.5 flex-shrink-0 accent-[var(--accent-blue)]"
            checked={checked || covered}
            disabled={covered}
            aria-label={`Scope ${node.name}`}
            onChange={() =>
              useExplorerStore.getState().toggleScopePath(node.path)
            }
          />
          <button
            type="button"
            className="flex h-4 w-4 flex-shrink-0 items-center justify-center text-muted-foreground"
            aria-label={open ? `Collapse ${node.name}` : `Expand ${node.name}`}
            onClick={() => handleToggleExpand(node)}
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ChevronRight
                className={cn(
                  "h-3 w-3 transition-transform duration-[var(--duration-fast)] ease-[var(--ease-out)]",
                  open && "rotate-90"
                )}
              />
            )}
          </button>
          <Folder className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
          <button
            type="button"
            className="min-w-0 flex-1 truncate text-left text-xs"
            onClick={() => handleToggleExpand(node)}
            title={node.path}
          >
            {node.name}
          </button>
        </div>
        {open &&
          childFolders.map((child) =>
            renderFolder(treeNodes.get(child.id) ?? child, depth + 1)
          )}
        {open && node.loadState === "loaded" && childFolders.length === 0 && (
          <p
            className="py-0.5 text-[10px] text-muted-foreground"
            style={{ paddingLeft: `${6 + (depth + 1) * 14 + 22}px` }}
          >
            No subfolders
          </p>
        )}
      </div>
    );
  };

  const rootFolders = (root.children ?? []).filter((c) => c.isDir);

  return (
    <div className="max-h-72 overflow-y-auto p-1.5">
      {root.loadState === "idle" || root.loadState === "loading" ? (
        <RootLoader rootId={root.id} loading={root.loadState === "loading"} />
      ) : rootFolders.length === 0 ? (
        <p className="px-3 py-4 text-center text-xs text-muted-foreground">
          {activeSource.label} has no subfolders to scope.
        </p>
      ) : (
        rootFolders.map((child) =>
          renderFolder(treeNodes.get(child.id) ?? child, 0)
        )
      )}
    </div>
  );
}

function RootLoader({ rootId, loading }: { rootId: string; loading: boolean }) {
  if (loading) {
    return (
      <p className="flex items-center justify-center gap-2 px-3 py-4 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading folders...
      </p>
    );
  }
  return (
    <button
      type="button"
      className="w-full rounded-md px-3 py-4 text-center text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
      onClick={() => void useExplorerStore.getState().expandNode(rootId)}
    >
      Load folders
    </button>
  );
}
