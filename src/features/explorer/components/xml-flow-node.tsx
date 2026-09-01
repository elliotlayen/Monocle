import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Braces,
  ChevronDown,
  ChevronRight,
  FileCode,
  Hash,
  MessageSquare,
  Type,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { VisibleXmlNode, XmlNodeKind } from "../utils/xml-tree-model";
import { XML_NODE_HEIGHT, XML_NODE_WIDTH } from "../utils/xml-tree-layout";

const MAX_INLINE_ATTRIBUTES = 3;

export interface XmlFlowNodeData {
  xml: VisibleXmlNode;
  compact: boolean;
  onToggle: (id: string) => void;
  [key: string]: unknown;
}

const KIND_ICONS: Record<XmlNodeKind, React.ReactNode> = {
  element: <FileCode className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />,
  text: <Type className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />,
  cdata: <Braces className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />,
  pi: <Hash className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />,
  comment: (
    <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
  ),
  other: <Hash className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />,
};

function labelClass(kind: XmlNodeKind): string {
  switch (kind) {
    case "element":
      return "text-accent-blue";
    case "text":
      return "text-foreground";
    case "comment":
      return "italic text-muted-foreground";
    default:
      return "text-muted-foreground";
  }
}

function XmlFlowNodeComponent({ data }: NodeProps) {
  const { xml, compact, onToggle } = data as unknown as XmlFlowNodeData;
  const toggleable = xml.kind === "element" && xml.hasChildren;
  const shownAttrs = compact ? 0 : xml.attrs.slice(0, MAX_INLINE_ATTRIBUTES);
  const overflow = compact
    ? 0
    : xml.attrs.length - Math.min(xml.attrs.length, MAX_INLINE_ATTRIBUTES);

  return (
    <div
      style={{ width: XML_NODE_WIDTH, height: XML_NODE_HEIGHT }}
      className={cn(
        "relative flex items-center gap-1.5 overflow-hidden rounded-lg border border-border bg-card px-2.5 text-xs",
        "transition-shadow duration-200",
        toggleable && "cursor-pointer hover:shadow-md"
      )}
      onClick={toggleable ? () => onToggle(xml.id) : undefined}
      title={xml.label}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-0 !w-0 !border-0 !bg-transparent"
        style={{ left: 0, top: "50%" }}
        isConnectable={false}
      />
      {toggleable ? (
        xml.isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )
      ) : (
        KIND_ICONS[xml.kind]
      )}
      <span className={cn("truncate font-medium", labelClass(xml.kind))}>
        {xml.kind === "element" ? xml.label : xml.label || " "}
      </span>
      {shownAttrs !== 0 &&
        shownAttrs.map((attr) => (
          <span
            key={attr.name}
            className="flex min-w-0 shrink items-center text-[10px]"
          >
            <span className="text-object-functions">{attr.name}</span>
            <span className="text-muted-foreground">=</span>
            <span className="truncate text-success">
              &quot;{attr.value}&quot;
            </span>
          </span>
        ))}
      {overflow > 0 && (
        <span className="shrink-0 text-[10px] text-muted-foreground">
          +{overflow}
        </span>
      )}
      {!xml.isExpanded && xml.hasChildren && (
        <span className="ml-auto shrink-0 rounded-full bg-accent-blue/15 px-1.5 py-0.5 text-[10px] font-medium text-accent-blue">
          +{xml.childCount}
        </span>
      )}
      <Handle
        type="source"
        position={Position.Right}
        className="!h-0 !w-0 !border-0 !bg-transparent"
        style={{ right: 0, top: "50%" }}
        isConnectable={false}
      />
    </div>
  );
}

export const XmlFlowNode = memo(XmlFlowNodeComponent);
