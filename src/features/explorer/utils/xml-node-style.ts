import type { CSSProperties } from "react";
import type { ExplorerNodeStyle } from "@/features/settings/services/settings-service";

/**
 * Presentation contract for the XML tree card, shared by the flow node and
 * the settings preview. Every style derives from the kind color via
 * color-mix, none paints a solid fill, and none changes the card's geometry
 * (XML_NODE_HEIGHT and the estimated widths stay fixed).
 */
export interface XmlNodeStyleSpec {
  /** Radius and horizontal padding classes; geometry-neutral. */
  shellClass: string;
  shellStyle: CSSProperties;
  /** Capsule only: the 22px circle behind the kind icon. */
  iconWrapperClass?: string;
  iconWrapperStyle?: CSSProperties;
}

const ROUNDED_SHELL = "rounded-lg pl-3 pr-2.5";

/** Background alpha (percent of the kind color over the card) by tree depth. */
export const XML_DEPTH_ALPHAS = [22, 14, 7] as const;
const XML_DEPTH_FLOOR = 4;

export function depthAlpha(depth: number): number {
  return XML_DEPTH_ALPHAS[Math.max(0, depth)] ?? XML_DEPTH_FLOOR;
}

function mix(color: string, percent: number, base: string): string {
  return `color-mix(in srgb, ${color} ${percent}%, ${base})`;
}

export function getXmlNodeStyleSpec(
  style: ExplorerNodeStyle,
  color: string,
  depth: number
): XmlNodeStyleSpec {
  switch (style) {
    case "capsule":
      return {
        shellClass: "rounded-full pl-1.5 pr-2.5",
        shellStyle: {
          backgroundColor: mix(color, 14, "var(--card)"),
          borderColor: mix(color, 50, "var(--border)"),
        },
        iconWrapperClass:
          "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full",
        iconWrapperStyle: { backgroundColor: mix(color, 25, "transparent") },
      };
    case "outline":
      return {
        shellClass: ROUNDED_SHELL,
        shellStyle: {
          backgroundColor: "transparent",
          borderColor: mix(color, 75, "var(--border)"),
          borderWidth: 1.5,
        },
      };
    case "depth": {
      const alpha = depthAlpha(depth);
      return {
        shellClass: ROUNDED_SHELL,
        shellStyle: {
          backgroundColor: mix(color, alpha, "var(--card)"),
          borderColor: mix(color, 20 + alpha, "var(--border)"),
        },
      };
    }
    case "soft":
    default:
      return {
        shellClass: ROUNDED_SHELL,
        shellStyle: {
          borderColor: mix(color, 35, "var(--border)"),
          background: `linear-gradient(135deg, ${mix(color, 12, "var(--card)")}, var(--card) 60%)`,
        },
      };
  }
}
