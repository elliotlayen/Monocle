import { useShallow } from "zustand/shallow";
import { useTheme } from "@/providers/theme-provider";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSchemaStore } from "@/features/schema-graph/store";
import { useExplorerStore } from "@/features/explorer/store";
import type { ExplorerNodeStyle } from "@/features/settings/services/settings-service";
import { XmlNodeStylePreview } from "@/features/settings/components/xml-node-style-preview";
import { AccentColorField } from "@/features/settings/components/accent-color-field";
import { NodeStyleField } from "./node-style-field";
import { EXPLORER_NODE_STYLE_OPTIONS } from "./display-options";

export function AppearanceSettingsSection() {
  const { theme, setTheme } = useTheme();
  const { nodeStyle, setNodeStyle, canvasNodeStyle, setCanvasNodeStyle } =
    useSchemaStore(
      useShallow((state) => ({
        nodeStyle: state.nodeStyle,
        setNodeStyle: state.setNodeStyle,
        canvasNodeStyle: state.canvasNodeStyle,
        setCanvasNodeStyle: state.setCanvasNodeStyle,
      }))
    );
  const { explorerNodeStyle, setExplorerNodeStyle } = useExplorerStore(
    useShallow((state) => ({
      explorerNodeStyle: state.explorerNodeStyle,
      setExplorerNodeStyle: state.setExplorerNodeStyle,
    }))
  );

  return (
    <div className="space-y-6 px-1">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Appearance</h3>
        <p className="text-xs text-muted-foreground">
          Theme and node styling across every mode.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Theme</Label>
        <Select value={theme} onValueChange={setTheme}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select theme" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="light">Light</SelectItem>
            <SelectItem value="dark">Dark</SelectItem>
            <SelectItem value="system">System</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Choose your preferred color scheme.
        </p>
      </div>

      <AccentColorField />

      <NodeStyleField
        label="Schema Browser nodes"
        value={nodeStyle}
        onChange={setNodeStyle}
      />

      <NodeStyleField
        label="Canvas Mode nodes"
        value={canvasNodeStyle}
        onChange={setCanvasNodeStyle}
      />

      <div className="space-y-2">
        <Label>Integration Explorer nodes</Label>
        <Select
          value={explorerNodeStyle}
          onValueChange={(value) =>
            setExplorerNodeStyle(value as ExplorerNodeStyle)
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EXPLORER_NODE_STYLE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          XML tree elements, text, comments, and other nodes keep their own
          kind color in every style.
        </p>
        <XmlNodeStylePreview style={explorerNodeStyle} />
      </div>
    </div>
  );
}
