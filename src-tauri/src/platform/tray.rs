use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    App,
};

use super::windows::{open_main_view, show_capture_bar, show_focus_window, show_inbox};

pub fn install(app: &App) -> tauri::Result<()> {
    let record = MenuItem::with_id(app, "record", "快速记录", true, None::<&str>)?;
    let inbox = MenuItem::with_id(app, "inbox", "打开稍后看", true, None::<&str>)?;
    let today = MenuItem::with_id(app, "today", "打开今日专注", true, None::<&str>)?;
    let focus = MenuItem::with_id(app, "focus", "显示今日专注浮窗", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&record, &inbox, &today, &focus, &quit])?;

    let mut builder = TrayIconBuilder::new()
        .menu(&menu)
        .show_menu_on_left_click(true)
        .tooltip("Flashnote · 先收下来，别打断当下")
        .on_menu_event(|app, event| match event.id.as_ref() {
            "record" => {
                let _ = show_capture_bar(app);
            }
            "inbox" => {
                let _ = show_inbox(app);
            }
            "today" => {
                let _ = open_main_view(app, "today");
            }
            "focus" => {
                let _ = show_focus_window(app);
            }
            "quit" => app.exit(0),
            _ => {}
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone()).icon_as_template(true);
    }
    builder.build(app)?;
    Ok(())
}
