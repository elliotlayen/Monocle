import type {
  DetailViewMode,
  EdgeLabelMode,
  ExplorerNodeStyle,
  NodeStyle,
} from "@/features/settings/services/settings-service";

export const EDGE_LABEL_MODES: Array<{ label: string; value: EdgeLabelMode }> =
  [
    { label: "Auto", value: "auto" },
    { label: "Never", value: "never" },
    { label: "Always", value: "always" },
  ];

export const DETAIL_VIEW_OPTIONS: Array<{
  label: string;
  value: DetailViewMode;
}> = [
  { label: "Inspector panel", value: "inspector" },
  { label: "Bottom panel", value: "drawer" },
];

export const NODE_STYLE_OPTIONS: Array<{ label: string; value: NodeStyle }> = [
  { label: "Adaptive (solid when zoomed out)", value: "adaptive" },
  { label: "Tinted header", value: "tinted" },
  { label: "Tinted surface", value: "surface" },
  { label: "Solid header", value: "solid" },
];

export const EXPLORER_NODE_STYLE_OPTIONS: Array<{
  label: string;
  value: ExplorerNodeStyle;
}> = [
  { label: "Soft", value: "soft" },
  { label: "Capsule", value: "capsule" },
  { label: "Outline", value: "outline" },
  { label: "Depth-tinted", value: "depth" },
];
