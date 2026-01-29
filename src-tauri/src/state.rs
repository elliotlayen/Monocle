use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Default, Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub theme: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub schema_filter: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub focus_mode: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub focus_expand_threshold: Option<u32>,
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
    pub focus_mode: Option<String>,
    pub focus_expand_threshold: Option<u32>,
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
        if let Some(focus_mode) = update.focus_mode {
            settings.focus_mode = Some(focus_mode);
        }
        if let Some(threshold) = update.focus_expand_threshold {
            settings.focus_expand_threshold = Some(threshold);
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
                focus_mode: None,
                focus_expand_threshold: None,
            })
            .expect("update settings");

        let reloaded = AppState::new(dir.path().to_path_buf());
        let settings = reloaded.get_settings().expect("get settings");

        assert_eq!(settings.theme.as_deref(), Some("light"));
        assert_eq!(settings.schema_filter.as_deref(), Some("sales"));
    }
}
