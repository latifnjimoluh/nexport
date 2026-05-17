mod commands;
mod db;
mod elevation;
mod firewall;
pub mod models;
pub mod ports;
mod settings;
mod watcher;

use std::sync::Mutex;
use std::time::Duration;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{TrayIconBuilder, TrayIconEvent, MouseButton};
use tauri::Manager;

pub struct PortTimestamps(pub Mutex<std::collections::HashMap<(models::Protocol, u16), i64>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec!["--silent"])))
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            app.manage(PortTimestamps(Mutex::new(std::collections::HashMap::new())));
            
            // 1. SQLite (favoris + historique)
            let data_dir = app
                .path()
                .app_data_dir()
                .map_err(|e| format!("app_data_dir: {e}"))?;
            let conn = db::open(&data_dir).map_err(|e| format!("db open: {e}"))?;
            app.manage(db::Db(Mutex::new(conn)));

            // 2. Settings persistés
            let (loaded, path) = settings::load_or_default(&data_dir);
            app.manage(settings::SettingsState {
                current: Mutex::new(loaded),
                path,
            });

            // 3. Menu contextuel du Tray
            let show_i = MenuItem::with_id(app, "show", "Afficher NexPort", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quitter", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            // 4. Configuration du Tray Icon
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            // 5. Watcher périodique
            watcher::start(app.handle().clone(), Duration::from_secs(2));
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Au lieu de fermer, on cache la fenêtre
                window.hide().unwrap();
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_ports,
            commands::kill_process,
            commands::get_process_details,
            commands::is_elevated,
            commands::relaunch_as_admin,
            commands::list_favorites,
            commands::add_favorite,
            commands::remove_favorite,
            commands::list_events,
            commands::count_events,
            commands::clear_events,
            commands::export_events,
            commands::get_settings,
            commands::set_settings,
            commands::firewall_block_port,
            commands::firewall_unblock_port,
            commands::firewall_list_blocks,
        ])
        .run(tauri::generate_context!())
        .expect("erreur au lancement de l'application Tauri");
}
