import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Background,
  Controls,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  type Edge,
  type Node,
  type Viewport,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { parseXml } from "../utils/xml-parser";
import {
  buildVisibleTree,
  collectExpandableKeys,
} from "../utils/xml-tree-model";
import { layoutXmlTree, XML_NODE_HEIGHT } from "../utils/xml-tree-layout";
import {
  getZoomBand,
  isCompactForZoomBand,
  type ZoomBand,
} from "@/features/schema-graph/components/zoom-band";
import {
  XML_KIND_COLORS,
  XmlFlowNode,
  type XmlFlowNodeData,
} from "./xml-flow-node";

export interface XmlTreeViewHandle {
  expandAll: () => void;
  collapseAll: () => void;
}

interface XmlTreeFlowProps {
  content: string;
  expandedIds: Set<string>;
  onExpandedIdsChange: (ids: Set<string>) => void;
  viewport: Viewport | null;
  onViewportChange: (viewport: Viewport) => void;
}

const nodeTypes = { xmlNode: XmlFlowNode };

const DEFAULT_VIEWPORT: Viewport = { x: 24, y: 24, zoom: 1 };

// Static handle geometry: with declared node dimensions this lets React
// Flow anchor edges without DOM measurement (the SSR/static-flow path).
function makeHandles(width: number) {
  return [
    {
      id: null,
      type: "target" as const,
      position: Position.Left,
      x: 0,
      y: XML_NODE_HEIGHT / 2,
      width: 1,
      height: 1,
    },
    {
      id: null,
      type: "source" as const,
      position: Position.Right,
      x: width,
      y: XML_NODE_HEIGHT / 2,
      width: 1,
      height: 1,
    },
  ];
}

function XmlTreeFlowInner(
  {
    content,
    expandedIds,
    onExpandedIdsChange,
    viewport,
    onViewportChange,
  }: XmlTreeFlowProps,
  ref: React.ForwardedRef<XmlTreeViewHandle>
) {
  const parseResult = useMemo(() => parseXml(content), [content]);
  const [zoomBand, setZoomBand] = useState<ZoomBand>(() =>
    getZoomBand((viewport ?? DEFAULT_VIEWPORT).zoom)
  );

  useImperativeHandle(
    ref,
    () => ({
      expandAll() {
        if (!parseResult.document) return;
        const keys: string[] = [];
        collectExpandableKeys(
          parseResult.document.documentElement,
          "0",
          keys
        );
        onExpandedIdsChange(new Set(keys));
      },
      collapseAll() {
        onExpandedIdsChange(new Set());
      },
    }),
    [parseResult, onExpandedIdsChange]
  );

  // Expand the whole document on first open (mount-scoped, matching the
  // previous tree view); viewport culling keeps large documents cheap.
  const initialExpandDone = useRef(false);
  useEffect(() => {
    if (
      parseResult.document &&
      expandedIds.size === 0 &&
      !initialExpandDone.current
    ) {
      initialExpandDone.current = true;
      const keys: string[] = [];
      collectExpandableKeys(parseResult.document.documentElement, "0", keys);
      if (keys.length > 0) {
        onExpandedIdsChange(new Set(keys));
      }
    }
  }, [parseResult.document, expandedIds.size, onExpandedIdsChange]);

  const handleToggle = useCallback(
    (nodeId: string) => {
      const next = new Set(expandedIds);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      onExpandedIdsChange(next);
    },
    [expandedIds, onExpandedIdsChange]
  );

  const compact = isCompactForZoomBand(zoomBand);

  const { nodes: derivedNodes, edges } = useMemo(() => {
    if (!parseResult.document) {
      return { nodes: [] as Node[], edges: [] as Edge[] };
    }
    const visible = buildVisibleTree(parseResult.document, expandedIds);
    const { positions, widths } = layoutXmlTree(visible);
    const nodes: Node[] = visible.map((xml) => ({
      id: xml.id,
      type: "xmlNode",
      position: positions[xml.id],
      // Declared dimensions: nodes are born measured, so edges anchor
      // immediately and viewport culling is exact. Width fits the content.
      width: widths[xml.id],
      height: XML_NODE_HEIGHT,
      handles: makeHandles(widths[xml.id]),
      draggable: false,
      connectable: false,
      data: {
        xml,
        width: widths[xml.id],
        compact,
        onToggle: handleToggle,
      } satisfies XmlFlowNodeData,
    }));
    // Bezier edges tinted by the child node's kind, so branch types read
    // at a glance.
    const edges: Edge[] = visible
      .filter((xml) => xml.parentId !== null)
      .map((xml) => ({
        id: `e-${xml.id}`,
        source: xml.parentId!,
        target: xml.id,
        style: {
          stroke: `color-mix(in srgb, ${XML_KIND_COLORS[xml.kind]} 55%, transparent)`,
          strokeWidth: 1.5,
        },
        focusable: false,
        selectable: false,
      }));
    return { nodes, edges };
  }, [parseResult.document, expandedIds, compact, handleToggle]);

  // Controlled nodes flow through useNodesState so React Flow can record
  // node measurements (edges need them for their anchor points).
  const [nodes, setNodes, onNodesChange] = useNodesState(derivedNodes);
  useEffect(() => {
    setNodes(derivedNodes);
  }, [derivedNodes, setNodes]);

  const handleMove = useCallback(
    (_event: unknown, nextViewport: Viewport) => {
      const band = getZoomBand(nextViewport.zoom);
      setZoomBand((current) => (current === band ? current : band));
    },
    []
  );

  const handleMoveEnd = useCallback(
    (_event: unknown, nextViewport: Viewport) => {
      onViewportChange(nextViewport);
    },
    [onViewportChange]
  );

  if (!parseResult.document) {
    return null;
  }

  return (
    <div className="min-h-0 flex-1">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
        proOptions={{ hideAttribution: true }}
        onlyRenderVisibleElements
        minZoom={0.05}
        maxZoom={2}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        fitView={viewport === null}
        fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
        defaultViewport={viewport ?? DEFAULT_VIEWPORT}
        onMove={handleMove}
        onMoveEnd={handleMoveEnd}
      >
        <Background
          className="!bg-transparent [&>pattern>circle]:!fill-border"
          gap={20}
        />
        <Controls
          showInteractive={false}
          className="!overflow-hidden !rounded-lg !border !border-[var(--panel-border)] !bg-[var(--panel-bg)] !shadow-[var(--panel-shadow)] [&>button]:!border-0 [&>button]:!border-b [&>button]:!border-[var(--panel-border)] [&>button]:!bg-transparent [&>button]:!text-foreground [&>button:hover]:!bg-muted [&>button>svg]:!fill-current"
        />
      </ReactFlow>
    </div>
  );
}

const XmlTreeFlowWithRef = forwardRef<XmlTreeViewHandle, XmlTreeFlowProps>(
  XmlTreeFlowInner
);

/** React Flow rendering of an XML document; brings its own provider. */
export const XmlTreeFlow = forwardRef<XmlTreeViewHandle, XmlTreeFlowProps>(
  function XmlTreeFlow(props, ref) {
    return (
      <ReactFlowProvider>
        <XmlTreeFlowWithRef {...props} ref={ref} />
      </ReactFlowProvider>
    );
  }
);
