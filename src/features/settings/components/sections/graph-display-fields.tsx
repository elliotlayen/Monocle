import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  DetailViewMode,
  EdgeLabelMode,
} from "@/features/settings/services/settings-service";
import { DETAIL_VIEW_OPTIONS, EDGE_LABEL_MODES } from "./display-options";

interface GraphDisplayFieldsProps {
  edgeLabelMode: EdgeLabelMode;
  onEdgeLabelModeChange: (mode: EdgeLabelMode) => void;
  showMiniMap: boolean;
  onShowMiniMapChange: (show: boolean) => void;
  detailViewMode: DetailViewMode;
  onDetailViewModeChange: (mode: DetailViewMode) => void;
}

/** Edge labels, minimap, and details placement; bound per mode by the caller. */
export function GraphDisplayFields({
  edgeLabelMode,
  onEdgeLabelModeChange,
  showMiniMap,
  onShowMiniMapChange,
  detailViewMode,
  onDetailViewModeChange,
}: GraphDisplayFieldsProps) {
  return (
    <>
      <div className="space-y-2">
        <Label>Edge Labels</Label>
        <Select
          value={edgeLabelMode}
          onValueChange={(value) =>
            onEdgeLabelModeChange(value as EdgeLabelMode)
          }
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
        <Label>MiniMap</Label>
        <Select
          value={showMiniMap ? "on" : "off"}
          onValueChange={(value) => onShowMiniMapChange(value === "on")}
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

      <div className="space-y-2">
        <Label>Object Details</Label>
        <Select
          value={detailViewMode}
          onValueChange={(value) =>
            onDetailViewModeChange(value as DetailViewMode)
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DETAIL_VIEW_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Where object details open when you click a node or sidebar item.
        </p>
      </div>
    </>
  );
}
