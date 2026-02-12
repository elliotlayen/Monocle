use tiberius::{AuthMethod, Client, Config, EncryptionLevel};
use tokio::net::TcpStream;
use tokio_util::compat::TokioAsyncWriteCompatExt;

use crate::db::ssrp::resolve_instance_port;
use crate::types::{AuthType, ConnectionParams, ServerConnectionParams};

#[derive(Debug, thiserror::Error)]
pub enum ConnectionError {
    #[error("Database error: {0}")]
    Tiberius(#[from] tiberius::error::Error),
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("{0}")]
    Auth(String),
    #[error(
        "Could not resolve SQL Server instance `{server}\\{instance}` via SQL Server Browser (UDP 1434): {reason}. Verify SQL Server Browser is running and firewall allows UDP 1434, or connect using `server,port`."
    )]
    InstanceResolution {
        server: String,
        instance: String,
        reason: String,
    },
}

pub async fn create_client(params: &ConnectionParams) -> Result<Client<tokio_util::compat::Compat<TcpStream>>, ConnectionError> {
    let mut config = Config::new();

    // Parse server and port (format: "server", "server,port", "server:port", or "server\instance")
    let (host, port) = parse_server_async(&params.server).await?;
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

/// Create a client connected to the master database for listing databases
pub async fn create_server_client(params: &ServerConnectionParams) -> Result<Client<tokio_util::compat::Compat<TcpStream>>, ConnectionError> {
    let mut config = Config::new();

    // Parse server and port (format: "server", "server,port", "server:port", or "server\instance")
    let (host, port) = parse_server_async(&params.server).await?;
    config.host(&host);
    config.port(port);
    config.database("master"); // Connect to master database for listing databases

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

/// Parse server string into host and port, resolving named instances via SSRP.
/// Supports formats: "server", "server,port", "server:port", "server\instance"
async fn parse_server_async(server: &str) -> Result<(String, u16), ConnectionError> {
    const DEFAULT_PORT: u16 = 1433;

    // Check for explicit port (comma separator - SQL Server style)
    if let Some((host, port_str)) = server.split_once(',') {
        if let Ok(port) = port_str.trim().parse::<u16>() {
            return Ok((host.trim().to_string(), port));
        }
    }

    // Check for explicit port (colon separator)
    if let Some((host, port_str)) = server.rsplit_once(':') {
        if let Ok(port) = port_str.trim().parse::<u16>() {
            return Ok((host.trim().to_string(), port));
        }
    }

    // Check for named instance (backslash separator)
    if let Some((host, instance)) = server.split_once('\\') {
        let host = host.trim();
        let instance = instance.trim();
        match resolve_instance_port(host, instance).await {
            Ok(port) => return Ok((host.to_string(), port)),
            Err(err) => {
                return Err(ConnectionError::InstanceResolution {
                    server: host.to_string(),
                    instance: instance.to_string(),
                    reason: err.to_string(),
                });
            }
        }
    }

    Ok((server.to_string(), DEFAULT_PORT))
}

/// Synchronous version for testing - does not support named instances
#[cfg(test)]
fn parse_server(server: &str) -> (String, u16) {
    const DEFAULT_PORT: u16 = 1433;

    if let Some((host, port_str)) = server.split_once(',') {
        if let Ok(port) = port_str.trim().parse::<u16>() {
            return (host.trim().to_string(), port);
        }
    }

    if let Some((host, port_str)) = server.rsplit_once(':') {
        if let Ok(port) = port_str.trim().parse::<u16>() {
            return (host.trim().to_string(), port);
        }
    }

    (server.to_string(), DEFAULT_PORT)
}

#[cfg(test)]
mod tests {
    use super::{parse_server, parse_server_async, ConnectionError};

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

    #[tokio::test]
    async fn parse_server_instance_resolution_failure_returns_explicit_error() {
        let result = parse_server_async("%%\\INSTANCE").await;
        assert!(matches!(
            result,
            Err(ConnectionError::InstanceResolution { .. })
        ));
    }
}
