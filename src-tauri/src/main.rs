// Empêche l'ouverture d'une console Windows en mode release pour la GUI.
// En mode CLI on attache la console parente dynamiquement (attach_console).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::env;

fn main() {
    let args: Vec<String> = env::args().collect();

    if args.len() > 1 {
        match args[1].as_str() {
            "--list" | "-l" | "list" => {
                attach_console();
                cli_list();
                return;
            }
            "--kill" | "-k" | "kill" => {
                attach_console();
                cli_kill(args.get(2).map(String::as_str));
                return;
            }
            "--version" | "-V" => {
                attach_console();
                println!("NexPort {}", env!("CARGO_PKG_VERSION"));
                return;
            }
            "--help" | "-h" | "help" => {
                attach_console();
                print_help();
                return;
            }
            // Argument inconnu : on suppose un lancement OS (tray, autostart
            // avec --silent, etc.) et on demarre la GUI normalement.
            _ => {}
        }
    }

    nexport_lib::run()
}

#[cfg(windows)]
fn attach_console() {
    use windows::Win32::System::Console::{AttachConsole, ATTACH_PARENT_PROCESS};
    // SAFETY: best effort, ignore le resultat si pas de console parente.
    unsafe {
        let _ = AttachConsole(ATTACH_PARENT_PROCESS);
    }
}

#[cfg(not(windows))]
fn attach_console() {}

fn cli_list() {
    let rows = nexport_lib::ports::list_ports();
    println!(
        "{:<6} {:<5} {:<5} {:<13} {:<8} {}",
        "PORT", "PROTO", "FAM", "STATE", "PID", "PROCESS"
    );
    println!("{}", "-".repeat(70));
    for r in rows {
        println!(
            "{:<6} {:<5} {:<5} {:<13} {:<8} {}",
            r.port,
            r.protocol.as_str(),
            family_str(r.family),
            format!("{:?}", r.state),
            r.pid.map(|p| p.to_string()).unwrap_or_else(|| "-".into()),
            r.process_name.unwrap_or_else(|| "?".into()),
        );
    }
}

fn cli_kill(arg: Option<&str>) {
    let Some(arg) = arg else {
        eprintln!("Usage : nexport --kill <PID>");
        std::process::exit(2);
    };
    let pid: u32 = match arg.parse() {
        Ok(p) => p,
        Err(_) => {
            eprintln!("PID invalide : {arg}");
            std::process::exit(2);
        }
    };
    match nexport_lib::ports::kill(pid) {
        Ok(()) => println!("PID {pid} tue"),
        Err(e) => {
            eprintln!("Erreur : {e}");
            std::process::exit(1);
        }
    }
}

fn family_str(f: nexport_lib::models::Family) -> &'static str {
    use nexport_lib::models::Family;
    match f {
        Family::V4 => "IPv4",
        Family::V6 => "IPv6",
    }
}

fn print_help() {
    let v = env!("CARGO_PKG_VERSION");
    println!("NexPort {v} - utilitaire des ports reseau ouverts\n");
    println!("USAGE :");
    println!("  nexport                  Lance l'interface graphique");
    println!("  nexport --list           Liste les ports ouverts");
    println!("  nexport --kill <PID>     Tue le process");
    println!("  nexport --version        Affiche la version");
    println!("  nexport --help           Affiche cette aide");
}
