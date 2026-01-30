use std::net::{IpAddr, SocketAddr, ToSocketAddrs};
use std::time::Duration;
use tokio::net::UdpSocket;
use tokio::time::timeout;

const SSRP_PORT: u16 = 1434;
const SSRP_TIMEOUT: Duration = Duration::from_secs(2);

/// Resolve a named instance to its TCP port using SQL Server Browser (SSRP protocol).
/// Returns None if the browser service is unavailable or the instance is not found.
pub async fn resolve_instance_port(host: &str, instance: &str) -> Option<u16> {
    // Resolve hostname to IP
    let ip = resolve_host(host)?;
    let browser_addr = SocketAddr::new(ip, SSRP_PORT);

    // Create UDP socket bound to any available port
    let socket = UdpSocket::bind("0.0.0.0:0").await.ok()?;

    // Build CLNT_UCAST_INST request: 0x04 + instance_name + 0x00
    let mut request = vec![0x04];
    request.extend_from_slice(instance.as_bytes());
    request.push(0x00);

    // Send request to SQL Server Browser
    socket.send_to(&request, browser_addr).await.ok()?;

    // Receive response with timeout
    let mut buffer = [0u8; 1024];
    let (n, _) = timeout(SSRP_TIMEOUT, socket.recv_from(&mut buffer))
        .await
        .ok()?
        .ok()?;

    // Parse response for TCP port
    parse_ssrp_response(&buffer[..n])
}

fn resolve_host(host: &str) -> Option<IpAddr> {
    // Try parsing as IP address first
    if let Ok(ip) = host.parse::<IpAddr>() {
        return Some(ip);
    }
    // Fall back to DNS resolution
    format!("{}:0", host)
        .to_socket_addrs()
        .ok()?
        .next()
        .map(|addr| addr.ip())
}

fn parse_ssrp_response(data: &[u8]) -> Option<u16> {
    // Response format: 0x05 + 2-byte length (little-endian) + data string
    if data.len() < 3 || data[0] != 0x05 {
        return None;
    }

    // Skip header (3 bytes) and parse the response string
    let response_str = String::from_utf8_lossy(&data[3..]);

    // Response is semicolon-delimited key-value pairs:
    // ServerName;HOSTNAME;InstanceName;INSTANCE;IsClustered;No;Version;X.X.X.X;tcp;PORT;np;...;;
    let parts: Vec<&str> = response_str.split(';').collect();
    for window in parts.windows(2) {
        if window[0].eq_ignore_ascii_case("tcp") {
            return window[1].parse().ok();
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_ssrp_response_extracts_port() {
        // Simulated SSRP response
        let mut response = vec![0x05, 0x50, 0x00]; // Header: 0x05 + length
        response.extend_from_slice(
            b"ServerName;TESTSERVER;InstanceName;SQLEXPRESS;IsClustered;No;Version;16.0.1000.6;tcp;1444;np;\\\\TESTSERVER\\pipe\\MSSQL$SQLEXPRESS\\sql\\query;;"
        );

        let port = parse_ssrp_response(&response);
        assert_eq!(port, Some(1444));
    }

    #[test]
    fn parse_ssrp_response_handles_invalid() {
        // Invalid response (wrong header)
        let response = vec![0x04, 0x00, 0x00];
        assert_eq!(parse_ssrp_response(&response), None);

        // Too short
        let response = vec![0x05, 0x00];
        assert_eq!(parse_ssrp_response(&response), None);

        // No tcp entry
        let mut response = vec![0x05, 0x10, 0x00];
        response.extend_from_slice(b"ServerName;TEST;;");
        assert_eq!(parse_ssrp_response(&response), None);
    }

    #[test]
    fn resolve_host_parses_ip() {
        assert_eq!(
            resolve_host("192.168.1.1"),
            Some("192.168.1.1".parse().unwrap())
        );
        assert_eq!(
            resolve_host("127.0.0.1"),
            Some("127.0.0.1".parse().unwrap())
        );
    }
}
