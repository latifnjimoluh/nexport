use rusqlite::types::Value;
use rusqlite::{params, params_from_iter, Connection};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::Mutex;

pub struct Db(pub Mutex<Connection>);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EventRow {
    pub id: i64,
    pub ts: i64,
    pub kind: String,
    pub port: u16,
    pub protocol: String,
    pub pid: Option<u32>,
    pub process: Option<String>,
}

#[derive(Debug, Default, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EventFilter {
    pub kind: Option<String>,
    pub port: Option<u16>,
    pub since_ts: Option<i64>,
    pub until_ts: Option<i64>,
    pub limit: Option<u32>,
}

pub fn open(app_data_dir: &Path) -> rusqlite::Result<Connection> {
    std::fs::create_dir_all(app_data_dir).ok();
    let path = app_data_dir.join("nexport.sqlite");
    let conn = Connection::open(path)?;
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA foreign_keys = ON;
         CREATE TABLE IF NOT EXISTS favorites (
             port  INTEGER PRIMARY KEY,
             label TEXT,
             added_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
         );
         CREATE TABLE IF NOT EXISTS events (
             id        INTEGER PRIMARY KEY AUTOINCREMENT,
             ts        INTEGER NOT NULL,
             kind      TEXT    NOT NULL,
             port      INTEGER NOT NULL,
             protocol  TEXT    NOT NULL,
             pid       INTEGER,
             process   TEXT
         );
         CREATE INDEX IF NOT EXISTS events_ts ON events (ts);
         CREATE INDEX IF NOT EXISTS events_port ON events (port);
         CREATE TABLE IF NOT EXISTS firewall_blocks (
             port      INTEGER NOT NULL,
             protocol  TEXT    NOT NULL,
             blocked_at INTEGER NOT NULL,
             PRIMARY KEY (port, protocol)
         );",
    )?;
    Ok(conn)
}

pub fn list_favorites(conn: &Connection) -> rusqlite::Result<Vec<u16>> {
    let mut stmt = conn.prepare("SELECT port FROM favorites ORDER BY port")?;
    let rows = stmt
        .query_map([], |r| r.get::<_, i64>(0).map(|v| v as u16))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(rows)
}

pub fn add_favorite(
    conn: &Connection,
    port: u16,
    label: Option<&str>,
) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO favorites (port, label) VALUES (?1, ?2)",
        params![port as i64, label],
    )?;
    Ok(())
}

pub fn remove_favorite(conn: &Connection, port: u16) -> rusqlite::Result<()> {
    conn.execute(
        "DELETE FROM favorites WHERE port = ?1",
        params![port as i64],
    )?;
    Ok(())
}

pub fn insert_event(
    conn: &Connection,
    ts: i64,
    kind: &str,
    port: u16,
    protocol: &str,
    pid: Option<u32>,
    process: Option<&str>,
) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO events (ts, kind, port, protocol, pid, process)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            ts,
            kind,
            port as i64,
            protocol,
            pid.map(|p| p as i64),
            process,
        ],
    )?;
    Ok(())
}

pub fn list_events(
    conn: &Connection,
    filter: &EventFilter,
) -> rusqlite::Result<Vec<EventRow>> {
    let mut sql = String::from(
        "SELECT id, ts, kind, port, protocol, pid, process FROM events WHERE 1=1",
    );
    let mut args: Vec<Value> = Vec::new();

    if let Some(k) = &filter.kind {
        sql.push_str(" AND kind = ?");
        args.push(Value::Text(k.clone()));
    }
    if let Some(p) = filter.port {
        sql.push_str(" AND port = ?");
        args.push(Value::Integer(p as i64));
    }
    if let Some(ts) = filter.since_ts {
        sql.push_str(" AND ts >= ?");
        args.push(Value::Integer(ts));
    }
    if let Some(ts) = filter.until_ts {
        sql.push_str(" AND ts <= ?");
        args.push(Value::Integer(ts));
    }

    sql.push_str(" ORDER BY ts DESC, id DESC");
    let limit = filter.limit.unwrap_or(500).min(10_000);
    sql.push_str(&format!(" LIMIT {limit}"));

    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt
        .query_map(params_from_iter(args.iter()), |r| {
            Ok(EventRow {
                id: r.get(0)?,
                ts: r.get(1)?,
                kind: r.get(2)?,
                port: r.get::<_, i64>(3)? as u16,
                protocol: r.get(4)?,
                pid: r.get::<_, Option<i64>>(5)?.map(|p| p as u32),
                process: r.get(6)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(rows)
}

pub fn count_events(conn: &Connection) -> rusqlite::Result<i64> {
    conn.query_row("SELECT COUNT(*) FROM events", [], |r| r.get::<_, i64>(0))
}

pub fn clear_events(conn: &Connection) -> rusqlite::Result<usize> {
    conn.execute("DELETE FROM events", [])
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FirewallBlock {
    pub port: u16,
    pub protocol: String,
    pub blocked_at: i64,
}

pub fn list_firewall_blocks(conn: &Connection) -> rusqlite::Result<Vec<FirewallBlock>> {
    let mut stmt =
        conn.prepare("SELECT port, protocol, blocked_at FROM firewall_blocks ORDER BY port")?;
    let rows = stmt
        .query_map([], |r| {
            Ok(FirewallBlock {
                port: r.get::<_, i64>(0)? as u16,
                protocol: r.get(1)?,
                blocked_at: r.get(2)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(rows)
}

pub fn add_firewall_block(
    conn: &Connection,
    port: u16,
    protocol: &str,
) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT OR REPLACE INTO firewall_blocks (port, protocol, blocked_at)
         VALUES (?1, ?2, strftime('%s','now'))",
        params![port as i64, protocol],
    )?;
    Ok(())
}

pub fn remove_firewall_block(
    conn: &Connection,
    port: u16,
    protocol: &str,
) -> rusqlite::Result<()> {
    conn.execute(
        "DELETE FROM firewall_blocks WHERE port = ?1 AND protocol = ?2",
        params![port as i64, protocol],
    )?;
    Ok(())
}
