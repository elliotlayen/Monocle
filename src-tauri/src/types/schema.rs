use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Column {
    pub name: String,
    pub data_type: String,
    pub is_nullable: bool,
    pub is_primary_key: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TableNode {
    pub id: String,
    pub name: String,
    pub schema: String,
    pub columns: Vec<Column>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RelationshipEdge {
    pub id: String,
    pub from: String,
    pub to: String,
    pub from_column: String,
    pub to_column: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcedureParameter {
    pub name: String,
    pub data_type: String,
    pub is_output: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Trigger {
    pub id: String,
    pub name: String,
    pub schema: String,
    pub table_id: String,
    pub trigger_type: String,
    pub is_disabled: bool,
    pub fires_on_insert: bool,
    pub fires_on_update: bool,
    pub fires_on_delete: bool,
    pub definition: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredProcedure {
    pub id: String,
    pub name: String,
    pub schema: String,
    pub procedure_type: String,
    pub parameters: Vec<ProcedureParameter>,
    pub definition: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchemaGraph {
    pub tables: Vec<TableNode>,
    pub relationships: Vec<RelationshipEdge>,
    pub triggers: Vec<Trigger>,
    pub stored_procedures: Vec<StoredProcedure>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionParams {
    pub server: String,
    pub database: String,
    pub username: String,
    pub password: String,
    #[serde(default)]
    pub trust_server_certificate: bool,
}
