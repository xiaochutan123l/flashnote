use tauri::{AppHandle, Manager};

/** Centralizes window behavior so OS-specific refinements have one extension point. */
pub fn show_capture_bar(app: &AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("capture")
        .ok_or_else(|| "找不到悬浮记录窗口".to_string())?;
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())?;
    Ok(())
}

pub fn hide_capture_bar(app: &AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("capture")
        .ok_or_else(|| "找不到悬浮记录窗口".to_string())?;
    window.hide().map_err(|error| error.to_string())
}

pub fn show_inbox(app: &AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("inbox")
        .ok_or_else(|| "找不到稍后看窗口".to_string())?;
    window.unminimize().map_err(|error| error.to_string())?;
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())?;
    Ok(())
}
