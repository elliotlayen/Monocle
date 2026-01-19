use futures_util::TryStreamExt;

use crate::db::{create_server_client, SchemaError, LIST_DATABASES_QUERY};
use crate::types::ServerConnectionParams;

#[tauri::command]
pub async fn list_databases_cmd(params: ServerConnectionParams) -> Result<Vec<String>, SchemaError> {
    let mut client = create_server_client(&params).await?;

    let mut databases: Vec<String> = Vec::new();
    let mut stream = client.query(LIST_DATABASES_QUERY, &[]).await?.into_row_stream();

    while let Some(row) = stream.try_next().await? {
        if let Some(name) = row.get::<&str, _>(0) {
            databases.push(name.to_string());
        }
    }

    Ok(databases)
}
