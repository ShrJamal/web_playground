#[cfg_attr(mobile, tauri::mobile_entry_point)]
// Starts the native shell that loads the Solid frontend.
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
