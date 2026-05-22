use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Default, Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct FolderSource {
    pub id: String,
    pub path: String,
    pub label: String,
    #[serde(default)]
    pub tag: String,
    #[serde(default)]
    pub favorites: Vec<String>,
}

#[derive(Default, Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub theme: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub schema_filter: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub focus_expand_threshold: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub edge_label_mode: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub show_mini_map: Option<bool>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub folder_sources: Vec<FolderSource>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub explorer_sidebar_width: Option<f64>,
}

pub struct AppState {
    pub settings: Mutex<AppSettings>,
    pub storage_path: PathBuf,
}

#[derive(Default, Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AppSettingsUpdate {
    pub theme: Option<String>,
    pub schema_filter: Option<String>,
    pub focus_expand_threshold: Option<u32>,
    pub edge_label_mode: Option<String>,
    pub show_mini_map: Option<bool>,
    pub folder_sources: Option<Vec<FolderSource>>,
    pub explorer_sidebar_width: Option<f64>,
}

impl AppState {
    pub fn new(storage_path: PathBuf) -> Self {
        let settings = Self::read_settings(&storage_path).unwrap_or_default();
        Self {
            settings: Mutex::new(settings),
            storage_path,
        }
    }

    fn read_settings(storage_path: &PathBuf) -> Option<AppSettings> {
        let settings_file = storage_path.join("settings.json");
        if settings_file.exists() {
            let content = std::fs::read_to_string(&settings_file).ok()?;
            serde_json::from_str(&content).ok()
        } else {
            None
        }
    }

    pub fn save_settings(&self) -> Result<(), String> {
        let settings = self.settings.lock().map_err(|e| e.to_string())?;

        // Ensure directory exists
        if !self.storage_path.exists() {
            std::fs::create_dir_all(&self.storage_path)
                .map_err(|e| format!("Failed to create storage directory: {}", e))?;
        }

        let settings_file = self.storage_path.join("settings.json");
        let content = serde_json::to_string_pretty(&*settings)
            .map_err(|e| format!("Failed to serialize settings: {}", e))?;

        std::fs::write(&settings_file, content)
            .map_err(|e| format!("Failed to write settings: {}", e))?;

        Ok(())
    }

    pub fn get_settings(&self) -> Result<AppSettings, String> {
        let settings = self.settings.lock().map_err(|e| e.to_string())?;
        Ok(settings.clone())
    }

    pub fn update_settings(&self, update: AppSettingsUpdate) -> Result<AppSettings, String> {
        let mut settings = self.settings.lock().map_err(|e| e.to_string())?;

        if let Some(theme) = update.theme {
            settings.theme = Some(theme);
        }
        if let Some(schema_filter) = update.schema_filter {
            settings.schema_filter = Some(schema_filter);
        }
        if let Some(threshold) = update.focus_expand_threshold {
            settings.focus_expand_threshold = Some(threshold);
        }
        if let Some(edge_label_mode) = update.edge_label_mode {
            settings.edge_label_mode = Some(edge_label_mode);
        }
        if let Some(show_mini_map) = update.show_mini_map {
            settings.show_mini_map = Some(show_mini_map);
        }
        if let Some(folder_sources) = update.folder_sources {
            settings.folder_sources = folder_sources;
        }
        if let Some(explorer_sidebar_width) = update.explorer_sidebar_width {
            settings.explorer_sidebar_width = Some(explorer_sidebar_width);
        }

        let updated = settings.clone();
        drop(settings);
        self.save_settings()?;
        Ok(updated)
    }

    pub fn toggle_favorite(&self, source_id: &str, client_name: &str) -> Result<AppSettings, String> {
        let mut settings = self.settings.lock().map_err(|e| e.to_string())?;

        if let Some(source) = settings.folder_sources.iter_mut().find(|s| s.id == source_id) {
            if let Some(pos) = source.favorites.iter().position(|f| f == client_name) {
                source.favorites.remove(pos);
            } else {
                source.favorites.push(client_name.to_string());
            }
        }

        let updated = settings.clone();
        drop(settings);
        self.save_settings()?;
        Ok(updated)
    }

}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn settings_persist_to_disk() {
        let dir = tempdir().expect("tempdir");
        let state = AppState::new(dir.path().to_path_buf());

        state
            .update_settings(AppSettingsUpdate {
                theme: Some("light".to_string()),
                schema_filter: Some("sales".to_string()),
                focus_expand_threshold: None,
                edge_label_mode: Some("auto".to_string()),
                show_mini_map: Some(true),
                folder_sources: None,
                explorer_sidebar_width: None,
            })
            .expect("update settings");

        let reloaded = AppState::new(dir.path().to_path_buf());
        let settings = reloaded.get_settings().expect("get settings");

        assert_eq!(settings.theme.as_deref(), Some("light"));
        assert_eq!(settings.schema_filter.as_deref(), Some("sales"));
        assert_eq!(settings.edge_label_mode.as_deref(), Some("auto"));
        assert_eq!(settings.show_mini_map, Some(true));
    }

    #[test]
    fn folder_sources_round_trip() {
        let dir = tempdir().expect("tempdir");
        let state = AppState::new(dir.path().to_path_buf());

        let sources = vec![FolderSource {
            id: "src-1".to_string(),
            path: "\\\\server\\share".to_string(),
            label: "Inbound".to_string(),
            tag: "Production".to_string(),
            favorites: vec!["ClientA".to_string()],
        }];

        state
            .update_settings(AppSettingsUpdate {
                folder_sources: Some(sources.clone()),
                ..Default::default()
            })
            .expect("update settings");

        let reloaded = AppState::new(dir.path().to_path_buf());
        let settings = reloaded.get_settings().expect("get settings");

        assert_eq!(settings.folder_sources.len(), 1);
        assert_eq!(settings.folder_sources[0].id, "src-1");
        assert_eq!(settings.folder_sources[0].path, "\\\\server\\share");
        assert_eq!(settings.folder_sources[0].label, "Inbound");
        assert_eq!(settings.folder_sources[0].tag, "Production");
        assert_eq!(settings.folder_sources[0].favorites, vec!["ClientA"]);
    }

    #[test]
    fn toggle_favorite_adds_and_removes() {
        let dir = tempdir().expect("tempdir");
        let state = AppState::new(dir.path().to_path_buf());

        let sources = vec![FolderSource {
            id: "src-1".to_string(),
            path: "/data".to_string(),
            label: "Data".to_string(),
            tag: String::new(),
            favorites: vec![],
        }];

        state
            .update_settings(AppSettingsUpdate {
                folder_sources: Some(sources),
                ..Default::default()
            })
            .expect("update settings");

        // Toggle on
        let updated = state.toggle_favorite("src-1", "ClientX").expect("toggle on");
        assert!(updated.folder_sources[0].favorites.contains(&"ClientX".to_string()));

        // Toggle off
        let updated = state.toggle_favorite("src-1", "ClientX").expect("toggle off");
        assert!(!updated.folder_sources[0].favorites.contains(&"ClientX".to_string()));
    }
}
