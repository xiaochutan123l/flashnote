use std::{fs, io::ErrorKind, path::PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tauri_plugin_autostart::ManagerExt;

use crate::SHORTCUT_LABEL;

const PREFERENCES_FILE_NAME: &str = "preferences.json";
const DEFAULT_COLLAPSE_DELAY_MS: u64 = 3_000;
const ALLOWED_COLLAPSE_DELAYS_MS: [u64; 4] = [1_000, 3_000, 5_000, 10_000];

#[derive(Clone, Copy, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureBarPosition {
    pub center_x: i32,
    pub center_y: i32,
}

/** App-owned preferences that are independent of OS-managed settings. */
#[derive(Debug, Deserialize, Serialize)]
#[serde(default, rename_all = "camelCase")]
struct Preferences {
    keep_capture_bar_visible: bool,
    auto_collapse_capture_bar: bool,
    capture_bar_collapse_delay_ms: u64,
    capture_bar_always_on_top: bool,
    remember_capture_bar_position: bool,
    capture_bar_position: Option<CaptureBarPosition>,
    keep_focus_window_visible: bool,
    auto_collapse_focus_window: bool,
    focus_window_position: Option<CaptureBarPosition>,
}

impl Default for Preferences {
    fn default() -> Self {
        Self {
            keep_capture_bar_visible: false,
            auto_collapse_capture_bar: true,
            capture_bar_collapse_delay_ms: DEFAULT_COLLAPSE_DELAY_MS,
            capture_bar_always_on_top: true,
            remember_capture_bar_position: true,
            capture_bar_position: None,
            keep_focus_window_visible: false,
            auto_collapse_focus_window: true,
            focus_window_position: None,
        }
    }
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub launch_at_login: bool,
    pub shortcut: &'static str,
    pub keep_capture_bar_visible: bool,
    pub auto_collapse_capture_bar: bool,
    pub capture_bar_collapse_delay_ms: u64,
    pub capture_bar_always_on_top: bool,
    pub remember_capture_bar_position: bool,
    pub keep_focus_window_visible: bool,
    pub auto_collapse_focus_window: bool,
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
        auto_collapse_capture_bar: preferences.auto_collapse_capture_bar,
        capture_bar_collapse_delay_ms: preferences.capture_bar_collapse_delay_ms,
        capture_bar_always_on_top: preferences.capture_bar_always_on_top,
        remember_capture_bar_position: preferences.remember_capture_bar_position,
        keep_focus_window_visible: preferences.keep_focus_window_visible,
        auto_collapse_focus_window: preferences.auto_collapse_focus_window,
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
    update_preferences(app, |preferences| {
        preferences.keep_capture_bar_visible = enabled;
        Ok(())
    })
}

pub fn set_auto_collapse_capture_bar(
    app: &AppHandle,
    enabled: bool,
) -> Result<AppSettings, String> {
    update_preferences(app, |preferences| {
        preferences.auto_collapse_capture_bar = enabled;
        Ok(())
    })
}

pub fn set_capture_bar_collapse_delay(
    app: &AppHandle,
    delay_ms: u64,
) -> Result<AppSettings, String> {
    update_preferences(app, |preferences| {
        if !ALLOWED_COLLAPSE_DELAYS_MS.contains(&delay_ms) {
            return Err("折叠等待时间无效".to_string());
        }
        preferences.capture_bar_collapse_delay_ms = delay_ms;
        Ok(())
    })
}

pub fn set_capture_bar_always_on_top(
    app: &AppHandle,
    enabled: bool,
) -> Result<AppSettings, String> {
    update_preferences(app, |preferences| {
        preferences.capture_bar_always_on_top = enabled;
        Ok(())
    })
}

pub fn set_remember_capture_bar_position(
    app: &AppHandle,
    enabled: bool,
) -> Result<AppSettings, String> {
    update_preferences(app, |preferences| {
        preferences.remember_capture_bar_position = enabled;
        Ok(())
    })
}

pub fn set_keep_focus_window_visible(
    app: &AppHandle,
    enabled: bool,
) -> Result<AppSettings, String> {
    update_preferences(app, |preferences| {
        preferences.keep_focus_window_visible = enabled;
        Ok(())
    })
}

pub fn set_auto_collapse_focus_window(
    app: &AppHandle,
    enabled: bool,
) -> Result<AppSettings, String> {
    update_preferences(app, |preferences| {
        preferences.auto_collapse_focus_window = enabled;
        Ok(())
    })
}

pub fn capture_bar_position(app: &AppHandle) -> Result<Option<CaptureBarPosition>, String> {
    let preferences = read_preferences(app)?;
    if preferences.remember_capture_bar_position {
        Ok(preferences.capture_bar_position)
    } else {
        Ok(None)
    }
}

pub fn remember_capture_bar_position(
    app: &AppHandle,
    position: CaptureBarPosition,
) -> Result<(), String> {
    let mut preferences = read_preferences(app)?;
    if !preferences.remember_capture_bar_position {
        return Ok(());
    }
    preferences.capture_bar_position = Some(position);
    write_preferences(app, &preferences)
}

pub fn focus_window_position(app: &AppHandle) -> Result<Option<CaptureBarPosition>, String> {
    let preferences = read_preferences(app)?;
    if preferences.remember_capture_bar_position {
        Ok(preferences.focus_window_position)
    } else {
        Ok(None)
    }
}

pub fn remember_focus_window_position(
    app: &AppHandle,
    position: CaptureBarPosition,
) -> Result<(), String> {
    let mut preferences = read_preferences(app)?;
    if !preferences.remember_capture_bar_position {
        return Ok(());
    }
    preferences.focus_window_position = Some(position);
    write_preferences(app, &preferences)
}

fn update_preferences(
    app: &AppHandle,
    update: impl FnOnce(&mut Preferences) -> Result<(), String>,
) -> Result<AppSettings, String> {
    let mut preferences = read_preferences(app)?;
    update(&mut preferences)?;
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
    use super::{Preferences, DEFAULT_COLLAPSE_DELAY_MS};

    #[test]
    fn old_preferences_without_new_fields_use_milestone_defaults() {
        let preferences: Preferences =
            serde_json::from_str(r#"{"keepCaptureBarVisible":true}"#).expect("valid preferences");

        assert!(preferences.keep_capture_bar_visible);
        assert!(preferences.auto_collapse_capture_bar);
        assert_eq!(
            preferences.capture_bar_collapse_delay_ms,
            DEFAULT_COLLAPSE_DELAY_MS
        );
        assert!(preferences.capture_bar_always_on_top);
        assert!(preferences.remember_capture_bar_position);
        assert!(preferences.capture_bar_position.is_none());
        assert!(!preferences.keep_focus_window_visible);
        assert!(preferences.auto_collapse_focus_window);
        assert!(preferences.focus_window_position.is_none());
    }
}
