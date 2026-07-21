// Release builds are GUI applications. Without this attribute Windows also
// creates a console window and ties the desktop app's lifetime to that console.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    flashnote_lib::run();
}
