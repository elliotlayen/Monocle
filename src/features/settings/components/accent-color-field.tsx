import { useRef } from "react";
import { Check } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useTheme } from "@/providers/theme-provider";
import { useResolvedTheme } from "@/hooks/use-resolved-theme";
import {
  ACCENT_COLORS,
  type AccentColor,
} from "@/features/settings/services/settings-service";

/**
 * Display values for the swatch dots. Mirrors the per-accent tokens in
 * src/index.css (the dots must show every accent while only the active
 * one is applied to the document) - keep the two in sync.
 */
const SWATCHES: Record<
  AccentColor,
  { label: string; light: string; dark: string; onLight: string; onDark: string }
> = {
  blue: {
    label: "Blue",
    light: "oklch(0.55 0.19 259)",
    dark: "oklch(0.66 0.17 259)",
    onLight: "oklch(1 0 0)",
    onDark: "oklch(1 0 0)",
  },
  purple: {
    label: "Purple",
    light: "oklch(0.55 0.19 295)",
    dark: "oklch(0.67 0.17 300)",
    onLight: "oklch(1 0 0)",
    onDark: "oklch(1 0 0)",
  },
  pink: {
    label: "Pink",
    light: "oklch(0.57 0.19 345)",
    dark: "oklch(0.68 0.17 345)",
    onLight: "oklch(1 0 0)",
    onDark: "oklch(1 0 0)",
  },
  red: {
    label: "Red",
    light: "oklch(0.55 0.19 25)",
    dark: "oklch(0.68 0.18 25)",
    onLight: "oklch(1 0 0)",
    onDark: "oklch(1 0 0)",
  },
  orange: {
    label: "Orange",
    light: "oklch(0.6 0.16 55)",
    dark: "oklch(0.72 0.15 55)",
    onLight: "oklch(1 0 0)",
    onDark: "oklch(0.2 0.02 55)",
  },
  yellow: {
    label: "Yellow",
    light: "oklch(0.65 0.13 95)",
    dark: "oklch(0.8 0.15 95)",
    onLight: "oklch(0.2 0.02 95)",
    onDark: "oklch(0.2 0.02 95)",
  },
  green: {
    label: "Green",
    light: "oklch(0.55 0.15 150)",
    dark: "oklch(0.7 0.15 150)",
    onLight: "oklch(1 0 0)",
    onDark: "oklch(1 0 0)",
  },
  system: {
    label: "System",
    light: "conic-gradient(oklch(0.55 0.19 259), oklch(0.55 0.19 295), oklch(0.57 0.19 345), oklch(0.55 0.19 25), oklch(0.6 0.16 55), oklch(0.65 0.13 95), oklch(0.55 0.15 150), oklch(0.55 0.19 259))",
    dark: "conic-gradient(oklch(0.66 0.17 259), oklch(0.67 0.17 300), oklch(0.68 0.17 345), oklch(0.68 0.18 25), oklch(0.72 0.15 55), oklch(0.8 0.15 95), oklch(0.7 0.15 150), oklch(0.66 0.17 259))",
    onLight: "oklch(1 0 0)",
    onDark: "oklch(1 0 0)",
  },
};

/** The ring color for the selected System dot (a stand-in, not a gradient). */
const SYSTEM_RING = "oklch(0.6 0.02 255)";

/** macOS-style swatch dot row for the app accent color. */
export function AccentColorField() {
  const { accent, setAccent } = useTheme();
  const resolvedTheme = useResolvedTheme();
  const groupRef = useRef<HTMLDivElement>(null);

  const swatchFill = (id: AccentColor) =>
    resolvedTheme === "dark" ? SWATCHES[id].dark : SWATCHES[id].light;
  const swatchOn = (id: AccentColor) =>
    resolvedTheme === "dark" ? SWATCHES[id].onDark : SWATCHES[id].onLight;
  const ringColor = (id: AccentColor) =>
    id === "system" ? SYSTEM_RING : swatchFill(id);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    let delta = 0;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") delta = 1;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") delta = -1;
    if (delta === 0) return;
    e.preventDefault();
    const index = ACCENT_COLORS.indexOf(accent);
    const next =
      ACCENT_COLORS[
        (index + delta + ACCENT_COLORS.length) % ACCENT_COLORS.length
      ];
    setAccent(next);
    groupRef.current
      ?.querySelector<HTMLButtonElement>(`[data-accent-dot="${next}"]`)
      ?.focus();
  };

  return (
    <div className="space-y-2">
      <Label id="accent-color-label">Accent</Label>
      <div
        ref={groupRef}
        role="radiogroup"
        aria-labelledby="accent-color-label"
        className="flex items-center gap-3 py-1"
        onKeyDown={handleKeyDown}
      >
        {ACCENT_COLORS.map((id) => {
          const selected = id === accent;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={SWATCHES[id].label}
              title={SWATCHES[id].label}
              data-accent-dot={id}
              tabIndex={selected ? 0 : -1}
              className={cn(
                "relative flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full transition-transform duration-[var(--duration-fast)] ease-[var(--ease-out)] focus-visible:outline-none",
                "hover:scale-110 active:scale-95",
                selected && "scale-105"
              )}
              style={{
                background: swatchFill(id),
                boxShadow: selected
                  ? `0 0 0 2px var(--background), 0 0 0 4px ${ringColor(id)}`
                  : undefined,
              }}
              onClick={() => setAccent(id)}
            >
              <Check
                className={cn(
                  "h-3 w-3 transition-[opacity,transform] duration-[var(--duration-fast)] ease-[var(--ease-out)]",
                  selected ? "scale-100 opacity-100" : "scale-50 opacity-0"
                )}
                style={{ color: swatchOn(id) }}
              />
            </button>
          );
        })}
        <span className="ml-1 min-w-16 text-xs text-muted-foreground">
          {SWATCHES[accent].label}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        System follows your OS accent color where supported.
      </p>
    </div>
  );
}
