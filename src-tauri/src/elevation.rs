use std::env;

pub fn is_elevated() -> bool {
    #[cfg(windows)]
    {
        return windows_impl::is_elevated();
    }
    #[cfg(unix)]
    {
        return unix_impl::is_elevated();
    }
    #[cfg(not(any(windows, unix)))]
    {
        return false;
    }
}

pub fn relaunch_as_admin() -> Result<(), String> {
    let exe = env::current_exe().map_err(|e| format!("current_exe: {e}"))?;
    #[cfg(windows)]
    {
        return windows_impl::relaunch(&exe);
    }
    #[cfg(unix)]
    {
        return unix_impl::relaunch(&exe);
    }
    #[cfg(not(any(windows, unix)))]
    {
        let _ = exe;
        return Err("plateforme non supportée".into());
    }
}

#[cfg(windows)]
mod windows_impl {
    use std::os::windows::ffi::OsStrExt;
    use std::path::Path;
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::{CloseHandle, HANDLE};
    use windows::Win32::Security::{
        GetTokenInformation, TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY,
    };
    use windows::Win32::System::Threading::{GetCurrentProcess, OpenProcessToken};
    use windows::Win32::UI::Shell::ShellExecuteW;
    use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

    pub fn is_elevated() -> bool {
        unsafe {
            let mut token = HANDLE::default();
            if OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &mut token).is_err() {
                return false;
            }
            let mut elevation = TOKEN_ELEVATION::default();
            let mut size = 0u32;
            let ok = GetTokenInformation(
                token,
                TokenElevation,
                Some(&mut elevation as *mut _ as *mut _),
                std::mem::size_of::<TOKEN_ELEVATION>() as u32,
                &mut size,
            )
            .is_ok();
            let _ = CloseHandle(token);
            ok && elevation.TokenIsElevated != 0
        }
    }

    pub fn relaunch(exe: &Path) -> Result<(), String> {
        // UTF-16 null-terminated pour ShellExecuteW.
        let exe_w: Vec<u16> = exe.as_os_str().encode_wide().chain(Some(0)).collect();
        let verb_w: Vec<u16> = "runas\0".encode_utf16().collect();

        let result = unsafe {
            ShellExecuteW(
                None,
                PCWSTR(verb_w.as_ptr()),
                PCWSTR(exe_w.as_ptr()),
                PCWSTR::null(),
                PCWSTR::null(),
                SW_SHOWNORMAL,
            )
        };

        // ShellExecuteW retourne un HINSTANCE > 32 en cas de succès.
        // L'utilisateur peut refuser le prompt UAC -> code 5 (SE_ERR_ACCESSDENIED).
        let code = result.0 as usize;
        if code > 32 {
            Ok(())
        } else if code == 5 {
            Err("élévation refusée par l'utilisateur".into())
        } else {
            Err(format!("ShellExecuteW a échoué (code {code})"))
        }
    }
}

#[cfg(unix)]
mod unix_impl {
    use std::path::Path;
    use std::process::Command;

    pub fn is_elevated() -> bool {
        // SAFETY: geteuid est thread-safe et sans effet de bord.
        unsafe { libc::geteuid() == 0 }
    }

    pub fn relaunch(exe: &Path) -> Result<(), String> {
        Command::new("pkexec")
            .arg(exe)
            .spawn()
            .map(|_| ())
            .map_err(|e| format!("pkexec: {e}"))
    }
}
