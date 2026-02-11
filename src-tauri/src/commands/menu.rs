use serde::Deserialize;
use tauri::AppHandle;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MenuUiState {
    pub is_canvas_mode: bool,
    pub has_focus: bool,
    pub has_active_filters: bool,
}

#[tauri::command]
pub fn set_menu_ui_state_cmd(
    app_handle: AppHandle,
    state: MenuUiState,
) -> Result<(), String> {
    crate::menu::set_menu_ui_state(
        &app_handle,
        state.is_canvas_mode,
        state.has_focus,
        state.has_active_filters,
    )
}
