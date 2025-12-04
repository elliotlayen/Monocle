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

// Foreign key relationship
export interface RelationshipEdge {
  id: string; // Unique FK identifier
  from: string; // Source table ID ("schema.table")
  to: string; // Target table ID ("schema.table")
  fromColumn: string; // FK column in source
  toColumn: string; // Referenced column in target
}

// Complete schema graph
export interface SchemaGraph {
  tables: TableNode[];
  relationships: RelationshipEdge[];
}

// Connection parameters
export interface ConnectionParams {
  server: string;
  database: string;
  username: string;
  password: string;
  trustServerCertificate?: boolean;
}
