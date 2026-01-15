use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Default, Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionHistory {
    pub server: String,
    pub database: String,
    pub username: String,
    pub last_used: String,
}

#[derive(Default, Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    #[serde(default)]
    pub recent_connections: Vec<ConnectionHistory>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub theme: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub schema_filter: Option<String>,
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

        let updated = settings.clone();
        drop(settings);
        self.save_settings()?;
        Ok(updated)
    }

    pub fn add_connection(&self, connection: ConnectionHistory) -> Result<(), String> {
        let mut settings = self.settings.lock().map_err(|e| e.to_string())?;

        // Remove existing connection with same server/database
        settings.recent_connections.retain(|c| {
            !(c.server == connection.server && c.database == connection.database)
        });

        // Add new connection at the beginning
        settings.recent_connections.insert(0, connection);

        // Keep only last 10 connections
        settings.recent_connections.truncate(10);

        drop(settings);
        self.save_settings()
    }

    pub fn remove_connection(&self, server: &str, database: &str) -> Result<(), String> {
        let mut settings = self.settings.lock().map_err(|e| e.to_string())?;

        settings.recent_connections.retain(|c| {
            !(c.server == server && c.database == database)
        });

        drop(settings);
        self.save_settings()
    }

    pub fn get_connections(&self) -> Result<Vec<ConnectionHistory>, String> {
        let settings = self.settings.lock().map_err(|e| e.to_string())?;
        Ok(settings.recent_connections.clone())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn sample_connection(server: &str, database: &str, username: &str) -> ConnectionHistory {
        ConnectionHistory {
            server: server.to_string(),
            database: database.to_string(),
            username: username.to_string(),
            last_used: "2024-01-01T00:00:00Z".to_string(),
        }
    }

    #[test]
    fn update_settings_preserves_connections() {
        let dir = tempdir().expect("tempdir");
        let state = AppState::new(dir.path().to_path_buf());

        state
            .add_connection(sample_connection("server", "db", "user"))
            .expect("add connection");

        let updated = state
            .update_settings(AppSettingsUpdate {
                theme: Some("dark".to_string()),
                schema_filter: Some("dbo".to_string()),
            })
            .expect("update settings");

        assert_eq!(updated.theme.as_deref(), Some("dark"));
        assert_eq!(updated.schema_filter.as_deref(), Some("dbo"));
        assert_eq!(state.get_connections().expect("get").len(), 1);
    }

    #[test]
    fn settings_persist_to_disk() {
        let dir = tempdir().expect("tempdir");
        let state = AppState::new(dir.path().to_path_buf());

        state
            .update_settings(AppSettingsUpdate {
                theme: Some("light".to_string()),
                schema_filter: Some("sales".to_string()),
            })
            .expect("update settings");

        let reloaded = AppState::new(dir.path().to_path_buf());
        let settings = reloaded.get_settings().expect("get settings");

        assert_eq!(settings.theme.as_deref(), Some("light"));
        assert_eq!(settings.schema_filter.as_deref(), Some("sales"));
    }

    #[test]
    fn add_connection_dedupes_and_caps_history() {
        let dir = tempdir().expect("tempdir");
        let state = AppState::new(dir.path().to_path_buf());

        for idx in 0..12 {
            state
                .add_connection(sample_connection(
                    &format!("server-{}", idx),
                    "db",
                    "user",
                ))
                .expect("add connection");
        }

        state
            .add_connection(sample_connection("server-11", "db", "user"))
            .expect("add duplicate");

        let connections = state.get_connections().expect("get connections");
        assert_eq!(connections.len(), 10);
        assert_eq!(connections[0].server, "server-11");
    }
}
