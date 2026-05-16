import { useEffect, useState } from "react";
import { useSettings } from "../store/settings";
import { REFRESH_OPTIONS } from "../store/filters";
import { isTauri } from "../lib/api";
import type { Theme } from "../types";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";

interface Props {
  onClose: () => void;
}

const THEMES: { value: Theme; label: string }[] = [
  { value: "dark", label: "Sombre" },
  { value: "light", label: "Clair" },
];

export function SettingsPanel({ onClose }: Props) {
  const refreshMs = useSettings((s) => s.refreshMs);
  const notificationsEnabled = useSettings((s) => s.notificationsEnabled);
  const theme = useSettings((s) => s.theme);
  const autoKillPorts = useSettings((s) => s.autoKillPorts ?? []);
  const autoKillEnabled = useSettings((s) => s.autoKillEnabled ?? true);
  const update = useSettings((s) => s.update);

  const [newPort, setNewPort] = useState("");
  const [autostartActive, setAutostartActive] = useState(false);

  useEffect(() => {
    if (isTauri) {
      isEnabled().then(setAutostartActive).catch(console.error);
    }
  }, []);

  const handleToggleAutostart = async () => {
    try {
      if (autostartActive) {
        await disable();
        setAutostartActive(false);
      } else {
        await enable();
        setAutostartActive(true);
      }
    } catch (e) {
      console.error("Erreur autostart:", e);
    }
  };

  const handleAddPort = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(newPort, 10);
    if (!isNaN(p) && p > 0 && p < 65536 && !autoKillPorts.includes(p)) {
      update({ autoKillPorts: [...autoKillPorts, p] });
      setNewPort("");
    }
  };

  const handleRemovePort = (port: number) => {
    update({ autoKillPorts: autoKillPorts.filter((p) => p !== port) });
  };

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal__header">
          <h2>Réglages</h2>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={onClose}
            aria-label="Fermer"
          >
            ✕
          </button>
        </header>

        <div className="modal__body">
          <section className="setting">
            <label className="setting__label" htmlFor="set-refresh">
              Intervalle d'auto-refresh
            </label>
            <select
              id="set-refresh"
              value={refreshMs}
              onChange={(e) => update({ refreshMs: Number(e.target.value) })}
            >
              {REFRESH_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="setting__hint">
              Le watcher Rust détecte aussi les changements en plus du polling.
              Tu peux passer à <code>Off</code> sans perdre les notifications.
            </p>
          </section>

          <section className="setting">
            <label className="setting__label">
              <input
                type="checkbox"
                checked={notificationsEnabled}
                onChange={(e) =>
                  update({ notificationsEnabled: e.target.checked })
                }
              />
              Notifications natives pour les ports favoris
            </label>
            <p className="setting__hint">
              Coupe tous les toasts OS quand un port favori s'ouvre ou se ferme.
            </p>
          </section>

          <section className="setting">
            <div className="setting__header-row">
              <label className="setting__label">⚡ Auto-Kill (Force Libération)</label>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={autoKillEnabled}
                  onChange={(e) => update({ autoKillEnabled: e.target.checked })}
                />
                <span className="switch__label">{autoKillEnabled ? "ON" : "OFF"}</span>
              </label>
            </div>
            <p className="setting__hint">
              Tuer automatiquement tout processus qui tente d'utiliser ces ports.
            </p>
            <div className={!autoKillEnabled ? "setting--dim" : ""}>
              <form onSubmit={handleAddPort} className="setting__row">
                <input
                  type="number"
                  placeholder="Ex: 8080"
                  value={newPort}
                  onChange={(e) => setNewPort(e.target.value)}
                  min="1"
                  max="65535"
                  disabled={!autoKillEnabled}
                />
                <button type="submit" className="btn btn--sm" disabled={!autoKillEnabled}>
                  Ajouter
                </button>
              </form>
              {autoKillPorts.length > 0 && (
                <div className="setting__chips">
                  {autoKillPorts.map((p) => (
                    <span key={p} className={`chip ${autoKillEnabled ? "chip--active" : ""}`}>
                      {p}
                      <button 
                        type="button" 
                        className="chip__remove" 
                        onClick={() => handleRemovePort(p)}
                        disabled={!autoKillEnabled}
                      >✕</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section className="setting">
            <span className="setting__label">Thème</span>
            <div className="toolbar__group">
              {THEMES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  className={`chip ${theme === t.value ? "chip--active" : ""}`}
                  onClick={() => update({ theme: t.value })}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </section>

          <section className="setting">
            <label className="setting__label">
              <input
                type="checkbox"
                checked={autostartActive}
                onChange={handleToggleAutostart}
                disabled={!isTauri}
              />
              Démarrer avec Windows
            </label>
            <p className="setting__hint">
              Lance automatiquement <code>NexPort</code> à l'ouverture de votre session.
            </p>
          </section>
        </div>

        <footer className="modal__footer">
          {isTauri ? (
            <span className="muted">
              Sauvegardé dans <code>%APPDATA%\dev.nexport.desktop\settings.json</code>
            </span>
          ) : (
            <span className="muted">
              Mode navigateur — préférences en localStorage uniquement
            </span>
          )}
          <button type="button" className="btn btn--primary" onClick={onClose}>
            Fermer
          </button>
        </footer>
      </div>
    </div>
  );
}
