use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_autostart::ManagerExt;

use crate::SHORTCUT_LABEL;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub launch_at_login: bool,
    pub shortcut: &'static str,
}

pub fn read(app: &AppHandle) -> Result<AppSettings, String> {
    Ok(AppSettings {
        launch_at_login: app
            .autolaunch()
            .is_enabled()
            .map_err(|error| error.to_string())?,
        shortcut: SHORTCUT_LABEL,
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
