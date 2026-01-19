use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Column {
    pub name: String,
    pub data_type: String,
    pub is_nullable: bool,
    pub is_primary_key: bool,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub source_table: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub source_column: Option<String>,
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
pub struct ViewNode {
    pub id: String,
    pub name: String,
    pub schema: String,
    pub columns: Vec<Column>,
    pub definition: String,
    pub referenced_tables: Vec<String>,
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
    pub referenced_tables: Vec<String>,
    pub affected_tables: Vec<String>,
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
    pub referenced_tables: Vec<String>,
    pub affected_tables: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScalarFunction {
    pub id: String,
    pub name: String,
    pub schema: String,
    pub function_type: String,
    pub parameters: Vec<ProcedureParameter>,
    pub return_type: String,
    pub definition: String,
    pub referenced_tables: Vec<String>,
    pub affected_tables: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchemaGraph {
    pub tables: Vec<TableNode>,
    pub views: Vec<ViewNode>,
    pub relationships: Vec<RelationshipEdge>,
    pub triggers: Vec<Trigger>,
    pub stored_procedures: Vec<StoredProcedure>,
    pub scalar_functions: Vec<ScalarFunction>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum AuthType {
    #[default]
    SqlServer,
    Windows,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionParams {
    pub server: String,
    pub database: String,
    #[serde(default)]
    pub auth_type: AuthType,
    #[serde(default)]
    pub username: Option<String>,
    #[serde(default)]
    pub password: Option<String>,
    #[serde(default)]
    pub trust_server_certificate: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerConnectionParams {
    pub server: String,
    #[serde(default)]
    pub auth_type: AuthType,
    #[serde(default)]
    pub username: Option<String>,
    #[serde(default)]
    pub password: Option<String>,
    #[serde(default)]
    pub trust_server_certificate: bool,
}
