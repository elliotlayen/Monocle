use crate::db::{build_connection_string, load_schema_from_connection, SchemaError};
use crate::types::{ConnectionParams, SchemaGraph};

#[tauri::command]
pub async fn load_schema(params: ConnectionParams) -> Result<SchemaGraph, SchemaError> {
    let connection_string = build_connection_string(&params).map_err(SchemaError::Driver)?;

    // Run ODBC operations in a blocking thread since ODBC is synchronous
    tokio::task::spawn_blocking(move || load_schema_from_connection(&connection_string))
        .await
        .map_err(|e| SchemaError::Parse(format!("Task join error: {}", e)))?
}
