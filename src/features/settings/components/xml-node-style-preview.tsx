import type { ExplorerNodeStyle } from "@/features/settings/services/settings-service";
import type { VisibleXmlNode } from "@/features/explorer/utils/xml-tree-model";
import {
  XML_NODE_HEIGHT,
  layoutXmlTree,
} from "@/features/explorer/utils/xml-tree-layout";
import {
  XML_KIND_COLORS,
  XmlNodeCard,
} from "@/features/explorer/components/xml-flow-node";

const PREVIEW_GAP_X = 24;
// The settings pane is narrower than a real canvas; scale the tree to fit.
const PREVIEW_SCALE = 0.85;

// A tiny document in document order: root element, an element child with
// an attribute and one text leaf, and a comment sibling.
const PREVIEW_TREE: VisibleXmlNode[] = [
  {
    id: "0",
    parentId: null,
    depth: 0,
    kind: "element",
    label: "Order",
    attrs: [],
    childCount: 2,
    hasChildren: true,
    isExpanded: true,
  },
  {
    id: "0.0",
    parentId: "0",
    depth: 1,
    kind: "element",
    label: "Customer",
    attrs: [{ name: "type", value: "b2b" }],
    childCount: 1,
    hasChildren: true,
    isExpanded: true,
  },
  {
    id: "0.0.0",
    parentId: "0.0",
    depth: 2,
    kind: "text",
    label: "Acme",
    attrs: [],
    childCount: 0,
    hasChildren: false,
    isExpanded: false,
  },
  {
    id: "0.1",
    parentId: "0",
    depth: 1,
    kind: "comment",
    label: "legacy ids",
    attrs: [],
    childCount: 0,
    hasChildren: false,
    isExpanded: false,
  },
];

const COMPACT_ROW: VisibleXmlNode[] = [
  {
    id: "c0",
    parentId: null,
    depth: 0,
    kind: "element",
    label: "Items",
    attrs: [],
    childCount: 4,
    hasChildren: true,
    isExpanded: false,
  },
  {
    id: "c1",
    parentId: null,
    depth: 1,
    kind: "text",
    label: "12.99",
    attrs: [],
    childCount: 0,
    hasChildren: false,
    isExpanded: false,
  },
  {
    id: "c2",
    parentId: null,
    depth: 1,
    kind: "comment",
    label: "note",
    attrs: [],
    childCount: 0,
    hasChildren: false,
    isExpanded: false,
  },
];

const LAYOUT = layoutXmlTree(PREVIEW_TREE, { gapX: PREVIEW_GAP_X });
const NODE_BY_ID = new Map(PREVIEW_TREE.map((node) => [node.id, node]));

function edgePath(child: VisibleXmlNode): string {
  const parent = NODE_BY_ID.get(child.parentId ?? "");
  if (!parent) return "";
  const from = LAYOUT.positions[parent.id];
  const to = LAYOUT.positions[child.id];
  const x1 = from.x + LAYOUT.widths[parent.id];
  const y1 = from.y + XML_NODE_HEIGHT / 2;
  const x2 = to.x;
  const y2 = to.y + XML_NODE_HEIGHT / 2;
  const cx = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`;
}

interface XmlNodeStylePreviewProps {
  style: ExplorerNodeStyle;
}

export function XmlNodeStylePreview({ style }: XmlNodeStylePreviewProps) {
  return (
    <div className="dot-grid overflow-hidden rounded-lg border border-border bg-background">
      {/* Keyed on style so the swap remounts: opacity + scale only, ease-out. */}
      <div
        key={style}
        className="animate-in fade-in-0 zoom-in-95 space-y-4 p-4 duration-[var(--duration-base)] ease-[var(--ease-out)]"
      >
        <div className="space-y-2">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Up close
          </span>
          <div
            className="overflow-hidden"
            style={{ height: LAYOUT.bounds.height * PREVIEW_SCALE }}
          >
            <div
              className="relative origin-top-left"
              style={{
                width: LAYOUT.bounds.width,
                height: LAYOUT.bounds.height,
                transform: `scale(${PREVIEW_SCALE})`,
              }}
            >
              <svg
                aria-hidden
                className="pointer-events-none absolute inset-0 h-full w-full"
              >
                {PREVIEW_TREE.filter((node) => node.parentId !== null).map(
                  (node) => (
                    <path
                      key={node.id}
                      d={edgePath(node)}
                      fill="none"
                      strokeWidth={1.5}
                      stroke={`color-mix(in srgb, ${XML_KIND_COLORS[node.kind]} 55%, transparent)`}
                    />
                  )
                )}
              </svg>
              {PREVIEW_TREE.map((node) => (
                <div
                  key={node.id}
                  className="absolute"
                  style={{
                    left: LAYOUT.positions[node.id].x,
                    top: LAYOUT.positions[node.id].y,
                  }}
                >
                  <XmlNodeCard
                    xml={node}
                    width={LAYOUT.widths[node.id]}
                    compact={false}
                    style={style}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Zoomed out
          </span>
          <div className="h-8 overflow-hidden">
            <div className="flex origin-top-left scale-[0.6] gap-3">
              {COMPACT_ROW.map((node) => (
                <XmlNodeCard
                  key={node.id}
                  xml={node}
                  width={120}
                  compact
                  style={style}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
