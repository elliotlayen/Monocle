import { useSchemaStore } from "@/features/schema-graph/store";
import { Label } from "@/components/ui/label";
import { useShallow } from "zustand/shallow";
import { GraphDisplayFields } from "./graph-display-fields";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const FOCUS_THRESHOLD_OPTIONS = ["5", "10", "15", "20", "25"];

const BROWSE_THRESHOLD_OPTIONS = ["50", "100", "200", "500", "1000"];

export function GraphSettingsSection() {
  const {
    schema,
    schemaFilter,
    availableSchemas,
    setSchemaFilter,
    focusExpandThreshold,
    setFocusExpandThreshold,
    browseThreshold,
    setBrowseThreshold,
    edgeLabelMode,
    setEdgeLabelMode,
    showMiniMap,
    setShowMiniMap,
    detailViewMode,
    setDetailViewMode,
  } = useSchemaStore(
    useShallow((state) => ({
      schema: state.schema,
      schemaFilter: state.schemaFilter,
      availableSchemas: state.availableSchemas,
      setSchemaFilter: state.setSchemaFilter,
      focusExpandThreshold: state.focusExpandThreshold,
      setFocusExpandThreshold: state.setFocusExpandThreshold,
      browseThreshold: state.browseThreshold,
      setBrowseThreshold: state.setBrowseThreshold,
      edgeLabelMode: state.edgeLabelMode,
      setEdgeLabelMode: state.setEdgeLabelMode,
      showMiniMap: state.showMiniMap,
      setShowMiniMap: state.setShowMiniMap,
      detailViewMode: state.detailViewMode,
      setDetailViewMode: state.setDetailViewMode,
    }))
  );

  const hasSchema = Boolean(schema);

  return (
    <div className="space-y-6 px-1">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Graph</h3>
        <p className="text-xs text-muted-foreground">
          Configure schema graph visibility and interaction behavior.
        </p>
      </div>

      {hasSchema && (
        <div className="space-y-2">
          <Label>Schema Filter</Label>
          <Select value={schemaFilter} onValueChange={setSchemaFilter}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All Schemas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Schemas</SelectItem>
              {availableSchemas.map((schemaName) => (
                <SelectItem key={schemaName} value={schemaName}>
                  {schemaName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Filter objects by database schema.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label>Focus Expand Threshold</Label>
        <Select
          value={String(focusExpandThreshold)}
          onValueChange={(value) => setFocusExpandThreshold(Number(value))}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FOCUS_THRESHOLD_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option} nodes
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Max neighbors to show expanded when focusing an object.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Browse Mode Threshold</Label>
        <Select
          value={String(browseThreshold)}
          onValueChange={(value) => setBrowseThreshold(Number(value))}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BROWSE_THRESHOLD_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option} objects
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Databases with more objects than this start with an empty canvas; pick
          objects to explore instead of rendering the full graph. Applies on the
          next database load.
        </p>
      </div>

      <GraphDisplayFields
        edgeLabelMode={edgeLabelMode}
        onEdgeLabelModeChange={setEdgeLabelMode}
        showMiniMap={showMiniMap}
        onShowMiniMapChange={setShowMiniMap}
        detailViewMode={detailViewMode}
        onDetailViewModeChange={setDetailViewMode}
      />
    </div>
  );
}
