import { memo, type ReactNode } from "react";
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
import { useExplorerStore } from "../store";
import type { ExplorerNodeStyle } from "@/features/settings/services/settings-service";
import type { VisibleXmlNode, XmlNodeKind } from "../utils/xml-tree-model";
import { XML_NODE_HEIGHT } from "../utils/xml-tree-layout";
import { getXmlNodeStyleSpec } from "../utils/xml-node-style";

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

export interface XmlNodeCardProps {
  xml: VisibleXmlNode;
  width: number;
  compact: boolean;
  style: ExplorerNodeStyle;
  onClick?: () => void;
  className?: string;
  /** Flow handles; the settings preview passes nothing. */
  children?: ReactNode;
}

/**
 * The XML tree card without React Flow. The flow node and the settings
 * preview both render this, so the two cannot drift.
 */
export function XmlNodeCard({
  xml,
  width,
  compact,
  style,
  onClick,
  className,
  children,
}: XmlNodeCardProps) {
  const color = XML_KIND_COLORS[xml.kind];
  const Icon = KIND_ICONS[xml.kind];
  const spec = getXmlNodeStyleSpec(style, color, xml.depth);
  const icon = (
    <Icon className="h-3.5 w-3.5 shrink-0" style={{ color }} aria-hidden />
  );

  return (
    <div
      style={{ width, height: XML_NODE_HEIGHT, ...spec.shellStyle }}
      className={cn(
        "relative flex items-center gap-2 overflow-hidden border text-xs",
        "transition-shadow duration-200",
        spec.shellClass,
        onClick && "cursor-pointer hover:shadow-md",
        className
      )}
      onClick={onClick}
      title={xml.value ? `${xml.label}: ${xml.value}` : xml.label}
    >
      {children}
      {spec.iconWrapperClass ? (
        <span className={spec.iconWrapperClass} style={spec.iconWrapperStyle}>
          {icon}
        </span>
      ) : (
        icon
      )}
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
      {!compact && xml.value !== undefined && (
        <span className="truncate text-[11px] text-success">{xml.value}</span>
      )}
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
    </div>
  );
}

function XmlFlowNodeComponent({ data }: NodeProps) {
  const { xml, width, compact, onToggle } = data as unknown as XmlFlowNodeData;
  const style = useExplorerStore((state) => state.explorerNodeStyle);
  const toggleable = xml.kind === "element" && xml.hasChildren;

  return (
    <XmlNodeCard
      xml={xml}
      width={width}
      compact={compact}
      style={style}
      onClick={toggleable ? () => onToggle(xml.id) : undefined}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-0 !w-0 !border-0 !bg-transparent"
        style={{ left: 0, top: "50%" }}
        isConnectable={false}
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!h-0 !w-0 !border-0 !bg-transparent"
        style={{ right: 0, top: "50%" }}
        isConnectable={false}
      />
    </XmlNodeCard>
  );
}

export const XmlFlowNode = memo(XmlFlowNodeComponent);
