use std::{fs, io::ErrorKind, path::PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tauri_plugin_autostart::ManagerExt;

use crate::SHORTCUT_LABEL;

const PREFERENCES_FILE_NAME: &str = "preferences.json";

/** App-owned preferences that are independent of OS-managed settings. */
#[derive(Debug, Default, Deserialize, Serialize)]
#[serde(default, rename_all = "camelCase")]
struct Preferences {
    keep_capture_bar_visible: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub launch_at_login: bool,
    pub shortcut: &'static str,
    pub keep_capture_bar_visible: bool,
}

pub fn read(app: &AppHandle) -> Result<AppSettings, String> {
    let preferences = read_preferences(app)?;
    Ok(AppSettings {
        launch_at_login: app
            .autolaunch()
            .is_enabled()
            .map_err(|error| error.to_string())?,
        shortcut: SHORTCUT_LABEL,
        keep_capture_bar_visible: preferences.keep_capture_bar_visible,
    })
}

pub fn set_launch_at_login(app: &AppHandle, enabled: bool) -> Result<AppSettings, String> {
    if enabled {
        app.autolaunch()
            .enable()
            .map_err(|error| error.to_string())?;
    } else {
        app.autolaunch()
            .disable()
            .map_err(|error| error.to_string())?;
    }
    read(app)
}

pub fn set_keep_capture_bar_visible(app: &AppHandle, enabled: bool) -> Result<AppSettings, String> {
    let mut preferences = read_preferences(app)?;
    preferences.keep_capture_bar_visible = enabled;
    write_preferences(app, &preferences)?;
    read(app)
}

fn preferences_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|directory| directory.join(PREFERENCES_FILE_NAME))
        .map_err(|error| error.to_string())
}

fn read_preferences(app: &AppHandle) -> Result<Preferences, String> {
    match fs::read(preferences_path(app)?) {
        Ok(content) => serde_json::from_slice(&content)
            .map_err(|error| format!("偏好设置文件格式无效：{error}")),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(Preferences::default()),
        Err(error) => Err(format!("无法读取偏好设置：{error}")),
    }
}

fn write_preferences(app: &AppHandle, preferences: &Preferences) -> Result<(), String> {
    let path = preferences_path(app)?;
    if let Some(directory) = path.parent() {
        fs::create_dir_all(directory).map_err(|error| format!("无法创建设置目录：{error}"))?;
    }
    let content = serde_json::to_vec_pretty(preferences)
        .map_err(|error| format!("无法序列化偏好设置：{error}"))?;
    fs::write(path, content).map_err(|error| format!("无法保存偏好设置：{error}"))
}

#[cfg(test)]
mod tests {
    use super::Preferences;

    #[test]
    fn old_preferences_without_new_fields_use_defaults() {
        let preferences: Preferences = serde_json::from_str("{}").expect("valid preferences");
        assert!(!preferences.keep_capture_bar_visible);
    }
}
