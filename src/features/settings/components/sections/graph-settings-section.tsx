import { useSchemaStore } from "@/features/schema-graph/store";
import type { EdgeLabelMode } from "@/features/settings/services/settings-service";
import { useShallow } from "zustand/shallow";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const EDGE_LABEL_MODES: Array<{ label: string; value: EdgeLabelMode }> = [
  { label: "Auto", value: "auto" },
  { label: "Never", value: "never" },
  { label: "Always", value: "always" },
];

const FOCUS_THRESHOLD_OPTIONS = ["5", "10", "15", "20", "25"];

export function GraphSettingsSection() {
  const {
    schema,
    schemaFilter,
    availableSchemas,
    setSchemaFilter,
    focusExpandThreshold,
    setFocusExpandThreshold,
    edgeLabelMode,
    setEdgeLabelMode,
    showMiniMap,
    setShowMiniMap,
  } = useSchemaStore(
    useShallow((state) => ({
      schema: state.schema,
      schemaFilter: state.schemaFilter,
      availableSchemas: state.availableSchemas,
      setSchemaFilter: state.setSchemaFilter,
      focusExpandThreshold: state.focusExpandThreshold,
      setFocusExpandThreshold: state.setFocusExpandThreshold,
      edgeLabelMode: state.edgeLabelMode,
      setEdgeLabelMode: state.setEdgeLabelMode,
      showMiniMap: state.showMiniMap,
      setShowMiniMap: state.setShowMiniMap,
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
          <label className="text-sm font-medium">Schema Filter</label>
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
        <label className="text-sm font-medium">Focus Expand Threshold</label>
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
        <label className="text-sm font-medium">Edge Labels</label>
        <Select
          value={edgeLabelMode}
          onValueChange={(value) => setEdgeLabelMode(value as EdgeLabelMode)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EDGE_LABEL_MODES.map((mode) => (
              <SelectItem key={mode.value} value={mode.value}>
                {mode.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Control edge label visibility across zoom levels.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">MiniMap</label>
        <Select
          value={showMiniMap ? "on" : "off"}
          onValueChange={(value) => setShowMiniMap(value === "on")}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="on">On</SelectItem>
            <SelectItem value="off">Off</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Show or hide the graph overview minimap.
        </p>
      </div>
    </div>
  );
}
