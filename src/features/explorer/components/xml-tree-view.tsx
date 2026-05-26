import { useMemo, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { parseXml } from "../utils/xml-parser";
import { XmlTreeNode } from "./xml-tree-node";

interface XmlTreeViewProps {
  content: string;
  scrollPosition: number;
  onScrollChange: (position: number) => void;
  expandedIds: Set<string>;
  onExpandedIdsChange: (ids: Set<string>) => void;
}

export interface XmlTreeViewHandle {
  expandAll: () => void;
  collapseAll: () => void;
}

function collectExpandableKeys(node: Node, key: string, keys: string[]) {
  let hasVisibleChild = false;
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i];
    if (child.nodeType === 3 && !child.textContent?.trim()) continue;
    hasVisibleChild = true;
  }
  if (hasVisibleChild) keys.push(key);

  let childIndex = 0;
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i];
    if (child.nodeType === 3 && !child.textContent?.trim()) continue;
    collectExpandableKeys(child, `${key}.${childIndex}`, keys);
    childIndex++;
  }
}

export const XmlTreeView = forwardRef<XmlTreeViewHandle, XmlTreeViewProps>(function XmlTreeView({
  content,
  scrollPosition,
  onScrollChange,
  expandedIds,
  onExpandedIdsChange,
}, ref) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const restoredRef = useRef(false);

  const parseResult = useMemo(() => parseXml(content), [content]);

  useImperativeHandle(ref, () => ({
    expandAll() {
      if (!parseResult.document) return;
      const keys: string[] = [];
      collectExpandableKeys(parseResult.document.documentElement, "0", keys);
      onExpandedIdsChange(new Set(keys));
    },
    collapseAll() {
      onExpandedIdsChange(new Set());
    },
  }), [parseResult, onExpandedIdsChange]);

  // Restore scroll position on mount
  useEffect(() => {
    if (scrollRef.current && scrollPosition > 0 && !restoredRef.current) {
      const viewport = scrollRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (viewport) {
        viewport.scrollTop = scrollPosition;
      }
      restoredRef.current = true;
    }
  }, [scrollPosition]);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.target as HTMLDivElement;
      onScrollChange(target.scrollTop);
    },
    [onScrollChange]
  );

  const toggleNode = useCallback((nodeKey: string) => {
    onExpandedIdsChange((() => {
      const next = new Set(expandedIds);
      if (next.has(nodeKey)) {
        next.delete(nodeKey);
      } else {
        next.add(nodeKey);
      }
      return next;
    })());
  }, [expandedIds, onExpandedIdsChange]);

  if (!parseResult.document) {
    return null;
  }

  const doc = parseResult.document;
  const rootElement = doc.documentElement;

  return (
    <ScrollArea
      ref={scrollRef}
      className="flex-1 overflow-auto p-2"
      onScrollCapture={handleScroll}
    >
      <XmlTreeNode
        node={rootElement}
        depth={0}
        nodeKey="0"
        isExpanded={expandedIds.has("0")}
        onToggle={toggleNode}
        expandedIds={expandedIds}
      />
    </ScrollArea>
  );
});
