use std::net::{IpAddr, SocketAddr, ToSocketAddrs};
use std::time::Duration;
use tokio::net::UdpSocket;
use tokio::time::timeout;

const SSRP_PORT: u16 = 1434;
const SSRP_TIMEOUT: Duration = Duration::from_secs(2);

#[derive(Debug, thiserror::Error)]
pub enum SsrpError {
    #[error("Could not resolve host `{host}` for SQL Server Browser lookup")]
    HostResolution { host: String },
    #[error("Timed out waiting for SQL Server Browser response on UDP 1434")]
    Timeout,
    #[error("SQL Server Browser returned an invalid response")]
    InvalidResponse,
    #[error("SQL Server Browser did not return a TCP port for instance `{instance}`")]
    PortNotFound { instance: String },
    #[error("Network error during SQL Server Browser lookup: {0}")]
    Io(#[from] std::io::Error),
}

/// Resolve a named instance to its TCP port using SQL Server Browser (SSRP protocol).
pub async fn resolve_instance_port(host: &str, instance: &str) -> Result<u16, SsrpError> {
    let browser_addrs = resolve_browser_addrs(host)?;

    // Build CLNT_UCAST_INST request: 0x04 + instance_name
    let mut request = vec![0x04];
    request.extend_from_slice(instance.as_bytes());

    let mut timed_out = false;
    let mut invalid_response = false;
    let mut missing_port = false;
    let mut last_io_error: Option<std::io::Error> = None;

    for browser_addr in browser_addrs {
        let bind_addr = if browser_addr.is_ipv4() {
            "0.0.0.0:0"
        } else {
            "[::]:0"
        };

        let socket = match UdpSocket::bind(bind_addr).await {
            Ok(socket) => socket,
            Err(err) => {
                last_io_error = Some(err);
                continue;
            }
        };

        if let Err(err) = socket.send_to(&request, browser_addr).await {
            last_io_error = Some(err);
            continue;
        }

        // Receive response with timeout
        let mut buffer = [0u8; 1024];
        let (n, _) = match timeout(SSRP_TIMEOUT, socket.recv_from(&mut buffer)).await {
            Ok(Ok(result)) => result,
            Ok(Err(err)) => {
                last_io_error = Some(err);
                continue;
            }
            Err(_) => {
                timed_out = true;
                continue;
            }
        };

        match parse_ssrp_response(&buffer[..n], instance) {
            Ok(port) => return Ok(port),
            Err(SsrpError::InvalidResponse) => invalid_response = true,
            Err(SsrpError::PortNotFound { .. }) => missing_port = true,
            Err(err) => return Err(err),
        }
    }

    if missing_port {
        return Err(SsrpError::PortNotFound {
            instance: instance.to_string(),
        });
    }
    if invalid_response {
        return Err(SsrpError::InvalidResponse);
    }
    if timed_out {
        return Err(SsrpError::Timeout);
    }
    if let Some(err) = last_io_error {
        return Err(SsrpError::Io(err));
    }

    Err(SsrpError::HostResolution {
        host: host.to_string(),
    })
}

fn resolve_browser_addrs(host: &str) -> Result<Vec<SocketAddr>, SsrpError> {
    // Try parsing as IP address first
    if let Ok(ip) = host.parse::<IpAddr>() {
        return Ok(vec![SocketAddr::new(ip, SSRP_PORT)]);
    }

    let addrs: Vec<SocketAddr> = format!("{}:{}", host, SSRP_PORT)
        .to_socket_addrs()
        .map_err(|_| SsrpError::HostResolution {
            host: host.to_string(),
        })?
        .collect();

    if addrs.is_empty() {
        return Err(SsrpError::HostResolution {
            host: host.to_string(),
        });
    }

    Ok(addrs)
}

fn parse_ssrp_response(data: &[u8], instance: &str) -> Result<u16, SsrpError> {
    // Response format: 0x05 + 2-byte length (little-endian) + data string
    if data.len() < 3 || data[0] != 0x05 {
        return Err(SsrpError::InvalidResponse);
    }

    // Skip header (3 bytes) and parse the response string
    let response_str = String::from_utf8_lossy(&data[3..]);

    // Response is semicolon-delimited key-value pairs:
    // ServerName;HOSTNAME;InstanceName;INSTANCE;IsClustered;No;Version;X.X.X.X;tcp;PORT;np;...;;
    let parts: Vec<&str> = response_str.split(';').collect();
    for window in parts.windows(2) {
        if window[0].eq_ignore_ascii_case("tcp") {
            return window[1].parse().map_err(|_| SsrpError::InvalidResponse);
        }
    }

    Err(SsrpError::PortNotFound {
        instance: instance.to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_ssrp_response_extracts_port() {
        // Simulated SSRP response
        let mut response = vec![0x05, 0x50, 0x00]; // Header: 0x05 + length
        response.extend_from_slice(
            b"ServerName;TESTSERVER;InstanceName;TESTINSTANCE;IsClustered;No;Version;16.0.1000.6;tcp;1444;np;\\\\TESTSERVER\\pipe\\MSSQL$TESTINSTANCE\\sql\\query;;"
        );

        let port = parse_ssrp_response(&response, "TESTINSTANCE")
            .expect("expected SSRP parser to extract TCP port");
        assert_eq!(port, 1444);
    }

    #[test]
    fn parse_ssrp_response_handles_invalid() {
        // Invalid response (wrong header)
        let response = vec![0x04, 0x00, 0x00];
        assert!(matches!(
            parse_ssrp_response(&response, "TESTINSTANCE"),
            Err(SsrpError::InvalidResponse)
        ));

        // Too short
        let response = vec![0x05, 0x00];
        assert!(matches!(
            parse_ssrp_response(&response, "TESTINSTANCE"),
            Err(SsrpError::InvalidResponse)
        ));

        // No tcp entry
        let mut response = vec![0x05, 0x10, 0x00];
        response.extend_from_slice(b"ServerName;TEST;;");
        assert!(matches!(
            parse_ssrp_response(&response, "TESTINSTANCE"),
            Err(SsrpError::PortNotFound { .. })
        ));
    }

    #[test]
    fn resolve_browser_addrs_parses_ip() {
        let ipv4 =
            resolve_browser_addrs("192.168.1.1").expect("expected IPv4 address to resolve");
        assert_eq!(ipv4, vec!["192.168.1.1:1434".parse().unwrap()]);

        let loopback =
            resolve_browser_addrs("127.0.0.1").expect("expected loopback address to resolve");
        assert_eq!(loopback, vec!["127.0.0.1:1434".parse().unwrap()]);
    }

    #[test]
    fn resolve_browser_addrs_invalid_host() {
        assert!(matches!(
            resolve_browser_addrs("%%"),
            Err(SsrpError::HostResolution { .. })
        ));
    }
}
