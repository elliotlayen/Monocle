import { ObjectType } from "@/features/schema-graph/store";

export const OBJECT_TYPE_LABELS: Record<ObjectType, string> = {
  tables: "Tables",
  views: "Views",
  triggers: "Triggers",
  storedProcedures: "Stored Procedures",
  scalarFunctions: "Scalar Functions",
};

export const OBJECT_TYPE_SINGULAR_LABELS: Record<ObjectType, string> = {
  tables: "table",
  views: "view",
  triggers: "trigger",
  storedProcedures: "procedure",
  scalarFunctions: "function",
};

// Canonical display order for object types (filters, chips, legends).
export const OBJECT_TYPE_ORDER: ObjectType[] = [
  "tables",
  "views",
  "triggers",
  "storedProcedures",
  "scalarFunctions",
];
