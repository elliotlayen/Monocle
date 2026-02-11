import { useTheme } from "@/providers/theme-provider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AppearanceSettingsSection() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-6 px-1">
      <div className="space-y-1">
        <h3 className="text-base font-semibold">Appearance</h3>
        <p className="text-xs text-muted-foreground">
          Personalize how Monocle looks.
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
          Choose your preferred color scheme.
        </p>
      </div>
    </div>
  );
}
