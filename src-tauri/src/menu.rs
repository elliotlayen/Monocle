use tauri::{
    menu::{Menu, MenuBuilder, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder},
    App, AppHandle, Emitter, Runtime,
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
const MENU_ZOOM_IN: &str = "zoom-in";
const MENU_ZOOM_OUT: &str = "zoom-out";
const MENU_RESET_FILTERS: &str = "reset-filters";
const MENU_CLEAR_FOCUS: &str = "clear-focus";
const MENU_ABOUT: &str = "about";
const MENU_DOCUMENTATION: &str = "documentation";
const MENU_CHECK_UPDATES: &str = "check-updates";
const MENU_CANVAS_SUBMENU: &str = "canvas-submenu";
const MENU_EDIT_SUBMENU: &str = "edit-submenu";
const MENU_VIEW_SUBMENU: &str = "view-submenu";
const MENU_ENTER_CANVAS: &str = "enter-canvas";
const MENU_CANVAS_OPEN: &str = "canvas-open";
const MENU_CANVAS_SAVE: &str = "canvas-save";
const MENU_EXIT_CANVAS: &str = "exit-canvas";
const MENU_CANVAS_IMPORT: &str = "canvas-import";
const MENU_DELETE_SELECTION: &str = "delete-selection";

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
        let canvas_menu = SubmenuBuilder::with_id(app_handle, MENU_CANVAS_SUBMENU, "Canvas")
            .item(
                &MenuItemBuilder::with_id(MENU_ENTER_CANVAS, "Enter Canvas Mode")
                    .accelerator("CmdOrCtrl+K")
                    .build(app_handle)?,
            )
            .item(
                &MenuItemBuilder::with_id(MENU_CANVAS_OPEN, "Open Canvas File...")
                    .accelerator("CmdOrCtrl+O")
                    .build(app_handle)?,
            )
            .item(
                &MenuItemBuilder::with_id(MENU_CANVAS_SAVE, "Save Canvas")
                    .accelerator("CmdOrCtrl+S")
                    .enabled(false)
                    .build(app_handle)?,
            )
            .item(
                &MenuItemBuilder::with_id(MENU_EXIT_CANVAS, "Exit Canvas Mode")
                    .accelerator("CmdOrCtrl+Shift+K")
                    .enabled(false)
                    .build(app_handle)?,
            )
            .separator()
            .item(
                &MenuItemBuilder::with_id(MENU_CANVAS_IMPORT, "Import from Database...")
                    .enabled(false)
                    .build(app_handle)?,
            )
            .build()?;

        // macOS: App menu with About, Settings, Hide/Show, Quit
        let app_menu = SubmenuBuilder::new(app_handle, "Monocle")
            .item(&MenuItemBuilder::with_id(MENU_ABOUT, "About Monocle").build(app_handle)?)
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

        let edit_menu = SubmenuBuilder::with_id(app_handle, MENU_EDIT_SUBMENU, "Edit")
            .item(&PredefinedMenuItem::cut(app_handle, Some("Cut"))?)
            .item(&PredefinedMenuItem::copy(app_handle, Some("Copy"))?)
            .item(&PredefinedMenuItem::paste(app_handle, Some("Paste"))?)
            .item(&PredefinedMenuItem::select_all(app_handle, Some("Select All"))?)
            .separator()
            .item(
                &MenuItemBuilder::with_id(MENU_DELETE_SELECTION, "Delete Selection")
                    .enabled(false)
                    .build(app_handle)?,
            )
            .build()?;

        let view_menu = SubmenuBuilder::with_id(app_handle, MENU_VIEW_SUBMENU, "View")
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
            .separator()
            .item(
                &MenuItemBuilder::with_id(MENU_ZOOM_IN, "Zoom In")
                    .accelerator("CmdOrCtrl+=")
                    .build(app_handle)?,
            )
            .item(
                &MenuItemBuilder::with_id(MENU_ZOOM_OUT, "Zoom Out")
                    .accelerator("CmdOrCtrl+-")
                    .build(app_handle)?,
            )
            .separator()
            .item(
                &MenuItemBuilder::with_id(MENU_RESET_FILTERS, "Reset Filters")
                    .enabled(false)
                    .build(app_handle)?,
            )
            .item(
                &MenuItemBuilder::with_id(MENU_CLEAR_FOCUS, "Clear Focus")
                    .enabled(false)
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
            .item(&canvas_menu)
            .item(&help_menu)
            .build()?;

        Ok(menu)
    }

    #[cfg(not(target_os = "macos"))]
    {
        let canvas_menu = SubmenuBuilder::with_id(app_handle, MENU_CANVAS_SUBMENU, "Canvas")
            .item(
                &MenuItemBuilder::with_id(MENU_ENTER_CANVAS, "Enter Canvas Mode")
                    .accelerator("Ctrl+K")
                    .build(app_handle)?,
            )
            .item(
                &MenuItemBuilder::with_id(MENU_CANVAS_OPEN, "Open Canvas File...")
                    .accelerator("Ctrl+O")
                    .build(app_handle)?,
            )
            .item(
                &MenuItemBuilder::with_id(MENU_CANVAS_SAVE, "Save Canvas")
                    .accelerator("Ctrl+S")
                    .enabled(false)
                    .build(app_handle)?,
            )
            .item(
                &MenuItemBuilder::with_id(MENU_EXIT_CANVAS, "Exit Canvas Mode")
                    .accelerator("Ctrl+Shift+K")
                    .enabled(false)
                    .build(app_handle)?,
            )
            .separator()
            .item(
                &MenuItemBuilder::with_id(MENU_CANVAS_IMPORT, "Import from Database...")
                    .enabled(false)
                    .build(app_handle)?,
            )
            .build()?;

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

        let edit_menu = SubmenuBuilder::with_id(app_handle, MENU_EDIT_SUBMENU, "Edit")
            .item(&PredefinedMenuItem::cut(app_handle, Some("Cut"))?)
            .item(&PredefinedMenuItem::copy(app_handle, Some("Copy"))?)
            .item(&PredefinedMenuItem::paste(app_handle, Some("Paste"))?)
            .item(&PredefinedMenuItem::select_all(app_handle, Some("Select All"))?)
            .separator()
            .item(
                &MenuItemBuilder::with_id(MENU_DELETE_SELECTION, "Delete Selection")
                    .enabled(false)
                    .build(app_handle)?,
            )
            .build()?;

        let view_menu = SubmenuBuilder::with_id(app_handle, MENU_VIEW_SUBMENU, "View")
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
            .separator()
            .item(
                &MenuItemBuilder::with_id(MENU_ZOOM_IN, "Zoom In")
                    .accelerator("Ctrl+=")
                    .build(app_handle)?,
            )
            .item(
                &MenuItemBuilder::with_id(MENU_ZOOM_OUT, "Zoom Out")
                    .accelerator("Ctrl+-")
                    .build(app_handle)?,
            )
            .separator()
            .item(
                &MenuItemBuilder::with_id(MENU_RESET_FILTERS, "Reset Filters")
                    .enabled(false)
                    .build(app_handle)?,
            )
            .item(
                &MenuItemBuilder::with_id(MENU_CLEAR_FOCUS, "Clear Focus")
                    .enabled(false)
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
            .item(&canvas_menu)
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
            MENU_ZOOM_IN => "menu:zoom-in",
            MENU_ZOOM_OUT => "menu:zoom-out",
            MENU_RESET_FILTERS => "menu:reset-filters",
            MENU_CLEAR_FOCUS => "menu:clear-focus",
            MENU_ABOUT => "menu:about",
            MENU_DOCUMENTATION => "menu:documentation",
            MENU_CHECK_UPDATES => "menu:check-updates",
            MENU_ENTER_CANVAS => "menu:enter-canvas",
            MENU_CANVAS_OPEN => "menu:canvas-open",
            MENU_CANVAS_SAVE => "menu:canvas-save",
            MENU_EXIT_CANVAS => "menu:exit-canvas",
            MENU_CANVAS_IMPORT => "menu:canvas-import",
            MENU_DELETE_SELECTION => "menu:delete-selection",
            _ => return,
        };

        if let Err(e) = app_handle.emit(event_name, ()) {
            eprintln!("Failed to emit menu event {}: {}", event_name, e);
        }
    });
}

