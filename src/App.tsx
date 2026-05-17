import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HistoryView } from "./components/HistoryView";
import { SettingsPanel } from "./components/SettingsPanel";
import { Toolbar } from "./components/Toolbar";
import { PortTable } from "./components/PortTable";
import {
  isElevated,
  isTauri,
  killProcess,
  listPorts,
  onAutoKillError,
  onPortEvent,
  relaunchAsAdmin,
} from "./lib/api";
import { confirmAction, showError } from "./lib/dialog";
import { notify } from "./lib/notify";
import { killCliCommand } from "./lib/platform";
import { useFavorites } from "./store/favorites";
import { REFRESH_OPTIONS, useFilters } from "./store/filters";
import { useSettings } from "./store/settings";
import type { PortRow } from "./types";

export default function App() {
  const search = useFilters((s) => s.search);
  const setSearch = useFilters((s) => s.setSearch);
  const protocolFilter = useFilters((s) => s.protocolFilter);
  const setProtocolFilter = useFilters((s) => s.setProtocolFilter);
  const favoritesOnly = useFilters((s) => s.favoritesOnly);
  const setFavoritesOnly = useFilters((s) => s.setFavoritesOnly);

  const refreshMs = useSettings((s) => s.refreshMs);
  const notificationsEnabled = useSettings((s) => s.notificationsEnabled);
  const theme = useSettings((s) => s.theme);
  const hydrateSettings = useSettings((s) => s.hydrate);
  const updateSettings = useSettings((s) => s.update);
  const notificationsEnabledRef = useRef(notificationsEnabled);
  useEffect(() => {
    notificationsEnabledRef.current = notificationsEnabled;
  }, [notificationsEnabled]);

  const favorites = useFavorites((s) => s.favorites);
  const hydrateFavorites = useFavorites((s) => s.hydrate);
  const favSet = useMemo(() => new Set(favorites), [favorites]);

  // Désactive le filtre favoris s'il n'y en a plus
  useEffect(() => {
    if (favorites.length === 0 && favoritesOnly) {
      setFavoritesOnly(false);
    }
  }, [favorites.length, favoritesOnly, setFavoritesOnly]);

  const favSetRef = useRef(favSet);
  useEffect(() => {
    favSetRef.current = favSet;
  }, [favSet]);

  const queryClient = useQueryClient();
  const [toast, setToast] = useState<string | null>(null);
  const [view, setView] = useState<"ports" | "history">("ports");
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(id);
  }, [toast]);

  // Charge les favoris depuis SQLite au démarrage.
  useEffect(() => {
    void hydrateFavorites();
  }, [hydrateFavorites]);

  // Charge les settings (refreshMs / notifications / thème) depuis settings.json.
  useEffect(() => {
    void hydrateSettings();
  }, [hydrateSettings]);

  // Applique le thème sur <html>.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Watcher: écoute "port-event" et notifie pour les ports favoris.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let active = true;
    void onPortEvent((evt) => {
      if (!favSetRef.current.has(evt.port)) return;
      queryClient.invalidateQueries({ queryKey: ["ports"] });
      if (!notificationsEnabledRef.current) return;
      if (evt.kind === "opened") {
        const who = evt.processName ? ` (${evt.processName})` : "";
        void notify("Port favori ouvert", `${evt.protocol} ${evt.port}${who}`);
      } else {
        void notify("Port favori fermé", `${evt.protocol} ${evt.port}`);
      }
    }).then((un) => {
      if (active) unlisten = un;
      else un();
    });
    return () => {
      active = false;
      unlisten?.();
    };
  }, [queryClient]);

  // Watcher: écoute les échecs Auto-Kill (souvent par manque d'admin) et
  // alerte l'utilisateur. Le backend dédoublonne déjà par port.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let active = true;
    void onAutoKillError((e) => {
      setToast(`⚠ Auto-Kill ${e.protocol} ${e.port} échoué : ${e.reason}`);
    }).then((un) => {
      if (active) unlisten = un;
      else un();
    });
    return () => {
      active = false;
      unlisten?.();
    };
  }, []);

  const query = useQuery<PortRow[], Error>({
    queryKey: ["ports"],
    queryFn: listPorts,
    refetchInterval: refreshMs > 0 ? refreshMs : false,
  });

  const elevatedQuery = useQuery<boolean, Error>({
    queryKey: ["is_elevated"],
    queryFn: isElevated,
    staleTime: Infinity,
  });
  const elevated = elevatedQuery.data ?? false;

  const elevateMutation = useMutation({
    mutationFn: relaunchAsAdmin,
    onError: (e: Error) =>
      void showError(
        "Impossible de relancer en admin",
        e.message || "Erreur inconnue.",
      ),
  });

  async function handleElevate() {
    const ok = await confirmAction(
      "L'application va se relancer avec les droits administrateur. " +
        "Une fenêtre de confirmation système va s'afficher.",
      {
        title: "Relancer en administrateur",
        okLabel: "Relancer",
        cancelLabel: "Annuler",
      },
    );
    if (!ok) return;
    elevateMutation.mutate();
  }

  const killMutation = useMutation({
    mutationFn: (pid: number) => killProcess(pid),
    onSuccess: (_data, pid) => {
      setToast(`✓ ${killCliCommand(pid)}`);
      queryClient.invalidateQueries({ queryKey: ["ports"] });
    },
    onError: (e: Error) =>
      void showError("Échec du kill", e.message || "Erreur inconnue."),
  });

  const rows = query.data ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    
    // Analyse de la recherche pour les plages de ports (ex: 3000-4000)
    let range: [number, number] | null = null;
    if (/^\d+-\d+$/.test(q)) {
      const parts = q.split("-").map(Number);
      range = [Math.min(...parts), Math.max(...parts)];
    }

    return rows.filter((r) => {
      if (favoritesOnly && !favSet.has(r.port)) return false;
      if (protocolFilter !== "ALL" && r.protocol !== protocolFilter)
        return false;
      
      if (!q) return true;

      // Si une plage est détectée
      if (range) {
        return r.port >= range[0] && r.port <= range[1];
      }

      return (
        String(r.port).includes(q) ||
        String(r.pid ?? "").includes(q) ||
        (r.processName?.toLowerCase().includes(q) ?? false) ||
        (r.processPath?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [rows, search, protocolFilter, favoritesOnly, favSet]);

  async function handleKill(row: PortRow) {
    if (row.pid === null) return;
    const cli = killCliCommand(row.pid);
    const ok = await confirmAction(
      `Tuer le process ${row.processName ?? "?"} (PID ${row.pid}) ` +
        `qui occupe le port ${row.port} ?\n\n` +
        `Équivalent en ligne de commande :\n${cli}`,
      {
        title: "Tuer le process",
        destructive: true,
        okLabel: "Tuer",
        cancelLabel: "Annuler",
      },
    );
    if (!ok) return;
    killMutation.mutate(row.pid);
  }

  const error = query.error;
  const lastUpdated = query.dataUpdatedAt
    ? new Date(query.dataUpdatedAt)
    : null;

  return (
    <div className="app">
      <header className="app__header">
        <h1>NexPort</h1>
        <span className="app__subtitle">
          Ports ouverts &middot; processus &middot; actions rapides
        </span>
        <span className={`pill ${isTauri ? "pill--ok" : "pill--warn"}`}>
          {isTauri ? "backend Rust" : "mode mock (navigateur)"}
        </span>
        <span
          className={`pill ${elevated ? "pill--admin" : "pill--standard"}`}
          title={
            elevated
              ? "L'app tourne avec les droits administrateur."
              : "L'app tourne en mode standard. Certains kills peuvent échouer."
          }
        >
          {elevated ? "mode admin" : "mode standard"}
        </span>
        {isTauri && !elevated && (
          <button
            type="button"
            className="btn btn--sm"
            onClick={handleElevate}
            disabled={elevateMutation.isPending}
          >
            {elevateMutation.isPending ? "…" : "Relancer en admin"}
          </button>
        )}
        <button
          type="button"
          className="btn btn--sm"
          onClick={() => setSettingsOpen(true)}
          title="Réglages"
        >
          ⚙
        </button>
      </header>

      <nav className="tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={view === "ports"}
          className={`tab ${view === "ports" ? "tab--active" : ""}`}
          onClick={() => setView("ports")}
        >
          Ports
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "history"}
          className={`tab ${view === "history" ? "tab--active" : ""}`}
          onClick={() => setView("history")}
        >
          Historique
        </button>
      </nav>

      {view === "ports" ? (
        <>
          <Toolbar
            search={search}
            onSearchChange={setSearch}
            protocolFilter={protocolFilter}
            onProtocolChange={setProtocolFilter}
            onRefresh={() => query.refetch()}
            loading={query.isFetching}
            count={filtered.length}
            refreshMs={refreshMs}
            onRefreshMsChange={(v) => updateSettings({ refreshMs: v })}
            refreshOptions={REFRESH_OPTIONS}
            favoritesOnly={favoritesOnly}
            onFavoritesOnlyChange={setFavoritesOnly}
            favoritesCount={favorites.length}
          />

          {error && (
            <div className="error" role="alert">
              {error.message}
            </div>
          )}

          <main className="app__main">
            <PortTable
              rows={filtered}
              onKill={handleKill}
              onNotify={setToast}
            />
          </main>
        </>
      ) : (
        <main className="app__main">
          <HistoryView onNotify={setToast} />
        </main>
      )}

      <footer className="app__footer">
        v0.6.2 &middot;
        {lastUpdated
          ? ` dernier scan ${lastUpdated.toLocaleTimeString()}`
          : " en attente du premier scan…"}
        {refreshMs > 0 && ` · auto ${refreshMs / 1000}s`}
      </footer>

      {toast && <div className="toast">{toast}</div>}

      {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
