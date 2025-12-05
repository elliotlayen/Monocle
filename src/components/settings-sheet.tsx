import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTheme } from "@/providers/theme-provider";
import { useSchemaStore } from "@/stores/schemaStore";
import { EDGE_COLOR_KEY } from "@/constants/edge-colors";

export function SettingsSheet() {
  const { theme, setTheme } = useTheme();
  const { schemaFilter, availableSchemas, setSchemaFilter } = useSchemaStore();

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 px-2">
          <Settings className="w-4 h-4" />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium">Schema Filter</label>
            <Select value={schemaFilter} onValueChange={setSchemaFilter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="All Schemas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Schemas</SelectItem>
                {availableSchemas.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Filter objects by database schema
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Theme</label>
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
              Choose your preferred color scheme
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Edge Colors</label>
            <div className="space-y-1.5">
              {EDGE_COLOR_KEY.map(({ color, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <div
                    className="w-4 h-0.5 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-sm text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Colors used for relationship edges in the graph
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