fn set_submenu_item_enabled<R: Runtime>(
    submenu: &tauri::menu::Submenu<R>,
    item_id: &str,
    enabled: bool,
) -> Result<(), String> {
    let item = submenu
        .get(item_id)
        .ok_or_else(|| format!("menu item '{}' not found", item_id))?;
    let menu_item = item
        .as_menuitem()
        .ok_or_else(|| format!("menu item '{}' is not a normal menu item", item_id))?;
    menu_item
        .set_enabled(enabled)
        .map_err(|e| format!("failed to set '{}' enabled state: {}", item_id, e))
}

fn get_submenu_by_id<R: Runtime>(
    app_menu: &Menu<R>,
    submenu_id: &str,
) -> Result<tauri::menu::Submenu<R>, String> {
    app_menu
        .get(submenu_id)
        .and_then(|item| item.as_submenu().cloned())
        .ok_or_else(|| format!("submenu '{}' was not found", submenu_id))
}

pub fn set_menu_ui_state<R: Runtime>(
    app_handle: &AppHandle<R>,
    is_canvas_mode: bool,
    has_focus: bool,
    has_active_filters: bool,
) -> Result<(), String> {
    let app_menu = app_handle
        .menu()
        .ok_or_else(|| "application menu is not initialized".to_string())?;
    let canvas_submenu = get_submenu_by_id(&app_menu, MENU_CANVAS_SUBMENU)?;
    let edit_submenu = get_submenu_by_id(&app_menu, MENU_EDIT_SUBMENU)?;
    let view_submenu = get_submenu_by_id(&app_menu, MENU_VIEW_SUBMENU)?;

    set_submenu_item_enabled(&canvas_submenu, MENU_ENTER_CANVAS, !is_canvas_mode)?;
    set_submenu_item_enabled(&canvas_submenu, MENU_CANVAS_OPEN, true)?;
    set_submenu_item_enabled(&canvas_submenu, MENU_CANVAS_SAVE, is_canvas_mode)?;
    set_submenu_item_enabled(&canvas_submenu, MENU_EXIT_CANVAS, is_canvas_mode)?;
    set_submenu_item_enabled(&canvas_submenu, MENU_CANVAS_IMPORT, is_canvas_mode)?;

    set_submenu_item_enabled(&edit_submenu, MENU_DELETE_SELECTION, is_canvas_mode)?;

    set_submenu_item_enabled(&view_submenu, MENU_CLEAR_FOCUS, has_focus)?;
    set_submenu_item_enabled(&view_submenu, MENU_RESET_FILTERS, has_active_filters)?;

    Ok(())
}
