mod application;
mod commands;
mod domain;
mod error;
mod infrastructure;
mod platform;

use std::{fs, sync::Arc};

use application::capture_service::CaptureService;
use infrastructure::sqlite_capture_repository::SqliteCaptureRepository;
use tauri::{Manager, WindowEvent};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

pub const SHORTCUT_LABEL: &str = "CommandOrControl+Shift+Space";

/** Shared application state contains use-case services, never raw database handles. */
pub struct AppState {
    pub captures: CaptureService,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let _ = platform::windows::show_inbox(app);
        }))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            fs::create_dir_all(&data_dir)?;
            let repository = SqliteCaptureRepository::open(&data_dir.join("flashnote.sqlite3"))
                .map_err(|error| Box::<dyn std::error::Error>::from(error.to_string()))?;
            app.manage(AppState {
                captures: CaptureService::new(Arc::new(repository)),
            });

            platform::tray::install(app)?;
            install_global_shortcut(app)?;

            // Accessory apps live in the menu bar without adding permanent Dock clutter.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::create_capture,
            commands::list_captures,
            commands::update_capture,
            commands::set_capture_status,
            commands::delete_capture,
            commands::restore_capture,
            commands::show_capture_bar,
            commands::hide_capture_bar,
            commands::open_inbox,
            commands::get_settings,
            commands::set_launch_at_login,
        ])
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                // Closing a window hides it; the tray process remains ready for capture.
                if matches!(window.label(), "inbox" | "capture") {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("failed to run Flashnote");
}

fn install_global_shortcut(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let shortcut = SHORTCUT_LABEL.parse::<Shortcut>()?;
    app.global_shortcut()
        .on_shortcut(shortcut, move |app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                let _ = platform::windows::show_capture_bar(app);
            }
        })?;
    Ok(())
}
