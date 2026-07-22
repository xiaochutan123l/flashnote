use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::{
    domain::capture::{Capture, CaptureFilter, CaptureStatus},
    platform::{settings, windows},
    AppState,
};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CaptureChanged {
    id: String,
    operation: &'static str,
}

fn changed(app: &AppHandle, id: &str, operation: &'static str) {
    let _ = app.emit(
        "captures://changed",
        CaptureChanged {
            id: id.to_string(),
            operation,
        },
    );
}

#[tauri::command]
pub fn create_capture(
    app: AppHandle,
    state: State<'_, AppState>,
    content: String,
) -> Result<Capture, String> {
    let capture = state
        .captures
        .create(&content)
        .map_err(|error| error.to_string())?;
    changed(&app, &capture.id, "created");
    Ok(capture)
}

#[tauri::command]
pub fn list_captures(
    state: State<'_, AppState>,
    filter: CaptureFilter,
) -> Result<Vec<Capture>, String> {
    state
        .captures
        .list(filter)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn update_capture(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    content: String,
) -> Result<Capture, String> {
    let capture = state
        .captures
        .update(&id, &content)
        .map_err(|error| error.to_string())?;
    changed(&app, &id, "updated");
    Ok(capture)
}

#[tauri::command]
pub fn set_capture_status(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    status: CaptureStatus,
) -> Result<Capture, String> {
    let capture = state
        .captures
        .set_status(&id, status)
        .map_err(|error| error.to_string())?;
    changed(&app, &id, "status_changed");
    Ok(capture)
}

#[tauri::command]
pub fn delete_capture(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    state
        .captures
        .delete(&id)
        .map_err(|error| error.to_string())?;
    changed(&app, &id, "deleted");
    Ok(())
}

#[tauri::command]
pub fn restore_capture(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<Capture, String> {
    let capture = state
        .captures
        .restore(&id)
        .map_err(|error| error.to_string())?;
    changed(&app, &id, "restored");
    Ok(capture)
}

#[tauri::command]
pub fn show_capture_bar(app: AppHandle) -> Result<(), String> {
    windows::show_capture_bar(&app)
}

#[tauri::command]
pub fn hide_capture_bar(app: AppHandle) -> Result<(), String> {
    windows::hide_capture_bar(&app)
}

#[tauri::command]
pub fn set_capture_bar_mode(app: AppHandle, mode: windows::CaptureBarMode) -> Result<(), String> {
    windows::set_capture_bar_mode(&app, mode)
}

#[tauri::command]
pub fn start_capture_bar_drag(app: AppHandle) -> Result<(), String> {
    windows::start_capture_bar_drag(&app)
}

#[tauri::command]
pub fn open_inbox(app: AppHandle) -> Result<(), String> {
    windows::show_inbox(&app)
}

#[tauri::command]
pub fn get_settings(app: AppHandle) -> Result<settings::AppSettings, String> {
    settings::read(&app)
}

#[tauri::command]
pub fn set_launch_at_login(app: AppHandle, enabled: bool) -> Result<settings::AppSettings, String> {
    settings::set_launch_at_login(&app, enabled)
}

#[tauri::command]
pub fn set_keep_capture_bar_visible(
    app: AppHandle,
    enabled: bool,
) -> Result<settings::AppSettings, String> {
    let current = settings::set_keep_capture_bar_visible(&app, enabled)?;
    if enabled {
        windows::show_capture_bar(&app)?;
    } else {
        windows::hide_capture_bar(&app)?;
    }
    Ok(current)
}
