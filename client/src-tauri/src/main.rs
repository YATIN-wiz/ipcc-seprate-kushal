#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use sysinfo::{ProcessesToUpdate, System};
use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::Duration;
use tauri::{Emitter, Window};

static LOCKDOWN_ACTIVE: AtomicBool = AtomicBool::new(false);

// ─── THE BLACKLIST ───
// These are the binary names for screen recorders, remote desktops, and VMs.
const FORBIDDEN_PROCESSES: &[&str] = &[
    "obs64.exe", "obs32.exe", "discord.exe", "discord", "skype.exe",
    "teamviewer.exe", "anydesk.exe", "vboxclient.exe",
    "vmtoolsd.exe", "zoom.exe", "webex.exe", "telegram.exe",
    "telegram", "whatsapp.exe", "whatsapp", "brave.exe", "brave",
];

// ─── COMMAND: ENFORCE OS LOCKDOWN ───
#[tauri::command]
fn enforce_lockdown(window: Window) -> Result<(), String> {
    // 1. Force absolute fullscreen (hides Windows taskbar and Mac dock)
    window.set_fullscreen(true).map_err(|e| e.to_string())?;
    
    // 2. Pin to top (prevents opening cheat sheets over the exam)
    window.set_always_on_top(true).map_err(|e| e.to_string())?;
    
    // 3. Remove minimize/close buttons
    window.set_decorations(false).map_err(|e| e.to_string())?;
    
    // 4. Check for multiple monitors
    if let Ok(monitors) = window.available_monitors() {
        if monitors.len() > 1 {
            return Err("MULTIPLE_DISPLAYS_DETECTED".to_string());
        }
    }

    LOCKDOWN_ACTIVE.store(true, Ordering::SeqCst);
    
    Ok(())
}

// ─── COMMAND: MANUAL INTEGRITY CHECK ───
#[tauri::command]
fn perform_integrity_check() -> String {
    let mut sys = System::new_all();
    sys.refresh_all();

    let mut detected_threats = Vec::new();

    for (_pid, process) in sys.processes() {
        let proc_name = process.name().to_string_lossy().to_lowercase();
        for &forbidden in FORBIDDEN_PROCESSES {
            if proc_name.contains(forbidden) {
                detected_threats.push(proc_name.clone());
                break;
            }
        }
    }

    if detected_threats.is_empty() {
        "SECURE".to_string()
    } else {
        format!("TAMPER_DETECTED: {}", detected_threats.join(", "))
    }
}

// ─── COMMAND: KILL PROHIBITED APPS ───
fn kill_forbidden_processes() -> Vec<String> {
    let mut sys = System::new();
    sys.refresh_processes(ProcessesToUpdate::All, true);

    let mut killed = Vec::new();

    for (_pid, process) in sys.processes() {
        let proc_name = process.name().to_string_lossy().to_lowercase();

        // Never touch Tauri's embedded browser runtime.
        if proc_name.contains("msedgewebview2") {
            continue;
        }

        for &forbidden in FORBIDDEN_PROCESSES {
            if proc_name.contains(forbidden) {
                if process.kill() {
                    killed.push(proc_name.clone());
                }
                break;
            }
        }
    }

    killed
}

#[tauri::command]
fn kill_prohibited_apps() {
    thread::spawn(|| {
        let killed = kill_forbidden_processes();
        if !killed.is_empty() {
            log::warn!("Killed prohibited apps on demand: {}", killed.join(", "));
        }
    });
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let app_handle = app.handle().clone();
            
            // ─── THE WATCHDOG THREAD ───
            thread::spawn(move || {
                loop {
                    if !LOCKDOWN_ACTIVE.load(Ordering::Relaxed) {
                        thread::sleep(Duration::from_secs(2));
                        continue;
                    }

                    let killed = kill_forbidden_processes();
                    if !killed.is_empty() {
                        let _ = app_handle.emit(
                            "security_violation",
                            format!("Banned process terminated: {}", killed.join(", ")),
                        );
                    }
                    thread::sleep(Duration::from_secs(5));
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            enforce_lockdown, 
            perform_integrity_check,
            kill_prohibited_apps
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}