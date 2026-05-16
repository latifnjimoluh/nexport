export type Protocol = "TCP" | "UDP";
export type Family = "IPv4" | "IPv6";
export type ConnState =
  | "LISTEN"
  | "ESTABLISHED"
  | "TIME_WAIT"
  | "CLOSE_WAIT"
  | "SYN_SENT"
  | "SYN_RECV"
  | "FIN_WAIT_1"
  | "FIN_WAIT_2"
  | "CLOSING"
  | "LAST_ACK"
  | "CLOSED"
  | "UNKNOWN";

export interface PortEvent {
  kind: "opened" | "closed";
  port: number;
  protocol: Protocol;
  pid: number | null;
  processName: string | null;
  ts: number;
}

export interface AutoKillError {
  port: number;
  protocol: Protocol;
  pid: number;
  reason: string;
}

export type EventKind = "opened" | "closed" | "killed";

export interface EventRow {
  id: number;
  ts: number;
  kind: string;
  port: number;
  protocol: string;
  pid: number | null;
  process: string | null;
}

export interface EventFilter {
  kind?: string | null;
  port?: number | null;
  sinceTs?: number | null;
  untilTs?: number | null;
  limit?: number | null;
}

export type Theme = "dark" | "light";

export interface Settings {
  refreshMs: number;
  notificationsEnabled: boolean;
  theme: Theme;
  autoKillPorts: number[];
  autoKillEnabled: boolean;
}

export type RiskLevel = "SAFE" | "WARNING" | "DANGER";

export interface RiskInfo {
  level: RiskLevel;
  reason: string | null;
}

export interface PortRow {
  id: string;
  port: number;
  protocol: Protocol;
  family: Family;
  state: ConnState;
  pid: number | null;
  processName: string | null;
  processPath: string | null;
  processCwd: string | null;
  remoteAddr: string | null;
  requiresAdmin: boolean;
  risk: RiskInfo;
  openedAt: number;
}
