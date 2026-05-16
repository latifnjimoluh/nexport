use crate::db::{Db, EventFilter, EventRow};
use crate::elevation;
use crate::models::PortRow;
use crate::settings::{self, Settings, SettingsState};
use crate::{db, ports, PortTimestamps};
use std::fs::File;
use std::io::{BufWriter, Write};
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

#[tauri::command]
pub fn list_ports(ts_state: State<'_, PortTimestamps>) -> Vec<PortRow> {
    let mut rows = ports::list_ports();
    
    if let Ok(ts_map) = ts_state.0.lock() {
        for row in &mut rows {
            if let Some(&ts) = ts_map.get(&(row.protocol, row.port)) {
                row.opened_at = ts;
            }
        }
    }
    
    rows
}

#[tauri::command]
pub fn kill_process(state: State<'_, Db>, pid: u32) -> Result<(), String> {
    // Snapshot AVANT le kill pour conserver le contexte (port, process) dans l'historique.
    let snapshot = ports::list_ports()
        .into_iter()
        .find(|r| r.pid == Some(pid));

    ports::kill(pid)?;

    if let Some(r) = snapshot {
        if let Ok(conn) = state.0.lock() {
            let _ = db::insert_event(
                &conn,
                unix_now(),
                "killed",
                r.port,
                r.protocol.as_str(),
                Some(pid),
                r.process_name.as_deref(),
            );
        }
    }
    Ok(())
}

fn unix_now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

#[tauri::command]
pub fn is_elevated() -> bool {
    elevation::is_elevated()
}

#[tauri::command]
pub fn relaunch_as_admin(app: tauri::AppHandle) -> Result<(), String> {
    elevation::relaunch_as_admin()?;
    // Laisse le temps à l'instance élevée de démarrer avant de fermer la nôtre.
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(400));
        app.exit(0);
    });
    Ok(())
}

#[tauri::command]
pub fn list_favorites(state: State<'_, Db>) -> Result<Vec<u16>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::list_favorites(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_favorite(
    state: State<'_, Db>,
    port: u16,
    label: Option<String>,
) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::add_favorite(&conn, port, label.as_deref()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn remove_favorite(state: State<'_, Db>, port: u16) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::remove_favorite(&conn, port).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_events(
    state: State<'_, Db>,
    filter: Option<EventFilter>,
) -> Result<Vec<EventRow>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::list_events(&conn, &filter.unwrap_or_default()).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn count_events(state: State<'_, Db>) -> Result<i64, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::count_events(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_events(state: State<'_, Db>) -> Result<usize, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    db::clear_events(&conn).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn export_events(
    state: State<'_, Db>,
    path: String,
    format: String,
    filter: Option<EventFilter>,
) -> Result<usize, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let rows = db::list_events(&conn, &filter.unwrap_or_default())
        .map_err(|e| e.to_string())?;
    drop(conn);

    let path = PathBuf::from(path);
    let file = File::create(&path).map_err(|e| format!("création fichier: {e}"))?;
    let mut w = BufWriter::new(file);

    match format.as_str() {
        "csv" => write_csv(&mut w, &rows).map_err(|e| e.to_string())?,
        "json" => serde_json::to_writer_pretty(&mut w, &rows)
            .map_err(|e| format!("json: {e}"))?,
        other => return Err(format!("format inconnu: {other}")),
    }
    w.flush().map_err(|e| e.to_string())?;
    Ok(rows.len())
}

fn write_csv<W: Write>(w: &mut W, rows: &[EventRow]) -> std::io::Result<()> {
    writeln!(w, "id,ts,kind,port,protocol,pid,process")?;
    for r in rows {
        writeln!(
            w,
            "{},{},{},{},{},{},{}",
            r.id,
            r.ts,
            csv_field(&r.kind),
            r.port,
            csv_field(&r.protocol),
            r.pid.map(|p| p.to_string()).unwrap_or_default(),
            csv_field(r.process.as_deref().unwrap_or("")),
        )?;
    }
    Ok(())
}

fn csv_field(s: &str) -> String {
    if s.contains([',', '"', '\n', '\r']) {
        format!("\"{}\"", s.replace('"', "\"\""))
    } else {
        s.to_string()
    }
}

#[tauri::command]
pub fn get_settings(state: State<'_, SettingsState>) -> Result<Settings, String> {
    let current = state.current.lock().map_err(|e| e.to_string())?;
    Ok(current.clone())
}

#[tauri::command]
pub fn set_settings(
    state: State<'_, SettingsState>,
    settings: Settings,
) -> Result<Settings, String> {
    let mut current = state.current.lock().map_err(|e| e.to_string())?;
    *current = settings;
    settings::save(&state.path, &current).map_err(|e| format!("save settings: {e}"))?;
    Ok(current.clone())
}
