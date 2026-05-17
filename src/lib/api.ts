import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { openPath, revealItemInDir, openUrl } from "@tauri-apps/plugin-opener";
import type {
  AutoKillError,
  EventFilter,
  EventRow,
  FirewallBlock,
  PortEvent,
  PortRow,
  ProcessDetails,
  Settings,
} from "../types";

const isTauri =
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const MOCK_ROWS: PortRow[] = [
  {
    id: "tcp-3000-1234",
    port: 3000,
    protocol: "TCP",
    family: "IPv4",
    state: "LISTEN",
    pid: 1234,
    processName: "node.exe",
    processPath: "C:\\Program Files\\nodejs\\node.exe",
    processCwd: "D:\\Projects\\my-app",
    remoteAddr: null,
    requiresAdmin: false,
    risk: { level: "SAFE", reason: null },
    framework: null,
    openedAt: Date.now() / 1000,
  },
  {
    id: "tcp-5173-4321",
    port: 5173,
    protocol: "TCP",
    family: "IPv4",
    state: "LISTEN",
    pid: 4321,
    processName: "node.exe",
    processPath: "C:\\Program Files\\nodejs\\node.exe",
    processCwd: "D:\\Projects\\frontend",
    remoteAddr: null,
    requiresAdmin: false,
    risk: { level: "SAFE", reason: null },
    framework: null,
    openedAt: Date.now() / 1000,
  },
  {
    id: "tcp-8080-9876",
    port: 8080,
    protocol: "TCP",
    family: "IPv6",
    state: "ESTABLISHED",
    pid: 9876,
    processName: "java.exe",
    processPath: "C:\\Program Files\\Java\\jdk-21\\bin\\java.exe",
    processCwd: "D:\\Projects\\backend",
    remoteAddr: "192.168.1.50:443",
    requiresAdmin: false,
    risk: { level: "SAFE", reason: null },
    framework: null,
    openedAt: Date.now() / 1000,
  },
  {
    id: "tcp-80-4",
    port: 80,
    protocol: "TCP",
    family: "IPv4",
    state: "LISTEN",
    pid: 4,
    processName: "System",
    processPath: null,
    processCwd: null,
    remoteAddr: null,
    requiresAdmin: true,
    risk: { level: "WARNING", reason: "Port HTTP standard" },
    framework: null,
    openedAt: Date.now() / 1000,
  },
  {
    id: "udp-53-1500",
    port: 53,
    protocol: "UDP",
    family: "IPv4",
    state: "UNKNOWN",
    pid: 1500,
    processName: "svchost.exe",
    processPath: "C:\\Windows\\System32\\svchost.exe",
    processCwd: null,
    remoteAddr: null,
    requiresAdmin: true,
    risk: { level: "SAFE", reason: null },
    framework: null,
    openedAt: Date.now() / 1000,
  },
  {
    id: "tcp-5432-2222",
    port: 5432,
    protocol: "TCP",
    family: "IPv4",
    state: "LISTEN",
    pid: 2222,
    processName: "postgres.exe",
    processPath: "C:\\Program Files\\PostgreSQL\\16\\bin\\postgres.exe",
    processCwd: "C:\\Program Files\\PostgreSQL\\16\\data",
    remoteAddr: null,
    requiresAdmin: false,
    risk: { level: "SAFE", reason: null },
    framework: null,
    openedAt: Date.now() / 1000,
  },
];

export async function listPorts(): Promise<PortRow[]> {
  if (isTauri) {
    return await invoke<PortRow[]>("list_ports");
  }
  await new Promise((r) => setTimeout(r, 120));
  return structuredClone(MOCK_ROWS);
}

export async function getProcessDetails(pid: number): Promise<ProcessDetails> {
  if (!isTauri) {
    return {
      pid,
      name: "mock.exe",
      exe: "C:\\fake\\path\\mock.exe",
      cwd: "C:\\fake\\cwd",
      cmd: ["mock.exe", "--port", "3000"],
      parentPid: 1,
      parentName: "explorer.exe",
      memoryBytes: 128 * 1024 * 1024,
      virtualMemoryBytes: 256 * 1024 * 1024,
      cpuUsage: 1.5,
      startTime: Math.floor(Date.now() / 1000) - 3600,
      runTime: 3600,
    };
  }
  return await invoke<ProcessDetails>("get_process_details", { pid });
}

