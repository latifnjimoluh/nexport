use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub refresh_ms: u32,
    pub notifications_enabled: bool,
    #[serde(default = "default_true")]
    pub sound_enabled: bool,
    pub theme: Theme,
    #[serde(default = "default_fr")]
    pub language: String,
    #[serde(default)]
    pub auto_kill_ports: Vec<u16>,
    #[serde(default = "default_true")]
    pub auto_kill_enabled: bool,
    #[serde(default)]
    pub read_only: bool,
    #[serde(default)]
    pub pin_hash: Option<String>,
}

fn default_true() -> bool { true }
fn default_fr() -> String { "fr".to_string() }

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    Dark,
    Light,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            refresh_ms: 2000,
            notifications_enabled: true,
            sound_enabled: true,
            theme: Theme::Dark,
            language: "fr".to_string(),
            auto_kill_ports: Vec::new(),
            auto_kill_enabled: true,
            read_only: false,
            pin_hash: None,
        }
    }
}

pub struct SettingsState {
    pub current: Mutex<Settings>,
    pub path: PathBuf,
}

pub fn load_or_default(app_data_dir: &Path) -> (Settings, PathBuf) {
    fs::create_dir_all(app_data_dir).ok();
    let path = app_data_dir.join("settings.json");
    let settings = match fs::read_to_string(&path) {
        Ok(s) => serde_json::from_str(&s).unwrap_or_default(),
        Err(_) => Settings::default(),
    };
    (settings, path)
}

pub fn save(path: &Path, settings: &Settings) -> std::io::Result<()> {
    // Écriture atomique : tmp + rename.
    let tmp = path.with_extension("json.tmp");
    let serialized = serde_json::to_string_pretty(settings).map_err(|e| {
        std::io::Error::new(std::io::ErrorKind::InvalidData, e.to_string())
    })?;
    {
        let mut f = fs::File::create(&tmp)?;
        f.write_all(serialized.as_bytes())?;
        f.sync_all()?;
    }
    fs::rename(&tmp, path)
}
