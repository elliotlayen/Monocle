import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { NodeStyle } from "@/features/settings/services/settings-service";
import { NodeStylePreview } from "@/features/settings/components/node-style-preview";
import { NODE_STYLE_OPTIONS } from "./display-options";

interface NodeStyleFieldProps {
  value: NodeStyle;
  onChange: (style: NodeStyle) => void;
  /** Field label; defaults to "Node style". */
  label?: string;
}

/** Node style select plus live preview, shared by Schema Browser and Canvas Mode. */
export function NodeStyleField({
  value,
  onChange,
  label = "Node style",
}: NodeStyleFieldProps) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select
        value={value}
        onValueChange={(next) => onChange(next as NodeStyle)}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {NODE_STYLE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        How each object type carries its color, up close and zoomed out.
      </p>
      <NodeStylePreview style={value} />
    </div>
  );
}
