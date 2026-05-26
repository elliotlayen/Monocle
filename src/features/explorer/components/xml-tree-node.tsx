import {
  ChevronRight,
  ChevronDown,
  FileCode,
  Type,
  MessageSquare,
  Hash,
  Braces,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface XmlTreeNodeProps {
  node: Node;
  depth: number;
  nodeKey: string;
  isExpanded: boolean;
  onToggle: (key: string) => void;
  expandedIds: Set<string>;
}

const MAX_INLINE_ATTRIBUTES = 5;

function hasExpandableChildren(node: Node): boolean {
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i];
    // Skip whitespace-only text nodes
    if (child.nodeType === 3 && !child.textContent?.trim()) {
      continue;
    }
    return true;
  }
  return false;
}

function getFilteredChildren(node: Node): Node[] {
  const children: Node[] = [];
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i];
    // Filter out whitespace-only text nodes
    if (child.nodeType === 3 && !child.textContent?.trim()) {
      continue;
    }
    children.push(child);
  }
  return children;
}

function renderElementNode(
  node: Element,
  depth: number,
  nodeKey: string,
  isExpanded: boolean,
  onToggle: (key: string) => void,
  expandedIds: Set<string>
) {
  const hasChildren = hasExpandableChildren(node);
  const attrs = node.attributes;
  const attrCount = attrs.length;
  const shownAttrs = Math.min(attrCount, MAX_INLINE_ATTRIBUTES);
  const overflowCount = attrCount - shownAttrs;

  return (
    <div key={nodeKey}>
      <div
        className={cn(
          "flex items-center gap-1 w-full rounded py-1 hover:bg-muted",
          hasChildren && "cursor-pointer"
        )}
        style={{ paddingLeft: `${depth * 16}px` }}
        onClick={hasChildren ? () => onToggle(nodeKey) : undefined}
      >
        {/* Chevron */}
        {hasChildren ? (
          isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )
        ) : (
          <span className="w-4 flex-shrink-0" />
        )}

        {/* Icon */}
        <FileCode className="h-3.5 w-3.5 flex-shrink-0" />

        {/* Tag name */}
        <span className="text-sm text-foreground">{node.tagName}</span>

        {/* Inline attributes */}
        {shownAttrs > 0 && (
          <span className="flex items-center gap-2 min-w-0">
            {Array.from(attrs)
              .slice(0, shownAttrs)
              .map((attr) => (
                <span key={attr.name} className="flex items-center gap-0">
                  <span className="text-xs text-[oklch(0.55_0.15_250)] dark:text-[oklch(0.72_0.12_250)]">
                    {attr.name}
                  </span>
                  <span className="text-xs text-muted-foreground">=</span>
                  <span className="text-xs text-[oklch(0.55_0.12_150)] dark:text-[oklch(0.72_0.10_150)]">
                    &quot;{attr.value}&quot;
                  </span>
                </span>
              ))}
            {overflowCount > 0 && (
              <span className="text-xs text-muted-foreground">
                +{overflowCount} more
              </span>
            )}
          </span>
        )}
      </div>

      {/* Render children when expanded */}
      {isExpanded &&
        getFilteredChildren(node).map((child, index) => {
          const childKey = `${nodeKey}.${index}`;
          return (
            <XmlTreeNode
              key={childKey}
              node={child}
              depth={depth + 1}
              nodeKey={childKey}
              isExpanded={expandedIds.has(childKey)}
              onToggle={onToggle}
              expandedIds={expandedIds}
            />
          );
        })}
    </div>
  );
}

function renderTextNode(node: Node, depth: number, nodeKey: string) {
  return (
    <div
      key={nodeKey}
      className="flex items-center gap-1 w-full rounded py-1 hover:bg-muted"
      style={{ paddingLeft: `${depth * 16}px` }}
    >
      <span className="w-4 flex-shrink-0" />
      <Type className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
      <span className="text-sm text-foreground truncate max-w-[400px]">
        {node.textContent}
      </span>
    </div>
  );
}

function renderCommentNode(node: Node, depth: number, nodeKey: string) {
  return (
    <div
      key={nodeKey}
      className="flex items-center gap-1 w-full rounded py-1 hover:bg-muted"
      style={{ paddingLeft: `${depth * 16}px` }}
    >
      <span className="w-4 flex-shrink-0" />
      <MessageSquare className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
      <span className="text-sm text-muted-foreground italic truncate max-w-[400px]">
        &lt;!-- {node.textContent} --&gt;
      </span>
    </div>
  );
}

function renderPINode(node: Node, depth: number, nodeKey: string) {
  return (
    <div
      key={nodeKey}
      className="flex items-center gap-1 w-full rounded py-1 hover:bg-muted"
      style={{ paddingLeft: `${depth * 16}px` }}
    >
      <span className="w-4 flex-shrink-0" />
      <Hash className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
      <span className="text-sm text-muted-foreground truncate max-w-[400px]">
        &lt;?{node.nodeName} {node.nodeValue}?&gt;
      </span>
    </div>
  );
}

function renderCDATANode(node: Node, depth: number, nodeKey: string) {
  return (
    <div
      key={nodeKey}
      className="flex items-center gap-1 w-full rounded py-1 hover:bg-muted"
      style={{ paddingLeft: `${depth * 16}px` }}
    >
      <span className="w-4 flex-shrink-0" />
      <Braces className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
      <span className="text-sm truncate max-w-[400px] text-[oklch(0.55_0.08_60)] dark:text-[oklch(0.72_0.06_60)]">
        &lt;![CDATA[{node.textContent}]]&gt;
      </span>
    </div>
  );
}

export function XmlTreeNode({
  node,
  depth,
  nodeKey,
  isExpanded,
  onToggle,
  expandedIds,
}: XmlTreeNodeProps) {
  switch (node.nodeType) {
    case 1: // Element
      return renderElementNode(
        node as Element,
        depth,
        nodeKey,
        isExpanded,
        onToggle,
        expandedIds
      );
    case 3: // Text
      return renderTextNode(node, depth, nodeKey);
    case 4: // CDATA Section
      return renderCDATANode(node, depth, nodeKey);
    case 7: // Processing Instruction
      return renderPINode(node, depth, nodeKey);
    case 8: // Comment
      return renderCommentNode(node, depth, nodeKey);
    default:
      return null;
  }
}
