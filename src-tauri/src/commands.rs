use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use crate::{
    domain::capture::{Capture, CaptureFilter, CaptureStatus},
    domain::planning::{DailyNote, DailyRecord, FocusItem, PlanItem},
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

fn planning_changed(app: &AppHandle) {
    let _ = app.emit("planning://changed", ());
}

fn settings_changed(app: &AppHandle) {
    let _ = app.emit("settings://changed", ());
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
pub fn create_plan_item(
    app: AppHandle,
    state: State<'_, AppState>,
    title: String,
    parent_id: Option<String>,
) -> Result<PlanItem, String> {
    let item = state
        .planning
        .create_plan_item(&title, parent_id.as_deref())
        .map_err(|error| error.to_string())?;
    planning_changed(&app);
    Ok(item)
}

#[tauri::command]
pub fn list_plan_items(state: State<'_, AppState>) -> Result<Vec<PlanItem>, String> {
    state
        .planning
        .list_plan_items()
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn update_plan_item(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    title: String,
) -> Result<PlanItem, String> {
    let item = state
        .planning
        .update_plan_item(&id, &title)
        .map_err(|error| error.to_string())?;
    planning_changed(&app);
    Ok(item)
}

#[tauri::command]
pub fn set_plan_item_completed(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    completed: bool,
) -> Result<PlanItem, String> {
    let item = state
        .planning
        .set_plan_completed(&id, completed)
        .map_err(|error| error.to_string())?;
    planning_changed(&app);
    Ok(item)
}

#[tauri::command]
pub fn delete_plan_item(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    state
        .planning
        .delete_plan_item(&id)
        .map_err(|error| error.to_string())?;
    planning_changed(&app);
    Ok(())
}

#[tauri::command]
pub fn add_plan_item_to_day(
    app: AppHandle,
    state: State<'_, AppState>,
    plan_item_id: String,
    day: String,
) -> Result<FocusItem, String> {
    let item = state
        .planning
        .add_plan_to_day(&plan_item_id, &day)
        .map_err(|error| error.to_string())?;
    planning_changed(&app);
    Ok(item)
}

#[tauri::command]
pub fn list_focus_items(state: State<'_, AppState>, day: String) -> Result<Vec<FocusItem>, String> {
    state
        .planning
        .list_focus_items(&day)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn set_current_focus_item(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<FocusItem, String> {
    let item = state
        .planning
        .set_current_focus(&id)
        .map_err(|error| error.to_string())?;
    planning_changed(&app);
    Ok(item)
}

#[tauri::command]
pub fn set_focus_item_completed(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    completed: bool,
) -> Result<FocusItem, String> {
    let item = state
        .planning
        .set_focus_completed(&id, completed)
        .map_err(|error| error.to_string())?;
    planning_changed(&app);
    Ok(item)
}

#[tauri::command]
pub fn remove_focus_item(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    state
        .planning
        .remove_focus_item(&id)
        .map_err(|error| error.to_string())?;
    planning_changed(&app);
    Ok(())
}

#[tauri::command]
pub fn get_daily_note(
    state: State<'_, AppState>,
    day: String,
) -> Result<Option<DailyNote>, String> {
    state
        .planning
        .get_daily_note(&day)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub fn save_daily_note(
    app: AppHandle,
    state: State<'_, AppState>,
    day: String,
    content: String,
) -> Result<Option<DailyNote>, String> {
    let note = state
        .planning
        .save_daily_note(&day, &content)
        .map_err(|error| error.to_string())?;
    planning_changed(&app);
    Ok(note)
}

#[tauri::command]
pub fn list_daily_records(state: State<'_, AppState>) -> Result<Vec<DailyRecord>, String> {
    state
        .planning
        .list_daily_records()
        .map_err(|error| error.to_string())
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
pub fn show_focus_window(app: AppHandle) -> Result<(), String> {
    windows::show_focus_window(&app)
}

#[tauri::command]
pub fn hide_focus_window(app: AppHandle) -> Result<(), String> {
    windows::hide_focus_window(&app)
}

#[tauri::command]
pub fn set_focus_window_mode(app: AppHandle, mode: windows::FocusWindowMode) -> Result<(), String> {
    windows::set_focus_window_mode(&app, mode)
}

#[tauri::command]
pub fn start_focus_window_drag(app: AppHandle) -> Result<(), String> {
    windows::start_focus_window_drag(&app)
}

#[tauri::command]
pub fn open_inbox(app: AppHandle) -> Result<(), String> {
    windows::show_inbox(&app)
}

#[tauri::command]
pub fn open_main_view(app: AppHandle, view: String) -> Result<(), String> {
    windows::open_main_view(&app, &view)
}

#[tauri::command]
pub fn get_settings(app: AppHandle) -> Result<settings::AppSettings, String> {
    settings::read(&app)
}

#[tauri::command]
pub fn set_launch_at_login(app: AppHandle, enabled: bool) -> Result<settings::AppSettings, String> {
    let current = settings::set_launch_at_login(&app, enabled)?;
    settings_changed(&app);
    Ok(current)
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
    settings_changed(&app);
    Ok(current)
}

#[tauri::command]
pub fn set_auto_collapse_capture_bar(
    app: AppHandle,
    enabled: bool,
) -> Result<settings::AppSettings, String> {
    let current = settings::set_auto_collapse_capture_bar(&app, enabled)?;
    settings_changed(&app);
    Ok(current)
}

#[tauri::command]
pub fn set_capture_bar_collapse_delay(
    app: AppHandle,
    delay_ms: u64,
) -> Result<settings::AppSettings, String> {
    let current = settings::set_capture_bar_collapse_delay(&app, delay_ms)?;
    settings_changed(&app);
    Ok(current)
}

#[tauri::command]
pub fn set_capture_bar_always_on_top(
    app: AppHandle,
    enabled: bool,
) -> Result<settings::AppSettings, String> {
    let current = settings::set_capture_bar_always_on_top(&app, enabled)?;
    windows::set_capture_bar_always_on_top(&app, enabled)?;
    settings_changed(&app);
    Ok(current)
}

#[tauri::command]
pub fn set_remember_capture_bar_position(
    app: AppHandle,
    enabled: bool,
) -> Result<settings::AppSettings, String> {
    let current = settings::set_remember_capture_bar_position(&app, enabled)?;
    if enabled {
        windows::remember_capture_bar_position(&app)?;
    }
    settings_changed(&app);
    Ok(current)
}

#[tauri::command]
pub fn set_keep_focus_window_visible(
    app: AppHandle,
    enabled: bool,
) -> Result<settings::AppSettings, String> {
    let current = settings::set_keep_focus_window_visible(&app, enabled)?;
    if enabled {
        windows::show_focus_window(&app)?;
    } else {
        windows::hide_focus_window(&app)?;
    }
    settings_changed(&app);
    Ok(current)
}

#[tauri::command]
pub fn set_auto_collapse_focus_window(
    app: AppHandle,
    enabled: bool,
) -> Result<settings::AppSettings, String> {
    let current = settings::set_auto_collapse_focus_window(&app, enabled)?;
    settings_changed(&app);
    Ok(current)
}
