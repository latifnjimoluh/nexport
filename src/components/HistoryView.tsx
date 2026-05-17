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
import { useTranslation } from "../lib/i18n";
import type { EventFilter, EventKind, EventRow } from "../types";

interface Props {
  onNotify?: (msg: string) => void;
}

export function HistoryView({ onNotify }: Props) {
  const { t, language } = useTranslation();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<"" | EventKind>("");
  const [portInput, setPortInput] = useState("");
  const [limit, setLimit] = useState<number>(500);

  const KIND_OPTIONS: { value: "" | EventKind; label: string }[] = useMemo(() => [
    { value: "", label: t("all") },
    { value: "opened", label: language === "fr" ? "Ouvert" : "Opened" },
    { value: "closed", label: language === "fr" ? "Fermé" : "Closed" },
    { value: "killed", label: language === "fr" ? "Tué" : "Killed" },
  ], [t, language]);

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
      onNotify?.(`${n} ` + (language === "fr" ? "événements supprimés" : "events cleared"));
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (e: Error) =>
      void showError(language === "fr" ? "Échec du clear" : "Clear failed", e.message || "Unknown error."),
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
      onNotify?.((language === "fr" ? "Export terminé" : "Export finished") + ` : ${res.n} lines → ${res.path}`);
    },
    onError: (e: Error) =>
      void showError(language === "fr" ? "Échec de l'export" : "Export failed", e.message || "Unknown error."),
  });

  async function handleClear() {
    const ok = await confirmAction(
      language === "fr" ? "Supprimer tout l'historique local ? Cette action est irréversible." : "Delete all local history? This action is irreversible.",
      {
        title: language === "fr" ? "Vider l'historique" : "Clear history",
        destructive: true,
        okLabel: language === "fr" ? "Vider" : "Clear",
        cancelLabel: t("cancel"),
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
          <span className="toolbar__select-label">{language === "fr" ? "Limite" : "Limit"}</span>
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

        <span className="toolbar__count">{events.length} {language === "fr" ? "lignes" : "lines"}</span>

        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={() => query.refetch()}
          disabled={query.isFetching}
        >
          {query.isFetching ? "…" : t("refresh")}
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
          {language === "fr" ? "Vider" : "Clear"}
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
            ? (language === "fr" ? "Aucun événement. Laisse l'app tourner un peu, ou épingle des ports." : "No events. Let the app run for a while, or pin some ports.")
            : t("browser_mode")}
        </div>
      ) : (
        <div className="table-wrap">
          <table className="ports">
            <thead>
              <tr>
                <th>{language === "fr" ? "Horodatage" : "Timestamp"}</th>
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
                    {e.process ?? <span className="muted">{language === "fr" ? "inconnu" : "unknown"}</span>}
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
