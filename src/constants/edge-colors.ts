import { EdgeType, ObjectType } from "@/features/schema-graph/store";

export const EDGE_COLORS: Record<EdgeType, string> = {
  relationships: "#3b82f6",
  triggerDependencies: "#f59e0b",
  triggerWrites: "#ef4444",
  procedureReads: "#8b5cf6",
  procedureWrites: "#ef4444",
  viewDependencies: "#10b981",
  functionReads: "#06b6d4",
};

export const EDGE_TYPE_LABELS: Record<EdgeType, string> = {
  relationships: "Relationships",
  triggerDependencies: "Trigger Dependencies",
  triggerWrites: "Trigger Writes",
  procedureReads: "Procedure Reads",
  procedureWrites: "Procedure Writes",
  viewDependencies: "View Dependencies",
  functionReads: "Function Reads",
};

export const OBJECT_COLORS: Record<ObjectType, string> = {
  tables: "#3b82f6",
  views: "#10b981",
  triggers: "#f59e0b",
  storedProcedures: "#8b5cf6",
  scalarFunctions: "#06b6d4",
};
