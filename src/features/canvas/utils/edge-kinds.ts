import type { SchemaGraph } from "@/features/schema-graph/types";
import type { EdgeType } from "@/features/schema-graph/store";

export type NodeKind =
  | "table"
  | "view"
  | "trigger"
  | "procedure"
  | "function"
  | "unknown";

export const getNodeKind = (schema: SchemaGraph, id: string): NodeKind => {
  if (schema.tables.some((t) => t.id === id)) return "table";
  if (schema.views.some((v) => v.id === id)) return "view";
  if (schema.triggers.some((t) => t.id === id)) return "trigger";
  if (schema.storedProcedures.some((p) => p.id === id)) return "procedure";
  if (schema.scalarFunctions.some((f) => f.id === id)) return "function";
  return "unknown";
};

export const getAllowedEdgeKinds = (
  schema: SchemaGraph,
  sourceId: string,
  targetId: string
): EdgeType[] => {
  const sourceKind = getNodeKind(schema, sourceId);
  const targetKind = getNodeKind(schema, targetId);

  const sourceIsTableLike = sourceKind === "table" || sourceKind === "view";
  const targetIsTableLike = targetKind === "table" || targetKind === "view";

  if (sourceIsTableLike && targetKind === "view") {
    return ["viewDependencies"];
  }

  if (sourceKind === "view" && targetIsTableLike && targetKind !== "view") {
    return [];
  }

  if (sourceIsTableLike && targetIsTableLike) {
    return ["relationships"];
  }

  if (sourceIsTableLike && targetKind === "trigger") {
    return ["triggerDependencies"];
  }

  if (sourceKind === "trigger" && targetIsTableLike) {
    return ["triggerDependencies", "triggerWrites"];
  }

  if (sourceIsTableLike && targetKind === "procedure") {
    return ["procedureReads"];
  }

  if (sourceKind === "procedure" && targetIsTableLike) {
    return ["procedureWrites"];
  }

  if (sourceIsTableLike && targetKind === "function") {
    return ["functionReads"];
  }

  return [];
};
