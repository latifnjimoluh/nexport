use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum Protocol {
    Tcp,
    Udp,
}

impl Protocol {
    pub fn as_str(&self) -> &'static str {
        match self {
            Protocol::Tcp => "TCP",
            Protocol::Udp => "UDP",
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum Family {
    #[serde(rename = "IPv4")]
    V4,
    #[serde(rename = "IPv6")]
    V6,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ConnState {
    Listen,
    Established,
    TimeWait,
    CloseWait,
    SynSent,
    SynRecv,
    FinWait1,
    FinWait2,
    Closing,
    LastAck,
    Closed,
    Unknown,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum RiskLevel {
    Safe,
    Warning,
    Danger,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RiskInfo {
    pub level: RiskLevel,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PortRow {
    pub id: String,
    pub port: u16,
    pub protocol: Protocol,
    pub family: Family,
    pub state: ConnState,
    pub pid: Option<u32>,
    pub process_name: Option<String>,
    pub process_path: Option<String>,
    pub process_cwd: Option<String>,
    pub remote_addr: Option<String>,
    pub requires_admin: bool,
    pub risk: RiskInfo,
    pub framework: Option<String>,
    pub opened_at: i64,
}
