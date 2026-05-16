export type PlatformName = "windows" | "macos" | "linux";

function detect(): PlatformName {
  if (typeof navigator === "undefined") return "linux";
  const ua = navigator.userAgent;
  if (/Windows/i.test(ua)) return "windows";
  if (/Mac OS|Macintosh/i.test(ua)) return "macos";
  return "linux";
}

export const platform: PlatformName = detect();

// Commande CLI équivalente au kill exécuté par sysinfo::Process::kill().
// Windows -> TerminateProcess (Win32). Équivalent shell : `taskkill /F /PID`.
// Unix    -> kill(pid, SIGKILL).         Équivalent shell : `kill -9 PID`.
export function killCliCommand(pid: number): string {
  return platform === "windows" ? `taskkill /F /PID ${pid}` : `kill -9 ${pid}`;
}
