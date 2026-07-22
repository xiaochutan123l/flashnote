use serde::Deserialize;
use tauri::{
    App, AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, WebviewWindow,
    WebviewWindowBuilder,
};

const CAPTURE_WINDOW_LABEL: &str = "capture";
const CAPTURE_EXPANDED_WIDTH: f64 = 432.0;
const CAPTURE_EXPANDED_HEIGHT: f64 = 64.0;
const CAPTURE_COLLAPSED_SIZE: f64 = 52.0;

#[derive(Clone, Copy, Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CaptureBarMode {
    Expanded,
    Collapsed,
}

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
    let window = capture_window(app)?;
    resize_capture_bar(&window, CaptureBarMode::Expanded)?;
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())?;
    app.emit_to(CAPTURE_WINDOW_LABEL, "capture://activated", ())
        .map_err(|error| error.to_string())?;
    Ok(())
}

pub fn hide_capture_bar(app: &AppHandle) -> Result<(), String> {
    let window = capture_window(app)?;
    window.hide().map_err(|error| error.to_string())
}

/** Changes only native window geometry; visual state stays in the React module. */
pub fn set_capture_bar_mode(app: &AppHandle, mode: CaptureBarMode) -> Result<(), String> {
    resize_capture_bar(&capture_window(app)?, mode)
}

/** Starts the operating system's native drag interaction from the explicit grip. */
pub fn start_capture_bar_drag(app: &AppHandle) -> Result<(), String> {
    capture_window(app)?
        .start_dragging()
        .map_err(|error| error.to_string())
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

fn capture_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    app.get_webview_window(CAPTURE_WINDOW_LABEL)
        .ok_or_else(|| "找不到悬浮记录窗口".to_string())
}

/**
 * Resizes around the current center and clamps the result to the monitor work
 * area. Center anchoring prevents the dot from jumping to an unrelated screen
 * position, while clamping keeps the expanded bar reachable near screen edges.
 */
fn resize_capture_bar(window: &WebviewWindow, mode: CaptureBarMode) -> Result<(), String> {
    let target = match mode {
        CaptureBarMode::Expanded => {
            LogicalSize::new(CAPTURE_EXPANDED_WIDTH, CAPTURE_EXPANDED_HEIGHT)
        }
        CaptureBarMode::Collapsed => {
            LogicalSize::new(CAPTURE_COLLAPSED_SIZE, CAPTURE_COLLAPSED_SIZE)
        }
    };

    let scale_factor = window.scale_factor().map_err(|error| error.to_string())?;
    let target_physical = target.to_physical::<u32>(scale_factor);
    let current_size = window.outer_size().map_err(|error| error.to_string())?;
    let current_position = window.outer_position().map_err(|error| error.to_string())?;

    let proposed_x = i64::from(current_position.x)
        + (i64::from(current_size.width) - i64::from(target_physical.width)) / 2;
    let proposed_y = i64::from(current_position.y)
        + (i64::from(current_size.height) - i64::from(target_physical.height)) / 2;

    let position = match window
        .current_monitor()
        .map_err(|error| error.to_string())?
    {
        Some(monitor) => {
            let work_area = monitor.work_area();
            PhysicalPosition::new(
                clamp_axis(
                    proposed_x,
                    work_area.position.x,
                    work_area.size.width,
                    target_physical.width,
                ),
                clamp_axis(
                    proposed_y,
                    work_area.position.y,
                    work_area.size.height,
                    target_physical.height,
                ),
            )
        }
        None => PhysicalPosition::new(clamp_i32(proposed_x), clamp_i32(proposed_y)),
    };

    window.set_size(target).map_err(|error| error.to_string())?;
    window
        .set_position(position)
        .map_err(|error| error.to_string())
}

fn clamp_axis(proposed: i64, origin: i32, extent: u32, target: u32) -> i32 {
    let minimum = i64::from(origin);
    let maximum = minimum + (i64::from(extent) - i64::from(target)).max(0);
    clamp_i32(proposed.clamp(minimum, maximum))
}

fn clamp_i32(value: i64) -> i32 {
    value.clamp(i64::from(i32::MIN), i64::from(i32::MAX)) as i32
}

#[cfg(test)]
mod tests {
    use super::clamp_axis;

    #[test]
    fn capture_window_position_is_kept_inside_the_work_area() {
        assert_eq!(clamp_axis(-50, 0, 1_920, 432), 0);
        assert_eq!(clamp_axis(1_800, 0, 1_920, 432), 1_488);
        assert_eq!(clamp_axis(600, 0, 1_920, 432), 600);
    }

    #[test]
    fn work_areas_smaller_than_the_window_anchor_at_their_origin() {
        assert_eq!(clamp_axis(200, -100, 40, 52), -100);
    }
}
