use crate::state::{AppSettings, AppSettingsUpdate, AppState};
use tauri::State;

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> Result<AppSettings, String> {
    state.get_settings()
}

#[tauri::command]
pub fn save_settings(
    state: State<'_, AppState>,
    settings: AppSettingsUpdate,
) -> Result<AppSettings, String> {
    state.update_settings(settings)
}
