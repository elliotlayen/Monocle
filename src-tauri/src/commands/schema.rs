use crate::db::{load_schema, SchemaError};
use crate::types::{ConnectionParams, SchemaGraph};

#[tauri::command]
pub async fn load_schema_cmd(params: ConnectionParams) -> Result<SchemaGraph, SchemaError> {
    load_schema(&params).await
}
