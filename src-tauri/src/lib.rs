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
    let app = tauri::Builder::default()
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

            // Config-declared windows intentionally have `create: false` so
            // no frontend command can run before the state above is managed.
            platform::windows::create_configured_windows(app)?;
            platform::tray::install(app)?;
            install_global_shortcut(app)?;

            // Flashnote behaves as a normal desktop app so users can keep it in
            // the macOS Dock and reopen the inbox from its Dock icon.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Regular);

            let settings = platform::settings::read(app.handle())
                .map_err(Box::<dyn std::error::Error>::from)?;
            if settings.keep_capture_bar_visible {
                platform::windows::show_capture_bar(app.handle())
                    .map_err(Box::<dyn std::error::Error>::from)?;
            }

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
            commands::set_capture_bar_mode,
            commands::start_capture_bar_drag,
            commands::open_inbox,
            commands::get_settings,
            commands::set_launch_at_login,
            commands::set_keep_capture_bar_visible,
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
        .build(tauri::generate_context!())
        .expect("failed to build Flashnote");

    app.run(|app_handle, event| {
        // When every window is hidden, clicking the macOS Dock icon should
        // restore the inbox instead of appearing unresponsive.
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Reopen {
            has_visible_windows: false,
            ..
        } = event
        {
            let _ = platform::windows::show_inbox(app_handle);
        }

        #[cfg(not(target_os = "macos"))]
        let _ = (app_handle, event);
    });
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
