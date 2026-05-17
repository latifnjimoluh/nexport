// Parser de recherche pour la toolbar. Tokens supportes :
//
//   port:3000           port exact
//   port:>3000          port superieur a
//   port:<3000          port inferieur a
//   port:>=3000         port superieur ou egal
//   port:<=3000         port inferieur ou egal
//   port:3000-4000      plage (legacy : ecrire 3000-4000 sans prefixe marche aussi)
//   pid:1234            PID exact
//   name:node           sous-chaine du nom de process (insensible casse)
//   path:nodejs         sous-chaine du chemin exe
//   state:LISTEN        etat de la connexion (LISTEN, ESTABLISHED, ...)
//   proto:TCP           protocole (TCP ou UDP)
//   fav:true            uniquement les favoris (ou fav:false)
//
// Tokens combines avec ET implicite. Un token sans prefixe se rabat sur
// l'ancienne recherche "fuzzy" (port, pid, name, path).

import type { PortRow } from "../types";

type NumOp = "eq" | "lt" | "gt" | "gte" | "lte";

type Token =
  | { type: "port"; op: NumOp | "range"; value: number; max?: number }
  | { type: "pid"; value: number }
  | { type: "name"; value: string }
  | { type: "path"; value: string }
  | { type: "state"; value: string }
  | { type: "proto"; value: "TCP" | "UDP" }
  | { type: "fav"; value: boolean }
  | { type: "plain"; value: string };

const KEYS = new Set(["port", "pid", "name", "path", "state", "proto", "fav"]);

export interface ParsedQuery {
  tokens: Token[];
  raw: string;
}

export function parseQuery(input: string): ParsedQuery {
  const tokens: Token[] = [];
  const parts = input.trim().split(/\s+/).filter(Boolean);

  for (const part of parts) {
    // Legacy : "3000-4000" sans prefixe = plage de ports
    if (/^\d+-\d+$/.test(part)) {
      const [a, b] = part.split("-").map(Number);
      tokens.push({
        type: "port",
        op: "range",
        value: Math.min(a, b),
        max: Math.max(a, b),
      });
      continue;
    }

    const m = part.match(/^([a-z]+):(.+)$/i);
    if (!m || !KEYS.has(m[1].toLowerCase())) {
      tokens.push({ type: "plain", value: part.toLowerCase() });
      continue;
    }

    const key = m[1].toLowerCase();
    const val = m[2];

    if (key === "port") {
      if (val.includes("-") && /^\d+-\d+$/.test(val)) {
        const [a, b] = val.split("-").map(Number);
        tokens.push({
          type: "port",
          op: "range",
          value: Math.min(a, b),
          max: Math.max(a, b),
        });
      } else if (val.startsWith(">=")) {
        const n = Number(val.slice(2));
        if (Number.isFinite(n)) tokens.push({ type: "port", op: "gte", value: n });
      } else if (val.startsWith("<=")) {
        const n = Number(val.slice(2));
        if (Number.isFinite(n)) tokens.push({ type: "port", op: "lte", value: n });
      } else if (val.startsWith(">")) {
        const n = Number(val.slice(1));
        if (Number.isFinite(n)) tokens.push({ type: "port", op: "gt", value: n });
      } else if (val.startsWith("<")) {
        const n = Number(val.slice(1));
        if (Number.isFinite(n)) tokens.push({ type: "port", op: "lt", value: n });
      } else {
        const n = Number(val);
        if (Number.isFinite(n)) tokens.push({ type: "port", op: "eq", value: n });
      }
    } else if (key === "pid") {
      const n = Number(val);
      if (Number.isFinite(n)) tokens.push({ type: "pid", value: n });
    } else if (key === "name") {
      tokens.push({ type: "name", value: val.toLowerCase() });
    } else if (key === "path") {
      tokens.push({ type: "path", value: val.toLowerCase() });
    } else if (key === "state") {
      tokens.push({ type: "state", value: val.toUpperCase() });
    } else if (key === "proto") {
      const up = val.toUpperCase();
      if (up === "TCP" || up === "UDP") tokens.push({ type: "proto", value: up });
    } else if (key === "fav") {
      tokens.push({
        type: "fav",
        value: val.toLowerCase() === "true" || val === "1",
      });
    }
  }

  return { tokens, raw: input };
}

export function matchesQuery(
  row: PortRow,
  parsed: ParsedQuery,
  isFav: (port: number) => boolean,
): boolean {
  if (parsed.tokens.length === 0) return true;
  return parsed.tokens.every((t) => matchToken(row, t, isFav));
}

function matchToken(
  row: PortRow,
  t: Token,
  isFav: (port: number) => boolean,
): boolean {
  switch (t.type) {
    case "port":
      switch (t.op) {
        case "eq":
          return row.port === t.value;
        case "lt":
          return row.port < t.value;
        case "gt":
          return row.port > t.value;
        case "lte":
          return row.port <= t.value;
        case "gte":
          return row.port >= t.value;
        case "range":
          return row.port >= t.value && row.port <= (t.max ?? t.value);
      }
      return false;
    case "pid":
      return row.pid === t.value;
    case "name":
      return row.processName?.toLowerCase().includes(t.value) ?? false;
    case "path":
      return row.processPath?.toLowerCase().includes(t.value) ?? false;
    case "state":
      return row.state === t.value;
    case "proto":
      return row.protocol === t.value;
    case "fav":
      return isFav(row.port) === t.value;
    case "plain": {
      const v = t.value;
      return (
        String(row.port).includes(v) ||
        String(row.pid ?? "").includes(v) ||
        (row.processName?.toLowerCase().includes(v) ?? false) ||
        (row.processPath?.toLowerCase().includes(v) ?? false)
      );
    }
  }
}
