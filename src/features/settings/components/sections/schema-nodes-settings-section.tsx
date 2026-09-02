import { useShallow } from "zustand/shallow";
import { useSchemaStore } from "@/features/schema-graph/store";
import { NodeStyleField } from "./node-style-field";

export function SchemaNodesSettingsSection() {
  const { nodeStyle, setNodeStyle } = useSchemaStore(
    useShallow((state) => ({
      nodeStyle: state.nodeStyle,
      setNodeStyle: state.setNodeStyle,
    }))
  );

  return (
    <div className="space-y-6 px-1">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Nodes</h3>
        <p className="text-xs text-muted-foreground">
          How schema browser nodes carry their object color.
        </p>
      </div>

      <NodeStyleField value={nodeStyle} onChange={setNodeStyle} />
    </div>
  );
}
