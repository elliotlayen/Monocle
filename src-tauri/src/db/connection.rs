use odbc_api::{Connection, ConnectionOptions, Environment};
use std::sync::OnceLock;

use crate::types::{AuthType, ConnectionParams};

static ODBC_ENV: OnceLock<Environment> = OnceLock::new();

pub fn get_environment() -> &'static Environment {
    ODBC_ENV.get_or_init(|| {
        Environment::new().expect("Failed to create ODBC environment")
    })
}

pub fn build_connection_string(params: &ConnectionParams) -> String {
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

    format!(
        "Driver={{ODBC Driver 18 for SQL Server}};Server={};Database={};{}{}",
        params.server, params.database, auth_part, trust_cert
    )
}

pub fn create_connection(connection_string: &str) -> Result<Connection<'static>, odbc_api::Error> {
    let env = get_environment();
    env.connect_with_connection_string(connection_string, ConnectionOptions::default())
}
