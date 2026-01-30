use tauri::{
    menu::{Menu, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder},
    App, Emitter, Runtime,
};

const MENU_NEW_CONNECTION: &str = "new-connection";
const MENU_DISCONNECT: &str = "disconnect";
const MENU_EXPORT_PNG: &str = "export-png";
const MENU_EXPORT_PDF: &str = "export-pdf";
const MENU_EXPORT_JSON: &str = "export-json";
const MENU_SETTINGS: &str = "settings";
const MENU_TOGGLE_SIDEBAR: &str = "toggle-sidebar";
const MENU_FIT_VIEW: &str = "fit-view";
const MENU_ACTUAL_SIZE: &str = "actual-size";
const MENU_ABOUT: &str = "about";
const MENU_DOCUMENTATION: &str = "documentation";
const MENU_CHECK_UPDATES: &str = "check-updates";

pub fn setup_menu<R: Runtime>(app: &App<R>) -> Result<Menu<R>, tauri::Error> {
    let app_handle = app.handle();

    // Export submenu (shared between platforms)
    let export_submenu = SubmenuBuilder::new(app_handle, "Export")
        .item(
            &MenuItemBuilder::with_id(MENU_EXPORT_PNG, "Export as PNG...")
                .accelerator("CmdOrCtrl+Shift+P")
                .build(app_handle)?,
        )
        .item(
            &MenuItemBuilder::with_id(MENU_EXPORT_PDF, "Export as PDF...")
                .accelerator("CmdOrCtrl+Shift+D")
                .build(app_handle)?,
        )
        .item(
            &MenuItemBuilder::with_id(MENU_EXPORT_JSON, "Export as JSON...")
                .accelerator("CmdOrCtrl+Shift+J")
                .build(app_handle)?,
        )
        .build()?;

    #[cfg(target_os = "macos")]
    {
        // macOS: App menu with About, Settings, Hide/Show, Quit
        let app_menu = SubmenuBuilder::new(app_handle, "Monocle")
            .item(
                &MenuItemBuilder::with_id(MENU_ABOUT, "About Monocle").build(app_handle)?,
            )
            .item(
                &MenuItemBuilder::with_id(MENU_CHECK_UPDATES, "Check for Updates...")
                    .build(app_handle)?,
            )
            .separator()
            .item(
                &MenuItemBuilder::with_id(MENU_SETTINGS, "Settings...")
                    .accelerator("CmdOrCtrl+,")
                    .build(app_handle)?,
            )
            .separator()
            .item(&PredefinedMenuItem::hide(app_handle, Some("Hide Monocle"))?)
            .item(&PredefinedMenuItem::hide_others(app_handle, Some("Hide Others"))?)
            .item(&PredefinedMenuItem::show_all(app_handle, Some("Show All"))?)
            .separator()
            .item(&PredefinedMenuItem::quit(app_handle, Some("Quit Monocle"))?)
            .build()?;

        let file_menu = SubmenuBuilder::new(app_handle, "File")
            .item(
                &MenuItemBuilder::with_id(MENU_NEW_CONNECTION, "New Connection...")
                    .accelerator("CmdOrCtrl+N")
                    .build(app_handle)?,
            )
            .item(
                &MenuItemBuilder::with_id(MENU_DISCONNECT, "Disconnect")
                    .accelerator("CmdOrCtrl+W")
                    .build(app_handle)?,
            )
            .separator()
            .item(&export_submenu)
            .build()?;

        let edit_menu = SubmenuBuilder::new(app_handle, "Edit")
            .item(&PredefinedMenuItem::cut(app_handle, Some("Cut"))?)
            .item(&PredefinedMenuItem::copy(app_handle, Some("Copy"))?)
            .item(&PredefinedMenuItem::paste(app_handle, Some("Paste"))?)
            .item(&PredefinedMenuItem::select_all(app_handle, Some("Select All"))?)
            .build()?;

        let view_menu = SubmenuBuilder::new(app_handle, "View")
            .item(
                &MenuItemBuilder::with_id(MENU_TOGGLE_SIDEBAR, "Toggle Sidebar")
                    .accelerator("CmdOrCtrl+B")
                    .build(app_handle)?,
            )
            .separator()
            .item(
                &MenuItemBuilder::with_id(MENU_FIT_VIEW, "Fit to Screen")
                    .accelerator("CmdOrCtrl+0")
                    .build(app_handle)?,
            )
            .item(
                &MenuItemBuilder::with_id(MENU_ACTUAL_SIZE, "Actual Size")
                    .accelerator("CmdOrCtrl+1")
                    .build(app_handle)?,
            )
            .build()?;

        let help_menu = SubmenuBuilder::new(app_handle, "Help")
            .item(
                &MenuItemBuilder::with_id(MENU_DOCUMENTATION, "Documentation").build(app_handle)?,
            )
            .build()?;

        let menu = MenuBuilder::new(app_handle)
            .item(&app_menu)
            .item(&file_menu)
            .item(&edit_menu)
            .item(&view_menu)
            .item(&help_menu)
            .build()?;

        Ok(menu)
    }

    #[cfg(not(target_os = "macos"))]
    {
        // Windows/Linux: File menu with Settings and Exit
        let file_menu = SubmenuBuilder::new(app_handle, "File")
            .item(
                &MenuItemBuilder::with_id(MENU_NEW_CONNECTION, "New Connection...")
                    .accelerator("Ctrl+N")
                    .build(app_handle)?,
            )
            .item(
                &MenuItemBuilder::with_id(MENU_DISCONNECT, "Disconnect")
                    .accelerator("Ctrl+W")
                    .build(app_handle)?,
            )
            .separator()
            .item(&export_submenu)
            .separator()
            .item(
                &MenuItemBuilder::with_id(MENU_SETTINGS, "Settings...")
                    .accelerator("Ctrl+,")
                    .build(app_handle)?,
            )
            .separator()
            .item(&PredefinedMenuItem::quit(app_handle, Some("Exit"))?)
            .build()?;

        let edit_menu = SubmenuBuilder::new(app_handle, "Edit")
            .item(&PredefinedMenuItem::cut(app_handle, Some("Cut"))?)
            .item(&PredefinedMenuItem::copy(app_handle, Some("Copy"))?)
            .item(&PredefinedMenuItem::paste(app_handle, Some("Paste"))?)
            .item(&PredefinedMenuItem::select_all(app_handle, Some("Select All"))?)
            .build()?;

        let view_menu = SubmenuBuilder::new(app_handle, "View")
            .item(
                &MenuItemBuilder::with_id(MENU_TOGGLE_SIDEBAR, "Toggle Sidebar")
                    .accelerator("Ctrl+B")
                    .build(app_handle)?,
            )
            .separator()
            .item(
                &MenuItemBuilder::with_id(MENU_FIT_VIEW, "Fit to Screen")
                    .accelerator("Ctrl+0")
                    .build(app_handle)?,
            )
            .item(
                &MenuItemBuilder::with_id(MENU_ACTUAL_SIZE, "Actual Size")
                    .accelerator("Ctrl+1")
                    .build(app_handle)?,
            )
            .build()?;

        let help_menu = SubmenuBuilder::new(app_handle, "Help")
            .item(&MenuItemBuilder::with_id(MENU_ABOUT, "About Monocle").build(app_handle)?)
            .item(
                &MenuItemBuilder::with_id(MENU_DOCUMENTATION, "Documentation").build(app_handle)?,
            )
            .separator()
            .item(
                &MenuItemBuilder::with_id(MENU_CHECK_UPDATES, "Check for Updates...")
                    .build(app_handle)?,
            )
            .build()?;

        let menu = MenuBuilder::new(app_handle)
            .item(&file_menu)
            .item(&edit_menu)
            .item(&view_menu)
            .item(&help_menu)
            .build()?;

        Ok(menu)
    }
}

pub fn setup_menu_events<R: Runtime>(app: &App<R>) {
    let app_handle = app.handle().clone();

    app.on_menu_event(move |_app, event| {
        let event_name = match event.id().as_ref() {
            MENU_NEW_CONNECTION => "menu:new-connection",
            MENU_DISCONNECT => "menu:disconnect",
            MENU_EXPORT_PNG => "menu:export-png",
            MENU_EXPORT_PDF => "menu:export-pdf",
            MENU_EXPORT_JSON => "menu:export-json",
            MENU_SETTINGS => "menu:settings",
            MENU_TOGGLE_SIDEBAR => "menu:toggle-sidebar",
            MENU_FIT_VIEW => "menu:fit-view",
            MENU_ACTUAL_SIZE => "menu:actual-size",
            MENU_ABOUT => "menu:about",
            MENU_DOCUMENTATION => "menu:documentation",
            MENU_CHECK_UPDATES => "menu:check-updates",
            _ => return,
        };

        if let Err(e) = app_handle.emit(event_name, ()) {
            eprintln!("Failed to emit menu event {}: {}", event_name, e);
        }
    });
}
