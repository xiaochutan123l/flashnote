use tauri::{App, AppHandle, Manager, WebviewWindowBuilder};

/**
 * Creates configured windows only after application state is managed.
 *
 * Tauri normally creates config-declared windows before the setup hook. Fast
 * Windows machines can then invoke commands before `AppState` exists. The
 * config marks both windows with `create: false`, and this function restores
 * them after setup has registered every command dependency.
 */
pub fn create_configured_windows(app: &mut App) -> tauri::Result<()> {
    let window_configs = app.config().app.windows.clone();
    for config in window_configs {
        WebviewWindowBuilder::from_config(app.handle(), &config)?.build()?;
    }
    Ok(())
}

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
