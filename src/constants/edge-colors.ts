import { EdgeType, ObjectType } from "@/features/schema-graph/store";

// Single source of truth for object/edge color identity lives in src/index.css
// (--edge-* and --object-* tokens, themed for light and dark). These constants
// are CSS var references so every consumer (SVG strokes, inline styles,
// minimap, exports) resolves the same themed value.
export const EDGE_COLORS: Record<EdgeType, string> = {
  relationships: "var(--edge-relationships)",
  triggerReads: "var(--edge-trigger-reads)",
  triggerWrites: "var(--edge-trigger-writes)",
  procedureReads: "var(--edge-procedure-reads)",
  procedureWrites: "var(--edge-procedure-writes)",
  viewDependencies: "var(--edge-view-dependencies)",
  functionReads: "var(--edge-function-reads)",
  codeCalls: "var(--edge-code-calls)",
};

export const EDGE_TYPE_LABELS: Record<EdgeType, string> = {
  relationships: "Relationships",
  triggerReads: "Trigger Reads",
  triggerWrites: "Trigger Writes",
  procedureReads: "Procedure Reads",
  procedureWrites: "Procedure Writes",
  viewDependencies: "View Dependencies",
  functionReads: "Function Reads",
  codeCalls: "Calls",
};

export const OBJECT_COLORS: Record<ObjectType, string> = {
  tables: "var(--object-tables)",
  views: "var(--object-views)",
  triggers: "var(--object-triggers)",
  storedProcedures: "var(--object-procedures)",
  scalarFunctions: "var(--object-functions)",
};
