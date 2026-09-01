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
  computeDefaultExpandedIds,
} from "../utils/xml-tree-model";
import {
  layoutXmlTree,
  XML_NODE_HEIGHT,
  XML_NODE_WIDTH,
} from "../utils/xml-tree-layout";
import {
  getZoomBand,
  isCompactForZoomBand,
  type ZoomBand,
} from "@/features/schema-graph/components/zoom-band";
import { XmlFlowNode, type XmlFlowNodeData } from "./xml-flow-node";

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

// Static handle geometry: with fixed node dimensions this lets React Flow
// anchor edges without DOM measurement (the SSR/static-flow path).
const STATIC_HANDLES = [
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
    x: XML_NODE_WIDTH,
    y: XML_NODE_HEIGHT / 2,
    width: 1,
    height: 1,
  },
];

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

  // Bounded default expansion on first open (mount-scoped, matching the
  // previous tree view's re-trigger behavior after collapse-all + revisit).
  const initialExpandDone = useRef(false);
  useEffect(() => {
    if (
      parseResult.document &&
      expandedIds.size === 0 &&
      !initialExpandDone.current
    ) {
      initialExpandDone.current = true;
      const ids = computeDefaultExpandedIds(parseResult.document);
      if (ids.size > 0) {
        onExpandedIdsChange(ids);
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
    const { positions } = layoutXmlTree(visible);
    const nodes: Node[] = visible.map((xml) => ({
      id: xml.id,
      type: "xmlNode",
      position: positions[xml.id],
      // Fixed dimensions: nodes are born measured, so edges anchor
      // immediately and viewport culling is exact.
      width: XML_NODE_WIDTH,
      height: XML_NODE_HEIGHT,
      handles: STATIC_HANDLES,
      draggable: false,
      connectable: false,
      data: { xml, compact, onToggle: handleToggle } satisfies XmlFlowNodeData,
    }));
    const edges: Edge[] = visible
      .filter((xml) => xml.parentId !== null)
      .map((xml) => ({
        id: `e-${xml.id}`,
        source: xml.parentId!,
        target: xml.id,
        type: "smoothstep",
        style: {
          stroke: "color-mix(in srgb, var(--foreground) 22%, transparent)",
          strokeWidth: 1,
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
