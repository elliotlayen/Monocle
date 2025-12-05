import { EdgeType } from "@/stores/schemaStore";

export const EDGE_COLORS: Record<EdgeType, string> = {
  foreignKeys: "#3b82f6",
  triggerDependencies: "#f59e0b",
  triggerWrites: "#ef4444",
  procedureReads: "#8b5cf6",
  procedureWrites: "#ef4444",
  viewDependencies: "#10b981",
  functionReads: "#06b6d4",
};

export const EDGE_TYPE_LABELS: Record<EdgeType, string> = {
  foreignKeys: "Foreign Keys",
  triggerDependencies: "Trigger Dependencies",
  triggerWrites: "Trigger Writes",
  procedureReads: "Procedure Reads",
  procedureWrites: "Procedure Writes",
  viewDependencies: "View Dependencies",
  functionReads: "Function Reads",
};

// Consolidated labels for the color key (combines entries with same color)
export const EDGE_COLOR_KEY: Array<{ color: string; label: string }> = [
  { color: "#3b82f6", label: "Foreign Keys" },
  { color: "#f59e0b", label: "Trigger Dependencies" },
  { color: "#8b5cf6", label: "Procedure Reads" },
  { color: "#06b6d4", label: "Function Reads" },
  { color: "#ef4444", label: "Trigger/Procedure Writes" },
  { color: "#10b981", label: "View Dependencies" },
];
