// Gestion du pare-feu : ajoute / supprime des regles bloquantes.
//
// Windows : shell out vers `netsh advfirewall firewall ...`. Necessite des
// droits administrateur sinon l'appel echoue (signal a l'UI via Err).
// Autres plateformes : non supporte pour le moment.

use std::process::Command;
#[cfg(windows)]
use std::os::windows::process::CommandExt;

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

#[cfg(windows)]
fn rule_name(port: u16, proto: &str) -> String {
    format!("NexPort_block_{}_{}", proto.to_uppercase(), port)
}

pub fn block(port: u16, proto: &str) -> Result<(), String> {
    #[cfg(windows)]
    {
        let name = rule_name(port, proto);
        let mut cmd = Command::new("netsh");
        cmd.creation_flags(CREATE_NO_WINDOW).args([
            "advfirewall",
            "firewall",
            "add",
            "rule",
            &format!("name={}", name),
            "dir=in",
            "action=block",
            &format!("protocol={}", proto.to_uppercase()),
            &format!("localport={}", port),
        ]);
        let out = cmd.output().map_err(|e| format!("netsh : {e}"))?;
        if !out.status.success() {
            let stderr = String::from_utf8_lossy(&out.stderr);
            let stdout = String::from_utf8_lossy(&out.stdout);
            return Err(format!(
                "netsh a refuse (admin requis ?) : {}{}",
                stdout.trim(),
                stderr.trim()
            ));
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = (port, proto);
        Err("Bloquage pare-feu : Windows uniquement pour le moment.".into())
    }
}

pub fn unblock(port: u16, proto: &str) -> Result<(), String> {
    #[cfg(windows)]
    {
        let name = rule_name(port, proto);
        let mut cmd = Command::new("netsh");
        cmd.creation_flags(CREATE_NO_WINDOW).args([
            "advfirewall",
            "firewall",
            "delete",
            "rule",
            &format!("name={}", name),
        ]);
        let out = cmd.output().map_err(|e| format!("netsh : {e}"))?;
        if !out.status.success() {
            let stderr = String::from_utf8_lossy(&out.stderr);
            return Err(format!("netsh : {}", stderr.trim()));
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = (port, proto);
        Err("Pare-feu : Windows uniquement.".into())
    }
}
