mod commands;
mod db;
mod types;

use commands::{load_schema_cmd, load_schema_mock};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            load_schema_mock,
            load_schema_cmd
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
