import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { save } from "@tauri-apps/plugin-dialog";
import {
  clearEvents,
  exportEvents,
  isTauri,
  listEvents,
} from "../lib/api";
import { confirmAction, showError } from "../lib/dialog";
import type { EventFilter, EventKind, EventRow } from "../types";

const KIND_OPTIONS: { value: "" | EventKind; label: string }[] = [
  { value: "", label: "Tous types" },
  { value: "opened", label: "Ouvert" },
  { value: "closed", label: "Fermé" },
  { value: "killed", label: "Tué" },
];

interface Props {
  onNotify?: (msg: string) => void;
}

export function HistoryView({ onNotify }: Props) {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<"" | EventKind>("");
  const [portInput, setPortInput] = useState("");
  const [limit, setLimit] = useState<number>(500);

  const filter: EventFilter = useMemo(() => {
    const p = parseInt(portInput, 10);
    return {
      kind: kind || null,
      port: Number.isFinite(p) && p > 0 ? p : null,
      limit,
    };
  }, [kind, portInput, limit]);

  const query = useQuery<EventRow[], Error>({
    queryKey: ["events", filter],
    queryFn: () => listEvents(filter),
    placeholderData: (prev) => prev,
  });

  const clearMutation = useMutation({
    mutationFn: clearEvents,
    onSuccess: (n) => {
      onNotify?.(`${n} événements supprimés`);
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (e: Error) =>
      void showError("Échec du clear", e.message || "Erreur inconnue."),
  });

  const exportMutation = useMutation({
    mutationFn: async (format: "csv" | "json") => {
      const ext = format;
      const path = await save({
        title: format === "csv" ? "Export CSV" : "Export JSON",
        defaultPath: `nexport_events_${Date.now()}.${ext}`,
        filters: [
          { name: format.toUpperCase(), extensions: [ext] },
        ],
      });
      if (!path) return null;
      const n = await exportEvents(path, format, filter);
      return { path, n };
    },
    onSuccess: (res) => {
      if (!res) return;
      onNotify?.(`Export terminé : ${res.n} lignes → ${res.path}`);
    },
    onError: (e: Error) =>
      void showError("Échec de l'export", e.message || "Erreur inconnue."),
  });

  async function handleClear() {
    const ok = await confirmAction(
      "Supprimer tout l'historique local ? Cette action est irréversible.",
      {
        title: "Vider l'historique",
        destructive: true,
        okLabel: "Vider",
        cancelLabel: "Annuler",
      },
    );
    if (!ok) return;
    clearMutation.mutate();
  }

  const events = query.data ?? [];

  return (
    <>
      <div className="toolbar">
        <label className="toolbar__select">
          <span className="toolbar__select-label">Type</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as "" | EventKind)}
          >
            {KIND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <input
          className="toolbar__search"
          type="number"
          inputMode="numeric"
          min={1}
          max={65535}
          placeholder="Port…"
          value={portInput}
          onChange={(e) => setPortInput(e.target.value)}
          style={{ maxWidth: 140 }}
        />

        <label className="toolbar__select">
          <span className="toolbar__select-label">Limite</span>
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            {[100, 500, 1000, 5000].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>

        <span className="toolbar__count">{events.length} lignes</span>

        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
        >
          {query.isFetching ? "…" : "Rafraîchir"}
        </button>
        <button
          type="button"
          className="btn btn--sm"
          onClick={() => exportMutation.mutate("csv")}
          disabled={!isTauri || exportMutation.isPending || events.length === 0}
        >
          CSV
        </button>
        <button
          type="button"
          className="btn btn--sm"
          onClick={() => exportMutation.mutate("json")}
          disabled={!isTauri || exportMutation.isPending || events.length === 0}
        >
          JSON
        </button>
        <button
          type="button"
          className="btn btn--danger btn--sm"
          onClick={handleClear}
          disabled={!isTauri || clearMutation.isPending || events.length === 0}
        >
          Vider
        </button>
      </div>

      {query.error && (
        <div className="error" role="alert">
          {query.error.message}
        </div>
      )}

      {events.length === 0 ? (
        <div className="empty">
          {isTauri
            ? "Aucun événement. Laisse l'app tourner un peu, ou épingle des ports."
            : "Historique indisponible en mode navigateur (SQLite est côté Rust)."}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="ports">
            <thead>
              <tr>
                <th>Horodatage</th>
                <th>Type</th>
                <th>Port</th>
                <th>Proto</th>
                <th>PID</th>
                <th>Process</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td className="mono">{fmtTs(e.ts)}</td>
                  <td>
                    <span className={`state state--${e.kind}`}>{e.kind}</span>
                  </td>
                  <td className="mono">{e.port}</td>
                  <td>{e.protocol}</td>
                  <td className="mono">{e.pid ?? "—"}</td>
                  <td>
                    {e.process ?? <span className="muted">inconnu</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function fmtTs(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}
