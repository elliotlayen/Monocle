import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/providers/theme-provider";
import { useSchemaStore } from "@/features/schema-graph/store";
import { useShallow } from "zustand/shallow";
import { useAppVersion } from "@/hooks/useAppVersion";
import type { FocusMode } from "@/features/settings/services/settings-service";

interface AppSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AppSettingsSheet({ open, onOpenChange }: AppSettingsSheetProps) {
  const { theme, setTheme } = useTheme();
  const version = useAppVersion();
  const {
    schema,
    schemaFilter,
    availableSchemas,
    setSchemaFilter,
    focusMode,
    setFocusMode,
    focusExpandThreshold,
    setFocusExpandThreshold,
    disconnect,
    isConnected,
  } = useSchemaStore(
    useShallow((state) => ({
      schema: state.schema,
      schemaFilter: state.schemaFilter,
      availableSchemas: state.availableSchemas,
      setSchemaFilter: state.setSchemaFilter,
      focusMode: state.focusMode,
      setFocusMode: state.setFocusMode,
      focusExpandThreshold: state.focusExpandThreshold,
      setFocusExpandThreshold: state.setFocusExpandThreshold,
      disconnect: state.disconnect,
      isConnected: state.isConnected,
    }))
  );

  const hasSchema = Boolean(schema);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col">
        <SheetHeader>
          <SheetTitle>Settings</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-6 flex-1">
          {hasSchema && (
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
          )}

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
            <label className="text-sm font-medium">Focus Mode</label>
            <Select
              value={focusMode}
              onValueChange={(value) => setFocusMode(value as FocusMode)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select focus mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fade">Fade unfocused</SelectItem>
                <SelectItem value="hide">Hide unfocused</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Unfocused element visibility
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Focus Expand Threshold</label>
            <Select
              value={String(focusExpandThreshold)}
              onValueChange={(v) => setFocusExpandThreshold(Number(v))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 nodes</SelectItem>
                <SelectItem value="10">10 nodes</SelectItem>
                <SelectItem value="15">15 nodes</SelectItem>
                <SelectItem value="20">20 nodes</SelectItem>
                <SelectItem value="25">25 nodes</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Max neighbors to show expanded in focus mode
            </p>
          </div>
        </div>

        <div className="pt-6 mt-auto border-t border-border space-y-4">
          {isConnected && (
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => {
                disconnect();
                onOpenChange(false);
              }}
            >
              Disconnect
            </Button>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex flex-col">
                <span
                  className="font-semibold text-sm"
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                >
                  Monocle
                </span>
                <span className="text-xs text-muted-foreground">
                  By Elliot Layen
                </span>
              </div>
            </div>
            {version && (
              <span className="text-xs text-muted-foreground">v{version}</span>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
