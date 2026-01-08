use crate::db::get_environment;
use crate::types::DataSourceInfo;

#[tauri::command]
pub async fn list_data_sources() -> Result<Vec<DataSourceInfo>, String> {
    tokio::task::spawn_blocking(|| {
        let env = get_environment();

        let mut dsns = Vec::new();

        match env.data_sources() {
            Ok(iter) => {
                for ds in iter {
                    dsns.push(DataSourceInfo {
                        name: ds.server_name.clone(),
                        description: ds.driver.clone(),
                    });
                }
            }
            Err(e) => return Err(format!("Failed to enumerate data sources: {}", e)),
        }

        Ok(dsns)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}
