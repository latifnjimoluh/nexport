use crate::db::{self, Db};
use crate::models::Protocol;
use crate::{ports, PortTimestamps};
use crate::settings::SettingsState;
use serde::Serialize;
use std::collections::HashMap;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, Emitter};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PortEvent {
    pub kind: &'static str, // "opened" | "closed" | "killed"
    pub port: u16,
    pub protocol: Protocol,
    pub pid: Option<u32>,
    pub process_name: Option<String>,
    pub ts: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AutoKillError {
    pub port: u16,
    pub protocol: Protocol,
    pub pid: u32,
    pub reason: String,
}

type Key = (Protocol, u16);

#[derive(Debug, Clone, Default)]
struct Snapshot {
    pid: Option<u32>,
    process_name: Option<String>,
    first_seen: i64,
}

pub fn start(app: AppHandle, interval: Duration) {
    // Scan initial *synchrone* : populate PortTimestamps avant que l'UI invoque
    // list_ports (sinon les premiers `openedAt` valent 0 jusqu'au 1er tick).
    let ts_init = unix_now();
    let initial: HashMap<Key, Snapshot> = scan_snapshot(ts_init);
    if let Some(st) = app.try_state::<PortTimestamps>() {
        if let Ok(mut map) = st.0.lock() {
            for (key, snap) in &initial {
                map.insert(*key, snap.first_seen);
            }
        }
    }

    tauri::async_runtime::spawn(async move {
        let mut previous: HashMap<Key, Snapshot> = initial;
        let mut failed_auto_kills: std::collections::HashSet<u16> =
            std::collections::HashSet::new();
        let mut ticker = tokio::time::interval(interval);
        ticker.tick().await;
        loop {
            ticker.tick().await;
            
            // Récupérer les réglages Auto-Kill
            let (auto_kill_enabled, auto_kill_list) = app.try_state::<SettingsState>()
                .map(|s| {
                    if let Ok(settings) = s.current.lock() {
                        (settings.auto_kill_enabled, settings.auto_kill_ports.clone())
                    } else {
                        (false, Vec::new())
                    }
                })
                .unwrap_or((false, Vec::new()));

            let rows = ports::list_ports();
            let mut current: HashMap<Key, Snapshot> = HashMap::with_capacity(rows.len());
            let ts = unix_now();
            
            for r in &rows {
                let key = (r.protocol, r.port);
                
                // Logique Auto-Kill
                if auto_kill_enabled && auto_kill_list.contains(&r.port) {
                    if let Some(pid) = r.pid {
                        match ports::kill(pid) {
                            Ok(()) => {
                                failed_auto_kills.remove(&r.port);
                                publish(&app, "killed", key, &Snapshot {
                                    pid: Some(pid),
                                    process_name: r.process_name.clone(),
                                    first_seen: ts,
                                }, ts);
                                continue;
                            }
                            Err(reason) => {
                                // Une seule alerte par port tant qu'il reste ouvert :
                                // sinon le watcher (tick 2s) inonde l'UI.
                                if failed_auto_kills.insert(r.port) {
                                    let _ = app.emit(
                                        "auto-kill-failed",
                                        AutoKillError {
                                            port: r.port,
                                            protocol: r.protocol,
                                            pid,
                                            reason,
                                        },
                                    );
                                }
                            }
                        }
                    }
                }

                let first_seen = previous.get(&key).map(|s| s.first_seen).unwrap_or(ts);

                current
                    .entry(key)
                    .or_insert_with(|| Snapshot {
                        pid: r.pid,
                        process_name: r.process_name.clone(),
                        first_seen,
                    });
            }

            // Mise à jour du cache global pour les commandes de listage
            if let Some(st) = app.try_state::<PortTimestamps>() {
                if let Ok(mut map) = st.0.lock() {
                    for (key, snap) in &current {
                        map.insert(*key, snap.first_seen);
                    }
                    map.retain(|key, _| current.contains_key(key));
                }
            }

            for (key, snap) in &current {
                if !previous.contains_key(key) {
                    publish(&app, "opened", *key, snap, ts);
                }
            }
            for (key, snap) in &previous {
                if !current.contains_key(key) {
                    publish(&app, "closed", *key, snap, ts);
                }
            }

            // Oublie les ports « déjà prévenus » qui ne sont plus là :
            // s'ils reviennent et échouent à nouveau, on ré-alertera.
            failed_auto_kills.retain(|p| current.keys().any(|k| k.1 == *p));

            previous = current;
        }
    });
}

fn publish(app: &AppHandle, kind: &'static str, key: Key, snap: &Snapshot, ts: i64) {
    let (protocol, port) = key;
    let _ = app.emit(
        "port-event",
        PortEvent {
            kind,
            port,
            protocol,
            pid: snap.pid,
            process_name: snap.process_name.clone(),
            ts,
        },
    );

    if let Some(db) = app.try_state::<Db>() {
        if let Ok(conn) = db.0.lock() {
            let _ = db::insert_event(
                &conn,
                ts,
                kind,
                port,
                protocol.as_str(),
                snap.pid,
                snap.process_name.as_deref(),
            );
        }
    }
}

fn scan_snapshot(ts: i64) -> HashMap<Key, Snapshot> {
    let mut map = HashMap::new();
    for r in ports::list_ports() {
        map.entry((r.protocol, r.port))
            .or_insert_with(|| Snapshot {
                pid: r.pid,
                process_name: r.process_name.clone(),
                first_seen: ts,
            });
    }
    map
}

fn unix_now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}
