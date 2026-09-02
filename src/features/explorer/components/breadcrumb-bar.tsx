import { useMemo, useState } from "react";
import { useShallow } from "zustand/shallow";
import {
  ChevronRight,
  FileCode,
  FileText,
  Folder,
  FolderSync,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useExplorerStore } from "../store";
import type { FolderSource, TreeNode } from "../types";

interface Segment {
  /** Node id: source id for the root segment, absolute path otherwise. */
  id: string;
  path: string;
  name: string;
  isFile: boolean;
}

function findSource(
  sources: FolderSource[],
  filePath: string
): FolderSource | undefined {
  return sources.find(
    (s) =>
      filePath === s.path ||
      filePath.startsWith(s.path + "/") ||
      filePath.startsWith(s.path + "\\")
  );
}

function buildSegments(source: FolderSource, filePath: string): Segment[] {
  const sep = source.path.includes("\\") ? "\\" : "/";
  const segments: Segment[] = [
    { id: source.id, path: source.path, name: source.label, isFile: false },
  ];
  if (filePath !== source.path) {
    const parts = filePath.slice(source.path.length + 1).split(/[/\\]/);
    let current = source.path;
    for (let i = 0; i < parts.length; i++) {
      current = current + sep + parts[i];
      segments.push({
        id: current,
        path: current,
        name: parts[i],
        isFile: i === parts.length - 1,
      });
    }
  }
  return segments;
}

function SiblingIcon({ node }: { node: TreeNode }) {
  if (node.type === "source")
    return <FolderSync className="h-3.5 w-3.5 flex-shrink-0" />;
  if (node.isDir)
    return (
      <Folder className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
    );
  if (node.name.toLowerCase().endsWith(".xml"))
    return <FileCode className="h-3.5 w-3.5 flex-shrink-0" />;
  return (
    <FileText className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
  );
}

interface BreadcrumbBarProps {
  /** Right-aligned action cluster (format, copy, view toggle, ...). */
  actions?: React.ReactNode;
}

/**
 * Path context for the active tab: Source label > folder > ... > file.
 * Each segment opens a sibling picker; folders reveal in the tree,
 * files open in a tab. File actions share this line to save vertical space.
 */
export function BreadcrumbBar({ actions }: BreadcrumbBarProps) {
  const { tabs, activeTabId, folderSources, treeNodes } = useExplorerStore(
    useShallow((state) => ({
      tabs: state.tabs,
      activeTabId: state.activeTabId,
      folderSources: state.folderSources,
      treeNodes: state.treeNodes,
    }))
  );

  const [openSegment, setOpenSegment] = useState<number | null>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const source =
    activeTab && !activeTab.isScanResult
      ? findSource(folderSources, activeTab.filePath)
      : undefined;

  const segments = useMemo(
    () =>
      source && activeTab ? buildSegments(source, activeTab.filePath) : [],
    [source, activeTab]
  );

  if (!activeTab || activeTab.isScanResult) {
    return null;
  }
  if (segments.length === 0 && !actions) {
    return null;
  }

  const siblingsFor = (index: number): TreeNode[] => {
    if (index === 0) {
      // Root segment: the other sources.
      return folderSources
        .map((s) => treeNodes.get(s.id))
        .filter((n): n is TreeNode => n !== undefined);
    }
    const parent = treeNodes.get(segments[index - 1].id);
    if (!parent?.children) return [];
    return parent.children
      .map((c) => treeNodes.get(c.id) ?? c)
      .sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  };

  const handleSegmentOpen = (index: number, open: boolean) => {
    setOpenSegment(open ? index : null);
    if (!open || index === 0) return;
    // Lazily load the parent folder so the sibling list has content.
    const parent = useExplorerStore
      .getState()
      .treeNodes.get(segments[index - 1].id);
    if (parent && parent.isDir && parent.loadState === "idle") {
      useExplorerStore.getState().expandNode(parent.id);
    }
  };

  const handleSiblingClick = (node: TreeNode) => {
    setOpenSegment(null);
    const store = useExplorerStore.getState();
    if (node.isDir) {
      store.revealPath(node.path);
    } else {
      store.setSelectedPath(node.path);
      store.openFile(node.path);
    }
  };

  return (
    <div className="flex h-8 flex-shrink-0 items-center gap-2 border-b px-3 text-xs text-muted-foreground">
      <div
        className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto"
        aria-label="File path"
      >
        {segments.map((segment, index) => (
          <span key={segment.id} className="flex items-center gap-0.5">
            {index > 0 && (
              <ChevronRight className="h-3 w-3 flex-shrink-0 opacity-60" />
            )}
            <Popover
              open={openSegment === index}
              onOpenChange={(open) => handleSegmentOpen(index, open)}
            >
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    "rounded px-1 py-0.5 hover:bg-muted hover:text-foreground truncate max-w-48",
                    segment.isFile && "text-foreground"
                  )}
                >
                  {segment.name}
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-64 p-1">
                <div className="max-h-72 overflow-y-auto">
                  {siblingsFor(index).length === 0 ? (
                    <p className="px-2 py-1.5 text-xs text-muted-foreground">
                      Loading...
                    </p>
                  ) : (
                    siblingsFor(index).map((node) => (
                      <button
                        key={node.id}
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-muted",
                          node.id === segment.id && "bg-accent"
                        )}
                        onClick={() => handleSiblingClick(node)}
                      >
                        <SiblingIcon node={node} />
                        <span className="truncate">{node.name}</span>
                      </button>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </span>
        ))}
      </div>
      {actions && (
        <div className="flex flex-shrink-0 items-center">{actions}</div>
      )}
    </div>
  );
}
