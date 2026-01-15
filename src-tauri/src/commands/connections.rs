use crate::state::{AppState, ConnectionHistory};
use chrono::Utc;
use tauri::State;

#[tauri::command]
pub fn get_recent_connections(
    state: State<'_, AppState>,
) -> Result<Vec<ConnectionHistory>, String> {
    state.get_connections()
}

#[tauri::command]
pub fn save_connection(
    state: State<'_, AppState>,
    server: String,
    database: String,
    username: String,
) -> Result<(), String> {
    let connection = ConnectionHistory {
        server,
        database,
        username,
        last_used: Utc::now().to_rfc3339(),
    };
    state.add_connection(connection)
}

#[tauri::command]
pub fn delete_connection(
    state: State<'_, AppState>,
    server: String,
    database: String,
) -> Result<(), String> {
    state.remove_connection(&server, &database)
}