export async function killProcess(pid: number): Promise<void> {
  if (isTauri) {
    await invoke<void>("kill_process", { pid });
    return;
  }
  await new Promise((r) => setTimeout(r, 80));
  console.log(`[mock] kill PID ${pid}`);
}

export async function openProcessFolder(path: string): Promise<void> {
  if (isTauri) {
    await revealItemInDir(path);
    return;
  }
  console.log(`[mock] reveal ${path}`);
}

export async function openCwd(cwd: string): Promise<void> {
  if (isTauri) {
    await openPath(cwd);
    return;
  }
  console.log(`[mock] open ${cwd}`);
}

export async function openInBrowser(url: string): Promise<void> {
  if (isTauri) {
    await openUrl(url);
    return;
  }
  window.open(url, "_blank");
}

export async function listFavorites(): Promise<number[]> {
  if (!isTauri) return [];
  return await invoke<number[]>("list_favorites");
}

export async function addFavorite(port: number, label?: string): Promise<void> {
  if (!isTauri) return;
  await invoke<void>("add_favorite", { port, label: label ?? null });
}

export async function removeFavorite(port: number): Promise<void> {
  if (!isTauri) return;
  await invoke<void>("remove_favorite", { port });
}

export async function onPortEvent(
  handler: (e: PortEvent) => void,
): Promise<UnlistenFn> {
  if (!isTauri) return async () => {};
  return await listen<PortEvent>("port-event", (e) => handler(e.payload));
}

export async function onAutoKillError(
  handler: (e: AutoKillError) => void,
): Promise<UnlistenFn> {
  if (!isTauri) return async () => {};
  return await listen<AutoKillError>("auto-kill-failed", (e) => handler(e.payload));
}

export async function listEvents(
  filter?: EventFilter,
): Promise<EventRow[]> {
  if (!isTauri) return [];
  return await invoke<EventRow[]>("list_events", { filter: filter ?? null });
}

export async function countEvents(): Promise<number> {
  if (!isTauri) return 0;
  return await invoke<number>("count_events");
}

export async function clearEvents(): Promise<number> {
  if (!isTauri) return 0;
  return await invoke<number>("clear_events");
}

export async function exportEvents(
  path: string,
  format: "csv" | "json",
  filter?: EventFilter,
): Promise<number> {
  if (!isTauri) return 0;
  return await invoke<number>("export_events", {
    path,
    format,
    filter: filter ?? null,
  });
}

const DEFAULT_SETTINGS: Settings = {
  refreshMs: 2000,
  notificationsEnabled: true,
  soundEnabled: true,
  theme: "dark",
  language: "fr",
  autoKillPorts: [],
  autoKillEnabled: true,
  readOnly: false,
  pinHash: null,
};

export async function getSettings(): Promise<Settings> {
  if (!isTauri) return DEFAULT_SETTINGS;
  return await invoke<Settings>("get_settings");
}

export async function setSettings(s: Settings): Promise<Settings> {
  if (!isTauri) return s;
  return await invoke<Settings>("set_settings", { settings: s });
}

export async function firewallListBlocks(): Promise<FirewallBlock[]> {
  if (!isTauri) return [];
  return await invoke<FirewallBlock[]>("firewall_list_blocks");
}

export async function firewallBlockPort(
  port: number,
  protocol: string,
): Promise<void> {
  if (!isTauri) {
    console.log(`[mock] block ${protocol}:${port}`);
    return;
  }
  await invoke<void>("firewall_block_port", { port, protocol });
}

export async function firewallUnblockPort(
  port: number,
  protocol: string,
): Promise<void> {
  if (!isTauri) {
    console.log(`[mock] unblock ${protocol}:${port}`);
    return;
  }
  await invoke<void>("firewall_unblock_port", { port, protocol });
}

export async function isElevated(): Promise<boolean> {
  if (!isTauri) return false;
  return await invoke<boolean>("is_elevated");
}

export async function relaunchAsAdmin(): Promise<void> {
  if (!isTauri) {
    console.log("[mock] relaunch as admin");
    return;
  }
  await invoke<void>("relaunch_as_admin");
}

export async function copyToClipboard(value: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const ta = document.createElement("textarea");
  ta.value = value;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(ta);
  }
}

export { isTauri };
