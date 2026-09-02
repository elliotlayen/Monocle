import { useShallow } from "zustand/shallow";
import { useExplorerStore } from "@/features/explorer/store";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ExplorerNodeStyle } from "@/features/settings/services/settings-service";
import { XmlNodeStylePreview } from "@/features/settings/components/xml-node-style-preview";
import { EXPLORER_NODE_STYLE_OPTIONS } from "./display-options";

export function ExplorerNodesSettingsSection() {
  const { explorerNodeStyle, setExplorerNodeStyle } = useExplorerStore(
    useShallow((state) => ({
      explorerNodeStyle: state.explorerNodeStyle,
      setExplorerNodeStyle: state.setExplorerNodeStyle,
    }))
  );

  return (
    <div className="space-y-6 px-1">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Nodes</h3>
        <p className="text-xs text-muted-foreground">
          How XML tree nodes carry their kind color.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Node style</Label>
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
          Elements, text, comments, and other nodes keep their own kind color in
          every style.
        </p>
        <XmlNodeStylePreview style={explorerNodeStyle} />
      </div>
    </div>
  );
}
