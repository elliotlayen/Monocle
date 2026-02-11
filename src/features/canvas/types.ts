import type {
  SchemaGraph,
  Column,
  ProcedureParameter,
} from "@/features/schema-graph/types";

export interface CanvasFile {
  metadata: {
    version: "1.0";
    createdAt: string;
    lastModifiedAt: string;
  };
  schema: SchemaGraph;
  nodePositions: Record<string, { x: number; y: number }>;
}

export interface CreateTableInput {
  name: string;
  schema: string;
  columns: Column[];
}

export interface CreateViewInput {
  name: string;
  schema: string;
  columns: Column[];
  definition?: string;
}

export interface CreateTriggerInput {
  name: string;
  schema: string;
  tableId: string;
  triggerType?: string;
  firesOnInsert?: boolean;
  firesOnUpdate?: boolean;
  firesOnDelete?: boolean;
  definition?: string;
}

export interface CreateProcedureInput {
  name: string;
  schema: string;
  parameters?: ProcedureParameter[];
  definition?: string;
}

export interface CreateFunctionInput {
  name: string;
  schema: string;
  parameters?: ProcedureParameter[];
  returnType?: string;
  definition?: string;
}
