import { memo, type CSSProperties } from "react";
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
import { useSchemaStore } from "@/features/schema-graph/store";
import type { NodeStyle } from "@/features/settings/services/settings-service";
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

function mix(color: string, percent: number, base: string): string {
  return `color-mix(in srgb, ${color} ${percent}%, ${base})`;
}

interface XmlNodeStyleSpec {
  shellStyle: CSSProperties;
  /** True when the node paints a solid kind color and content must go on-color. */
  onColor: boolean;
}

/**
 * The same node style setting the schema browser/canvas nodes follow
 * (Settings > Graph > Node Style), translated to the single-row XML card.
 * Mix percentages match getNodeStyleSpec in
 * src/features/schema-graph/components/node-style.ts.
 */
function getXmlNodeStyle(style: NodeStyle, color: string): XmlNodeStyleSpec {
  switch (style) {
    case "tinted":
      return {
        shellStyle: {
          backgroundColor: mix(color, 16, "var(--card)"),
          borderColor: "var(--border)",
        },
        onColor: false,
      };
    case "surface":
      return {
        shellStyle: {
          backgroundColor: mix(color, 12, "var(--card)"),
          borderColor: mix(color, 45, "var(--border)"),
        },
        onColor: false,
      };
    case "solid":
      return {
        shellStyle: {
          backgroundColor: color,
          borderColor: mix(color, 70, "var(--border)"),
          color: "var(--object-on-color)",
        },
        onColor: true,
      };
    case "adaptive":
    default:
      return {
        shellStyle: {
          borderColor: mix(color, 35, "var(--border)"),
          background: `linear-gradient(135deg, ${mix(color, 12, "var(--card)")}, var(--card) 60%)`,
          boxShadow: `inset 3px 0 0 0 ${color}`,
        },
        onColor: false,
      };
  }
}

function XmlFlowNodeComponent({ data }: NodeProps) {
  const { xml, width, compact, onToggle } = data as unknown as XmlFlowNodeData;
  const nodeStyle = useSchemaStore((state) => state.nodeStyle);
  const toggleable = xml.kind === "element" && xml.hasChildren;
  const color = XML_KIND_COLORS[xml.kind];
  const Icon = KIND_ICONS[xml.kind];
  const { shellStyle, onColor } = getXmlNodeStyle(nodeStyle, color);

  return (
    <div
      style={{ width, height: XML_NODE_HEIGHT, ...shellStyle }}
      className={cn(
        "relative flex items-center gap-2 overflow-hidden rounded-lg border pl-3 pr-2.5 text-xs",
        "transition-shadow duration-200",
        toggleable && "cursor-pointer hover:shadow-md"
      )}
      onClick={toggleable ? () => onToggle(xml.id) : undefined}
      title={xml.value ? `${xml.label}: ${xml.value}` : xml.label}
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
        style={{ color: onColor ? "var(--object-on-color)" : color }}
        aria-hidden
      />
      <span
        className={cn(
          "truncate font-semibold",
          xml.kind === "comment" && "font-normal italic"
        )}
        style={{
          color: onColor
            ? "var(--object-on-color)"
            : xml.kind === "text"
              ? "var(--foreground)"
              : color,
        }}
      >
        {xml.label || " "}
      </span>
      {!compact &&
        xml.attrs.map((attr) => (
          <span
            key={attr.name}
            className={cn(
              "flex min-w-0 shrink items-center text-[10px]",
              onColor && "opacity-85"
            )}
          >
            <span
              className={onColor ? undefined : "text-object-functions"}
              style={onColor ? { color: "var(--object-on-color)" } : undefined}
            >
              {attr.name}
            </span>
            <span
              className={onColor ? "opacity-70" : "text-muted-foreground"}
              style={onColor ? { color: "var(--object-on-color)" } : undefined}
            >
              =
            </span>
            <span
              className={cn("truncate", onColor ? undefined : "text-success")}
              style={onColor ? { color: "var(--object-on-color)" } : undefined}
            >
              &quot;{attr.value}&quot;
            </span>
          </span>
        ))}
      {!compact && xml.value !== undefined && (
        <span
          className="truncate text-[11px]"
          style={{
            color: onColor ? "var(--object-on-color)" : "var(--success)",
          }}
        >
          {xml.value}
        </span>
      )}
      {!xml.isExpanded && xml.hasChildren && (
        <span
          className="ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={
            onColor
              ? {
                  color: "var(--object-on-color)",
                  backgroundColor: "color-mix(in srgb, var(--object-on-color) 20%, transparent)",
                }
              : {
                  color,
                  backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)`,
                }
          }
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
