use tiberius::{AuthMethod, Client, Config, EncryptionLevel};
use tokio::net::TcpStream;
use tokio_util::compat::TokioAsyncWriteCompatExt;

use crate::types::{AuthType, ConnectionParams};

#[derive(Debug, thiserror::Error)]
pub enum ConnectionError {
    #[error("Database error: {0}")]
    Tiberius(#[from] tiberius::error::Error),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("{0}")]
    Auth(String),
}

pub async fn create_client(params: &ConnectionParams) -> Result<Client<tokio_util::compat::Compat<TcpStream>>, ConnectionError> {
    let mut config = Config::new();

    // Parse server and port (format: "server" or "server,port" or "server:port")
    let (host, port) = parse_server(&params.server);
    config.host(&host);
    config.port(port);
    config.database(&params.database);

    // Configure authentication
    match params.auth_type {
        AuthType::Windows => {
            #[cfg(windows)]
            {
                config.authentication(AuthMethod::Integrated);
            }
            #[cfg(not(windows))]
            {
                return Err(ConnectionError::Auth(
                    "Windows Authentication is only supported on Windows".to_string(),
                ));
            }
        }
        AuthType::SqlServer => {
            let username = params.username.as_deref().unwrap_or("");
            let password = params.password.as_deref().unwrap_or("");
            config.authentication(AuthMethod::sql_server(username, password));
        }
    }

    // Configure TLS
    if params.trust_server_certificate {
        config.trust_cert();
    }
    config.encryption(EncryptionLevel::Required);

    // Connect via TCP
    let tcp = TcpStream::connect(config.get_addr()).await?;
    tcp.set_nodelay(true)?;

    // Create tiberius client
    let client = Client::connect(config, tcp.compat_write()).await?;

    Ok(client)
}

/// Parse server string into host and port.
/// Supports formats: "server", "server,port", "server:port"
fn parse_server(server: &str) -> (String, u16) {
    const DEFAULT_PORT: u16 = 1433;

    // Try comma separator first (SQL Server style)
    if let Some((host, port_str)) = server.split_once(',') {
        if let Ok(port) = port_str.trim().parse::<u16>() {
            return (host.trim().to_string(), port);
        }
    }

    // Try colon separator
    if let Some((host, port_str)) = server.rsplit_once(':') {
        if let Ok(port) = port_str.trim().parse::<u16>() {
            return (host.trim().to_string(), port);
        }
    }

    (server.to_string(), DEFAULT_PORT)
}

#[cfg(test)]
mod tests {
    use super::parse_server;

    #[test]
    fn parse_server_with_comma() {
        let (host, port) = parse_server("sql.example.com,1444");
        assert_eq!(host, "sql.example.com");
        assert_eq!(port, 1444);
    }

    #[test]
    fn parse_server_with_colon() {
        let (host, port) = parse_server("sql.example.com:1555");
        assert_eq!(host, "sql.example.com");
        assert_eq!(port, 1555);
    }

    #[test]
    fn parse_server_defaults_port() {
        let (host, port) = parse_server("localhost");
        assert_eq!(host, "localhost");
        assert_eq!(port, 1433);
    }
}
