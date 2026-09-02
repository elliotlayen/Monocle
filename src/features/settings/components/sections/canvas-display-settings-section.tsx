import { useShallow } from "zustand/shallow";
import { useSchemaStore } from "@/features/schema-graph/store";
import { GraphDisplayFields } from "./graph-display-fields";
import { NodeStyleField } from "./node-style-field";

export function CanvasDisplaySettingsSection() {
  const {
    canvasNodeStyle,
    setCanvasNodeStyle,
    canvasEdgeLabelMode,
    setCanvasEdgeLabelMode,
    canvasShowMiniMap,
    setCanvasShowMiniMap,
    canvasDetailViewMode,
    setCanvasDetailViewMode,
  } = useSchemaStore(
    useShallow((state) => ({
      canvasNodeStyle: state.canvasNodeStyle,
      setCanvasNodeStyle: state.setCanvasNodeStyle,
      canvasEdgeLabelMode: state.canvasEdgeLabelMode,
      setCanvasEdgeLabelMode: state.setCanvasEdgeLabelMode,
      canvasShowMiniMap: state.canvasShowMiniMap,
      setCanvasShowMiniMap: state.setCanvasShowMiniMap,
      canvasDetailViewMode: state.canvasDetailViewMode,
      setCanvasDetailViewMode: state.setCanvasDetailViewMode,
    }))
  );

  return (
    <div className="space-y-6 px-1">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Display</h3>
        <p className="text-xs text-muted-foreground">
          Canvas Mode keeps its own node style, edge labels, minimap, and
          details placement.
        </p>
      </div>

      <NodeStyleField value={canvasNodeStyle} onChange={setCanvasNodeStyle} />

      <GraphDisplayFields
        edgeLabelMode={canvasEdgeLabelMode}
        onEdgeLabelModeChange={setCanvasEdgeLabelMode}
        showMiniMap={canvasShowMiniMap}
        onShowMiniMapChange={setCanvasShowMiniMap}
        detailViewMode={canvasDetailViewMode}
        onDetailViewModeChange={setCanvasDetailViewMode}
      />
    </div>
  );
}
