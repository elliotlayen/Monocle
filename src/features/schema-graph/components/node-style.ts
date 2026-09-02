import type { CSSProperties } from "react";
import type { ObjectType } from "../store";
import { OBJECT_COLORS } from "@/constants/edge-colors";
import type { NodeStyle } from "@/features/settings/services/settings-service";

// transition-shadow, not transition-all: focus/dim toggles flip classes on
// hundreds of nodes at once and must not animate.
export const NODE_SHELL_CLASS =
  "bg-card border border-border rounded-lg shadow-sm overflow-hidden transition-shadow duration-200 cursor-pointer relative";

/** The quiet Instrument header: the look shipped with the overhaul. */
export const QUIET_HEADER_CLASS = "bg-muted/40";

/**
 * Presentation contract shared by every node kind and the settings preview.
 * Colors are always derived from the OBJECT_COLORS tokens via color-mix so
 * the palette stays in src/index.css. Nothing here changes node geometry.
 */
export interface NodeStyleSpec {
  /** Surface style only: tints the whole card. */
  shellStyle?: CSSProperties;
  /** Structural background class for the header; empty when headerStyle paints it. */
  headerClass: string;
  headerStyle?: CSSProperties;
  /** Adaptive-compact only: tints the (empty) body so the whole node carries color. */
  bodyStyle?: CSSProperties;
  showKindLabel: boolean;
  showKindDot: boolean;
  kindLabelClass: string;
  nameClass: string;
}

function mix(color: string, percent: number, base: string): string {
  return `color-mix(in srgb, ${color} ${percent}%, ${base})`;
}

function solidHeader(color: string): CSSProperties {
  return { backgroundColor: color, color: "var(--object-on-color)" };
}

export function getNodeStyleSpec(
  style: NodeStyle,
  objectType: ObjectType,
  isCompact?: boolean
): NodeStyleSpec {
  const color = OBJECT_COLORS[objectType];

  switch (style) {
    case "tinted":
      return {
        headerClass: "",
        headerStyle: { backgroundColor: mix(color, 16, "var(--card)") },
        showKindLabel: true,
        showKindDot: true,
        kindLabelClass: "text-muted-foreground",
        nameClass: "text-sm",
      };
    case "surface":
      return {
        shellStyle: {
          backgroundColor: mix(color, 12, "var(--card)"),
          borderColor: mix(color, 45, "var(--border)"),
        },
        headerClass: "",
        headerStyle: { backgroundColor: mix(color, 18, "var(--card)") },
        showKindLabel: true,
        showKindDot: true,
        kindLabelClass: "text-muted-foreground",
        nameClass: "text-sm",
      };
    case "solid":
      return {
        headerClass: "",
        headerStyle: solidHeader(color),
        showKindLabel: true,
        showKindDot: false,
        kindLabelClass: "opacity-75",
        nameClass: "text-sm",
      };
    case "adaptive":
    default:
      if (isCompact) {
        return {
          headerClass: "",
          headerStyle: solidHeader(color),
          bodyStyle: { backgroundColor: mix(color, 28, "var(--card)") },
          showKindLabel: false,
          showKindDot: false,
          kindLabelClass: "text-muted-foreground",
          nameClass: "text-base",
        };
      }
      return {
        headerClass: QUIET_HEADER_CLASS,
        showKindLabel: true,
        showKindDot: true,
        kindLabelClass: "text-muted-foreground",
        nameClass: "text-sm",
      };
  }
}
