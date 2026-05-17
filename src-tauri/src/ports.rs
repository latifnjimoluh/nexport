use crate::models::{ConnState, Family, PortRow, Protocol, RiskInfo, RiskLevel};
use netstat2::{
    get_sockets_info, AddressFamilyFlags, ProtocolFlags, ProtocolSocketInfo, TcpState,
};
use std::collections::HashSet;
use sysinfo::{Pid, System};

pub fn list_ports() -> Vec<PortRow> {
    let af = AddressFamilyFlags::IPV4 | AddressFamilyFlags::IPV6;
    let proto = ProtocolFlags::TCP | ProtocolFlags::UDP;

    let sockets = match get_sockets_info(af, proto) {
        Ok(s) => s,
        Err(_) => return Vec::new(),
    };

    let sys = System::new_all();

    let mut rows: Vec<PortRow> = Vec::with_capacity(sockets.len());
    let mut seen: HashSet<(Protocol, u16, u32)> = HashSet::new();

    for socket in sockets {
        let pid = socket.associated_pids.first().copied();
        let pid_key = pid.unwrap_or(0);

        match socket.protocol_socket_info {
            ProtocolSocketInfo::Tcp(info) => {
                if !seen.insert((Protocol::Tcp, info.local_port, pid_key)) {
                    continue;
                }
                let (name, path, cwd) = resolve_process(&sys, pid);
                let remote_addr = if info.state == TcpState::Established {
                    Some(format!("{}:{}", info.remote_addr, info.remote_port))
                } else {
                    None
                };
                let risk = analyze_risk(info.local_port, name.as_deref());
                let framework = detect_framework(info.local_port, name.as_deref(), path.as_deref())
                    .map(|s| s.to_string());

                rows.push(PortRow {
                    id: format!("tcp-{}-{}", info.local_port, pid_key),
                    port: info.local_port,
                    protocol: Protocol::Tcp,
                    family: if info.local_addr.is_ipv4() {
                        Family::V4
                    } else {
                        Family::V6
                    },
                    state: map_tcp_state(&info.state),
                    requires_admin: needs_admin(pid, name.as_deref(), path.as_deref()),
                    pid,
                    process_name: name,
                    process_path: path,
                    process_cwd: cwd,
                    remote_addr,
                    risk,
                    framework,
                    opened_at: 0,
                });
            }
            ProtocolSocketInfo::Udp(info) => {
                if !seen.insert((Protocol::Udp, info.local_port, pid_key)) {
                    continue;
                }
                let (name, path, cwd) = resolve_process(&sys, pid);
                let risk = analyze_risk(info.local_port, name.as_deref());
                let framework = detect_framework(info.local_port, name.as_deref(), path.as_deref())
                    .map(|s| s.to_string());

                rows.push(PortRow {
                    id: format!("udp-{}-{}", info.local_port, pid_key),
                    port: info.local_port,
                    protocol: Protocol::Udp,
                    family: if info.local_addr.is_ipv4() {
                        Family::V4
                    } else {
                        Family::V6
                    },
                    state: ConnState::Unknown,
                    requires_admin: needs_admin(pid, name.as_deref(), path.as_deref()),
                    pid,
                    process_name: name,
                    process_path: path,
                    process_cwd: cwd,
                    remote_addr: None,
                    risk,
                    framework,
                    opened_at: 0,
                });
            }
        }
    }

    rows.sort_by_key(|r| (r.port, !matches!(r.protocol, Protocol::Tcp)));
    rows
}

/// Devine le framework/service qui ecoute sur ce port, par mapping
/// (chemin exe + nom de process + port). Heuristique, jamais 100% fiable.
fn detect_framework(port: u16, name: Option<&str>, path: Option<&str>) -> Option<&'static str> {
    let n = name.map(|s| s.to_lowercase()).unwrap_or_default();
    let p = path.map(|s| s.to_lowercase()).unwrap_or_default();

    // Detection par sous-chaine du chemin (le plus precis)
    if p.contains("\\vite\\") || p.contains("/vite/") {
        return Some("Vite");
    }
    if p.contains("\\next\\") || p.contains("/next/") {
        return Some("Next.js");
    }
    if p.contains("docker") {
        return Some("Docker");
    }

    // Combos port + runtime
    let is_node = n.contains("node");
    let is_python = n.contains("python") || n == "py.exe";
    let is_java = n.contains("java");
    let is_dotnet = n == "dotnet.exe" || n.contains("iis");

    if is_node {
        return Some(match port {
            3000 => "Node (Express/Next)",
            3001 => "Node (dev)",
            4200 => "Angular",
            5173 | 5174 => "Vite",
            8080 => "Node",
            8888 => "Node",
            9229 => "Node debugger",
            _ => "Node",
        });
    }
    if is_python {
        return Some(match port {
            5000 => "Flask",
            8000 => "Django/FastAPI",
            8888 => "Jupyter",
            _ => "Python",
        });
    }
    if is_java {
        return Some(match port {
            8080 | 8443 => "Java/Tomcat",
            _ => "Java",
        });
    }
    if is_dotnet {
        return Some(".NET / IIS");
    }

    // Services nommes
    match n.as_str() {
        "postgres.exe" | "postgresql.exe" => Some("PostgreSQL"),
        "mysqld.exe" | "mysql.exe" => Some("MySQL"),
        "mariadbd.exe" => Some("MariaDB"),
        "redis-server.exe" => Some("Redis"),
        "mongod.exe" => Some("MongoDB"),
        "nginx.exe" => Some("Nginx"),
        "httpd.exe" => Some("Apache"),
        "sshd.exe" | "openssh-sshd.exe" => Some("SSH"),
        "code.exe" => Some("VS Code"),
        "discord.exe" => Some("Discord"),
        "spotify.exe" => Some("Spotify"),
        "chrome.exe" => Some("Chrome"),
        "firefox.exe" => Some("Firefox"),
        "msedge.exe" => Some("Edge"),
        "wsl.exe" | "wslservice.exe" => Some("WSL"),
        "ollama.exe" => Some("Ollama"),
        _ => None,
    }
}

