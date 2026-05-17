import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSettings } from "../store/settings";
import { REFRESH_OPTIONS } from "../store/filters";
import {
  firewallListBlocks,
  firewallUnblockPort,
  isTauri,
} from "../lib/api";
import { confirmAction, showError } from "../lib/dialog";
import { hashPin } from "../lib/pin";
import type { Theme } from "../types";
import { enable, disable, isEnabled } from "@tauri-apps/plugin-autostart";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { getVersion } from "@tauri-apps/api/app";

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
  const [appVersion, setAppVersion] = useState<string>("");
  const [updateChecking, setUpdateChecking] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);

  useEffect(() => {
    if (isTauri) {
      isEnabled().then(setAutostartActive).catch(console.error);
      getVersion().then(setAppVersion).catch(console.error);
    } else {
      setAppVersion("dev");
    }
  }, []);

  const handleCheckUpdate = async () => {
    setUpdateChecking(true);
    setUpdateStatus(null);
    try {
      const update = await check();
      if (!update) {
        setUpdateStatus("✓ Vous êtes à jour.");
        return;
      }
      const ok = await confirmAction(
        `Version disponible : ${update.version}\n` +
          (update.body ? `\nNotes : ${update.body}\n` : "") +
          `\nTélécharger et installer maintenant ?`,
        {
          title: "Mise à jour disponible",
          okLabel: "Installer",
          cancelLabel: "Plus tard",
        },
      );
      if (!ok) {
        setUpdateStatus(`Version ${update.version} disponible — installation reportée.`);
        return;
      }
      setUpdateStatus("Téléchargement…");
      await update.downloadAndInstall();
      setUpdateStatus("Installation terminée — redémarrage…");
      await relaunch();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setUpdateStatus(`Erreur : ${msg}`);
      void showError("Échec de la vérification", msg);
    } finally {
      setUpdateChecking(false);
    }
  };

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

          <ReadOnlySection />

          <FirewallSection />

          <section className="setting">
            <span className="setting__label">Mises à jour</span>
            <p className="setting__hint">
              Version installée : <code>NexPort v{appVersion || "?"}</code>
            </p>
            <button
              type="button"
              className="btn btn--sm"
              onClick={handleCheckUpdate}
              disabled={!isTauri || updateChecking}
              style={{ alignSelf: "flex-start" }}
            >
              {updateChecking ? "Vérification…" : "Vérifier les mises à jour"}
            </button>
            {updateStatus && (
              <p className="setting__hint" style={{ marginTop: 8 }}>
                {updateStatus}
              </p>
            )}
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

function ReadOnlySection() {
  const readOnly = useSettings((s) => s.readOnly ?? false);
  const pinHash = useSettings((s) => s.pinHash ?? null);
  const update = useSettings((s) => s.update);

  async function toggle() {
    if (readOnly) {
      const pin = window.prompt("PIN actuel pour deverrouiller :") ?? "";
      if (!pin) return;
      const h = await hashPin(pin);
      if (h !== pinHash) {
        await showError("PIN incorrect", "Le mode lecture seule reste actif.");
        return;
      }
      update({ readOnly: false, pinHash: null });
    } else {
      const a = window.prompt("Nouveau PIN (4-8 chiffres) :") ?? "";
      if (a.length < 4 || a.length > 8) return;
      const b = window.prompt("Confirmer le PIN :") ?? "";
      if (a !== b) {
        await showError("PINs differents", "Les deux entrees ne correspondent pas.");
        return;
      }
      const h = await hashPin(a);
      update({ readOnly: true, pinHash: h });
    }
  }

  return (
    <section className="setting">
      <span className="setting__label">🔒 Mode lecture seule</span>
      <p className="setting__hint">
        Verrouille toutes les actions destructrices (kill, kill batch, blocage
        pare-feu). Le PIN protege contre les clics accidentels — pas contre
        un attaquant ayant acces a vos fichiers.
      </p>
      <button
        type="button"
        className={`btn btn--sm ${readOnly ? "btn--danger" : ""}`}
        onClick={() => void toggle()}
        style={{ alignSelf: "flex-start" }}
      >
        {readOnly ? "🔓 Deverrouiller" : "🔒 Verrouiller avec PIN"}
      </button>
    </section>
  );
}

function FirewallSection() {
  const queryClient = useQueryClient();
  const blocksQuery = useQuery({
    queryKey: ["firewall_blocks"],
    queryFn: firewallListBlocks,
    staleTime: 10_000,
  });
  const unblock = useMutation({
    mutationFn: (params: { port: number; protocol: string }) =>
      firewallUnblockPort(params.port, params.protocol),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["firewall_blocks"] }),
    onError: (e: Error) =>
      void showError("Echec deblocage", e.message || "Erreur inconnue."),
  });

  const blocks = blocksQuery.data ?? [];

  return (
    <section className="setting">
      <span className="setting__label">🛡 Pare-feu Windows</span>
      <p className="setting__hint">
        Ports bloques en entree via <code>netsh advfirewall</code>. Necessite
        des droits administrateur pour ajouter ou supprimer une regle.
      </p>
      {blocks.length === 0 ? (
        <p className="muted" style={{ fontSize: 12 }}>
          Aucun port bloque pour le moment. Utilise le bouton 🛡 dans le
          tableau des ports.
        </p>
      ) : (
        <div className="setting__chips">
          {blocks.map((b) => (
            <span key={`${b.protocol}:${b.port}`} className="chip chip--active">
              {b.protocol} {b.port}
              <button
                type="button"
                className="chip__remove"
                disabled={unblock.isPending}
                onClick={() =>
                  unblock.mutate({ port: b.port, protocol: b.protocol })
                }
                title="Debloquer"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
