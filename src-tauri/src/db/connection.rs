use odbc_api::{Connection, ConnectionOptions, Environment};
use std::sync::OnceLock;

use crate::types::{AuthType, ConnectionParams};

static ODBC_ENV: OnceLock<Environment> = OnceLock::new();

pub fn get_environment() -> &'static Environment {
    ODBC_ENV.get_or_init(|| {
        Environment::new().expect("Failed to create ODBC environment")
    })
}

/// Detect the best available SQL Server ODBC driver.
/// Prefers newer versions (18 > 17 > any other SQL Server driver).
fn detect_sql_server_driver() -> Option<String> {
    let env = get_environment();

    let drivers: Vec<_> = env
        .drivers()
        .ok()?
        .into_iter()
        .filter(|d| d.description.contains("SQL Server"))
        .collect();

    // Prefer newer versions
    for version in ["18", "17"] {
        if let Some(driver) = drivers
            .iter()
            .find(|d| d.description.contains(&format!("ODBC Driver {} for SQL Server", version)))
        {
            return Some(driver.description.clone());
        }
    }

    // Fall back to any SQL Server driver
    drivers.first().map(|d| d.description.clone())
}

pub fn build_connection_string(params: &ConnectionParams) -> Result<String, String> {
    let driver = detect_sql_server_driver().ok_or_else(|| {
        "No SQL Server ODBC driver found. Please install ODBC Driver 17 or 18 for SQL Server."
            .to_string()
    })?;

    let trust_cert = if params.trust_server_certificate {
        "TrustServerCertificate=Yes;"
    } else {
        ""
    };

    let auth_part = match params.auth_type {
        AuthType::Windows => "Trusted_Connection=Yes;".to_string(),
        AuthType::SqlServer => {
            let username = params.username.as_deref().unwrap_or("");
            let password = params.password.as_deref().unwrap_or("");
            format!("Uid={};Pwd={};", username, password)
        }
    };

    Ok(format!(
        "Driver={{{}}};Server={};Database={};{}{}",
        driver, params.server, params.database, auth_part, trust_cert
    ))
}

pub fn create_connection(connection_string: &str) -> Result<Connection<'static>, odbc_api::Error> {
    let env = get_environment();
    env.connect_with_connection_string(connection_string, ConnectionOptions::default())
}