fn analyze_risk(port: u16, process_name: Option<&str>) -> RiskInfo {
    // Ports souvent utilisés par des malwares ou outils de piratage
    let dangerous_ports = [
        (4444, "Metasploit / Malware"),
        (1337, "Trojan / Backdoor"),
        (666, "Malware"),
        (31337, "Back Orifice"),
    ];

    for (p, reason) in dangerous_ports {
        if port == p {
            return RiskInfo {
                level: RiskLevel::Danger,
                reason: Some(reason.to_string()),
            };
        }
    }

    // Services sensibles souvent cibles d'attaques s'ils sont exposés
    let warning_ports = [
        (21, "FTP (Non sécurisé)"),
        (23, "Telnet (Non sécurisé)"),
        (3389, "RDP (Exposition potentielle)"),
        (445, "SMB (Vulnérabilité potentielle)"),
    ];

    for (p, reason) in warning_ports {
        if port == p {
            return RiskInfo {
                level: RiskLevel::Warning,
                reason: Some(reason.to_string()),
            };
        }
    }

    // Analyse par nom de processus suspect (exemple simplifié)
    if let Some(name) = process_name {
        let name_lc = name.to_lowercase();
        if name_lc.contains("nc.exe") || name_lc.contains("netcat") {
            return RiskInfo {
                level: RiskLevel::Warning,
                reason: Some("Outil de réseau suspect (Netcat)".to_string()),
            };
        }
    }

    RiskInfo {
        level: RiskLevel::Safe,
        reason: None,
    }
}

pub fn kill(pid: u32) -> Result<(), String> {
    let sys = System::new_all();
    let process = sys
        .process(Pid::from_u32(pid))
        .ok_or_else(|| format!("process {pid} introuvable"))?;

    if process.kill() {
        Ok(())
    } else {
        Err("kill refusé par l'OS (droits administrateur requis ?)".to_string())
    }
}

fn map_tcp_state(s: &TcpState) -> ConnState {
    match s {
        TcpState::Listen => ConnState::Listen,
        TcpState::Established => ConnState::Established,
        TcpState::TimeWait => ConnState::TimeWait,
        TcpState::CloseWait => ConnState::CloseWait,
        TcpState::SynSent => ConnState::SynSent,
        TcpState::SynReceived => ConnState::SynRecv,
        TcpState::FinWait1 => ConnState::FinWait1,
        TcpState::FinWait2 => ConnState::FinWait2,
        TcpState::Closing => ConnState::Closing,
        TcpState::LastAck => ConnState::LastAck,
        TcpState::Closed => ConnState::Closed,
        _ => ConnState::Unknown,
    }
}

fn resolve_process(
    sys: &System,
    pid: Option<u32>,
) -> (Option<String>, Option<String>, Option<String>) {
    let Some(pid) = pid else { return (None, None, None) };
    let Some(proc) = sys.process(Pid::from_u32(pid)) else {
        return (None, None, None);
    };
    let name = Some(proc.name().to_string_lossy().into_owned());
    let path = proc.exe().map(|p| p.to_string_lossy().into_owned());
    let cwd = proc.cwd().map(|p| p.to_string_lossy().into_owned());
    (name, path, cwd)
}

fn needs_admin(pid: Option<u32>, name: Option<&str>, path: Option<&str>) -> bool {
    match pid {
        Some(0) | Some(4) | None => return true,
        _ => {}
    }
    if path.is_none() {
        return true;
    }
    matches!(
        name.map(|n| n.to_ascii_lowercase()),
        Some(n) if n == "system" || n == "svchost.exe" || n == "lsass.exe" || n == "services.exe"
    )
}
