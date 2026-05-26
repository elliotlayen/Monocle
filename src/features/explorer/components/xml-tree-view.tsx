import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { parseXml } from "../utils/xml-parser";
import { XmlTreeNode } from "./xml-tree-node";

interface XmlTreeViewProps {
  content: string;
  scrollPosition: number;
  onScrollChange: (position: number) => void;
}

export function XmlTreeView({
  content,
  scrollPosition,
  onScrollChange,
}: XmlTreeViewProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const restoredRef = useRef(false);

  const parseResult = useMemo(() => parseXml(content), [content]);

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
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeKey)) {
        next.delete(nodeKey);
      } else {
        next.add(nodeKey);
      }
      return next;
    });
  }, []);

  if (!parseResult.document) {
    // Should not be rendered when parse fails (FileContentArea handles this)
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
}
