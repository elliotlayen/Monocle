export const COMPACT_ZOOM = 0.6;
export const FOCUS_COMPACT_ZOOM = 0.4;
export const FORCE_COMPACT_ZOOM = 0.3;
export const EDGE_LABEL_ZOOM = 0.8;

export type ZoomBand =
  | "forceCompact"
  | "focusCompact"
  | "normalCompact"
  | "expanded";

export function getZoomBand(zoom: number): ZoomBand {
  if (zoom < FORCE_COMPACT_ZOOM) {
    return "forceCompact";
  }
  if (zoom < FOCUS_COMPACT_ZOOM) {
    return "focusCompact";
  }
  if (zoom < COMPACT_ZOOM) {
    return "normalCompact";
  }
  return "expanded";
}

export function isCompactForZoomBand(zoomBand: ZoomBand): boolean {
  return zoomBand !== "expanded";
}

export function isFocusModerateCompactForZoomBand(zoomBand: ZoomBand): boolean {
  return zoomBand === "forceCompact" || zoomBand === "focusCompact";
}

export function shouldShowEdgeLabelsAtZoom(zoom: number): boolean {
  return zoom >= EDGE_LABEL_ZOOM;
}
