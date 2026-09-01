import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Braces,
  FileCode,
  Hash,
  MessageSquare,
  Type,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { VisibleXmlNode, XmlNodeKind } from "../utils/xml-tree-model";
import { XML_NODE_HEIGHT } from "../utils/xml-tree-layout";

export interface XmlFlowNodeData {
  xml: VisibleXmlNode;
  width: number;
  compact: boolean;
  onToggle: (id: string) => void;
  [key: string]: unknown;
}

// One color identity per node kind, shared with the edges so a branch's
// type reads at a glance.
export const XML_KIND_COLORS: Record<XmlNodeKind, string> = {
  element: "var(--accent-blue)",
  text: "var(--success)",
  cdata: "var(--object-procedures)",
  pi: "var(--object-triggers)",
  comment: "var(--object-functions)",
  other: "var(--muted-foreground)",
};

const KIND_ICONS: Record<XmlNodeKind, LucideIcon> = {
  element: FileCode,
  text: Type,
  cdata: Braces,
  pi: Hash,
  comment: MessageSquare,
  other: Hash,
};

function XmlFlowNodeComponent({ data }: NodeProps) {
  const { xml, width, compact, onToggle } = data as unknown as XmlFlowNodeData;
  const toggleable = xml.kind === "element" && xml.hasChildren;
  const color = XML_KIND_COLORS[xml.kind];
  const Icon = KIND_ICONS[xml.kind];

  return (
    <div
      style={{
        width,
        height: XML_NODE_HEIGHT,
        // Kind-tinted rail, wash, and border make branch types vivid while
        // staying on the token palette.
        borderColor: `color-mix(in srgb, ${color} 35%, var(--border))`,
        background: `linear-gradient(135deg, color-mix(in srgb, ${color} 12%, var(--card)), var(--card) 60%)`,
        boxShadow: `inset 3px 0 0 0 ${color}`,
      }}
      className={cn(
        "relative flex items-center gap-2 overflow-hidden rounded-lg border pl-3 pr-2.5 text-xs",
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
      <Icon
        className="h-3.5 w-3.5 shrink-0"
        style={{ color }}
        aria-hidden
      />
      <span
        className={cn(
          "truncate font-semibold",
          xml.kind === "comment" && "font-normal italic"
        )}
        style={{ color: xml.kind === "text" ? "var(--foreground)" : color }}
      >
        {xml.label || " "}
      </span>
      {!compact &&
        xml.attrs.map((attr) => (
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
      {!xml.isExpanded && xml.hasChildren && (
        <span
          className="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={{
            color,
            backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)`,
          }}
        >
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
