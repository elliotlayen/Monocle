// Column definition
export interface Column {
  name: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
}

// Table node representation
export interface TableNode {
  id: string; // Format: "schema.table"
  name: string; // Table name only
  schema: string; // Schema name (e.g., "dbo")
  columns: Column[];
}

// View node representation
export interface ViewNode {
  id: string; // Format: "schema.view"
  name: string; // View name only
  schema: string; // Schema name (e.g., "dbo")
  columns: Column[];
}

// Foreign key relationship
export interface RelationshipEdge {
  id: string; // Unique FK identifier
  from: string; // Source table ID ("schema.table")
  to: string; // Target table ID ("schema.table")
  fromColumn: string; // FK column in source
  toColumn: string; // Referenced column in target
}

// Trigger definition
export interface Trigger {
  id: string; // Format: "schema.table.trigger_name"
  name: string;
  schema: string;
  tableId: string; // Parent table ID ("schema.table")
  triggerType: string; // e.g., "AFTER", "INSTEAD OF"
  isDisabled: boolean;
  firesOnInsert: boolean;
  firesOnUpdate: boolean;
  firesOnDelete: boolean;
  definition: string; // SQL definition
}

// Stored procedure parameter
export interface ProcedureParameter {
  name: string;
  dataType: string;
  isOutput: boolean;
}

// Stored procedure definition
export interface StoredProcedure {
  id: string; // Format: "schema.procedure_name"
  name: string;
  schema: string;
  procedureType: string; // e.g., "SQL_STORED_PROCEDURE"
  parameters: ProcedureParameter[];
  definition: string; // SQL definition
}

// Complete schema graph
export interface SchemaGraph {
  tables: TableNode[];
  views: ViewNode[];
  relationships: RelationshipEdge[];
  triggers: Trigger[];
  storedProcedures: StoredProcedure[];
}

// Connection parameters
export interface ConnectionParams {
  server: string;
  database: string;
  username: string;
  password: string;
  trustServerCertificate?: boolean;
}
