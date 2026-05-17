import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSettings } from "../store/settings";
import { REFRESH_OPTIONS } from "../store/filters";
import { sound } from "../lib/sound";
import { useTranslation } from "../lib/i18n";
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

const THEMES: { value: Theme; label: Record<string, string> }[] = [
  { value: "dark", label: { fr: "Sombre", en: "Dark" } },
  { value: "light", label: { fr: "Clair", en: "Light" } },
];

const LANGUAGES = [
  { value: "fr", label: "Français" },
  { value: "en", label: "English" },
];

export function SettingsPanel({ onClose }: Props) {
  const { t, language } = useTranslation();
  const refreshMs = useSettings((s) => s.refreshMs);
  const notificationsEnabled = useSettings((s) => s.notificationsEnabled);
  const soundEnabled = useSettings((s) => s.soundEnabled);
  const theme = useSettings((s) => s.theme);
  const currentLanguage = useSettings((s) => s.language);
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
      const updateResult = await check();
      if (!updateResult) {
        setUpdateStatus("✓ " + (language === "fr" ? "Vous êtes à jour." : "You are up to date."));
        return;
      }
      const ok = await confirmAction(
        `Version disponible : ${updateResult.version}\n` +
          (updateResult.body ? `\nNotes : ${updateResult.body}\n` : "") +
          `\nTélécharger et installer maintenant ?`,
        {
          title: t("updates"),
          okLabel: language === "fr" ? "Installer" : "Install",
          cancelLabel: language === "fr" ? "Plus tard" : "Later",
        },
      );
      if (!ok) {
        setUpdateStatus(`Version ${updateResult.version} available — installation postponed.`);
        return;
      }
      setUpdateStatus(language === "fr" ? "Téléchargement…" : "Downloading...");
      await updateResult.downloadAndInstall();
      setUpdateStatus(language === "fr" ? "Installation terminée — redémarrage…" : "Installation finished — restarting...");
      await relaunch();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setUpdateStatus(`Erreur : ${msg}`);
      void showError(language === "fr" ? "Échec de la vérification" : "Check failed", msg);
    } finally {
      setUpdateChecking(false);
    }
  };

  const handleToggleAutostart = async () => {
    try {
      if (autostartActive) {
        await disable();
        setAutostartActive(false);
        sound.toggleOff();
      } else {
        await enable();
        setAutostartActive(true);
        sound.toggleOn();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      void showError("Erreur Autostart", "Impossible de modifier le démarrage automatique : " + msg);
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
          <h2>{t("settings")}</h2>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={onClose}
            aria-label={t("close")}
          >
            ✕
          </button>
        </header>

        <div className="modal__body">
          <section className="setting">
            <label className="setting__label" htmlFor="set-refresh">
              {t("refresh_interval")}
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
              {language === "fr" 
                ? "Le watcher Rust détecte aussi les changements en plus du polling." 
                : "Rust watcher also detects changes in addition to polling."}
            </p>
          </section>

          <section className="setting">
            <label className="setting__label">
              <input
                type="checkbox"
                checked={notificationsEnabled}
                onChange={(e) => {
                  if (e.target.checked) sound.toggleOn();
                  else sound.toggleOff();
                  update({ notificationsEnabled: e.target.checked });
                }}
              />
              {t("notifications")}
            </label>
          </section>

          <section className="setting">
            <label className="setting__label">
              <input
                type="checkbox"
                checked={soundEnabled}
                onChange={(e) => {
                  if (e.target.checked) {
                    update({ soundEnabled: true });
                    sound.toggleOn();
                  } else {
                    sound.toggleOff();
                    update({ soundEnabled: false });
                  }
                }}
              />
              {t("sounds")}
            </label>
          </section>

          <section className="setting">
            <div className="setting__header-row">
              <label className="setting__label">⚡ Auto-Kill</label>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={autoKillEnabled}
                  onChange={(e) => {
                    if (e.target.checked) sound.toggleOn();
                    else sound.toggleOff();
                    update({ autoKillEnabled: e.target.checked });
                  }}
                />
                <span className="switch__label">{autoKillEnabled ? "ON" : "OFF"}</span>
              </label>
            </div>
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
                  {language === "fr" ? "Ajouter" : "Add"}
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
            <span className="setting__label">{t("theme")}</span>
            <div className="toolbar__group">
              {THEMES.map((t_item) => (
                <button
                  key={t_item.value}
                  type="button"
                  className={`chip ${theme === t_item.value ? "chip--active" : ""}`}
                  onClick={() => {
                    sound.click();
                    update({ theme: t_item.value });
                  }}
                >
                  {t_item.label[language]}
                </button>
              ))}
            </div>
          </section>

          <section className="setting">
            <span className="setting__label">{t("language")}</span>
            <div className="toolbar__group">
              {LANGUAGES.map((l) => (
                <button
                  key={l.value}
                  type="button"
                  className={`chip ${currentLanguage === l.value ? "chip--active" : ""}`}
                  onClick={() => {
                    sound.click();
                    update({ language: l.value as "fr" | "en" });
                  }}
                >
                  {l.label}
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
              {t("autostart")}
            </label>
          </section>

          <ReadOnlySection />

          <FirewallSection />

          <section className="setting">
            <span className="setting__label">{t("updates")}</span>
            <p className="setting__hint">
              {t("version")} : <code>NexPort v{appVersion || "?"}</code>
            </p>
            <button
              type="button"
              className="btn btn--sm"
              onClick={handleCheckUpdate}
              disabled={!isTauri || updateChecking}
              style={{ alignSelf: "flex-start" }}
            >
              {updateChecking ? "..." : t("check_updates")}
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
              {t("save_location")} <code>%APPDATA%\dev.nexport.desktop\settings.json</code>
            </span>
          ) : (
            <span className="muted">
              {t("browser_mode")}
            </span>
          )}
          <button type="button" className="btn btn--primary" onClick={onClose}>
            {t("close")}
          </button>
        </footer>
      </div>
    </div>
  );
}

function ReadOnlySection() {
  const { t, language } = useTranslation();
  const readOnly = useSettings((s) => s.readOnly ?? false);
  const pinHash = useSettings((s) => s.pinHash ?? null);
  const update = useSettings((s) => s.update);

  async function toggle() {
    if (readOnly) {
      const pin = window.prompt(language === "fr" ? "PIN actuel pour déverrouiller :" : "Current PIN to unlock:") ?? "";
      if (!pin) return;
      const h = await hashPin(pin);
      if (h !== pinHash) {
        await showError(language === "fr" ? "PIN incorrect" : "Incorrect PIN", language === "fr" ? "Le mode lecture seule reste actif." : "Read only mode remains active.");
        return;
      }
      update({ readOnly: false, pinHash: null });
    } else {
      const a = window.prompt(language === "fr" ? "Nouveau PIN (4-8 chiffres) :" : "New PIN (4-8 digits):") ?? "";
      if (a.length < 4 || a.length > 8) return;
      const b = window.prompt(language === "fr" ? "Confirmer le PIN :" : "Confirm PIN:") ?? "";
      if (a !== b) {
        await showError(language === "fr" ? "PINs différents" : "PINs do not match", language === "fr" ? "Les deux entrées ne correspondent pas." : "The two entries do not match.");
        return;
      }
      const h = await hashPin(a);
      update({ readOnly: true, pinHash: h });
    }
  }

  return (
    <section className="setting">
      <span className="setting__label">🔒 {t("read_only")}</span>
      <p className="setting__hint">
        {language === "fr" 
          ? "Verrouille toutes les actions destructrices (kill, kill batch, blocage pare-feu)." 
          : "Locks all destructive actions (kill, bulk kill, firewall block)."}
      </p>
      <button
        type="button"
        className={`btn btn--sm ${readOnly ? "btn--danger" : ""}`}
        onClick={() => {
          sound.click();
          void toggle();
        }}
        style={{ alignSelf: "flex-start" }}
      >
        {readOnly ? (language === "fr" ? "🔓 Déverrouiller" : "🔓 Unlock") : (language === "fr" ? "🔒 Verrouiller avec PIN" : "🔒 Lock with PIN")}
      </button>
    </section>
  );
}

function FirewallSection() {
  const { language } = useTranslation();
  const queryClient = useQueryClient();
  const blocksQuery = useQuery({
    queryKey: ["firewall_blocks"],
    queryFn: firewallListBlocks,
    staleTime: 10_000,
  });
  const unblock = useMutation({
    mutationFn: (params: { port: number; protocol: string }) =>
      firewallUnblockPort(params.port, params.protocol),
    onSuccess: () => {
      sound.success();
      queryClient.invalidateQueries({ queryKey: ["firewall_blocks"] });
    },
    onError: (e: Error) => {
      sound.error();
      void showError(language === "fr" ? "Échec déblocage" : "Unblock failed", e.message || "Unknown error.");
    },
  });

  const blocks = blocksQuery.data ?? [];

  return (
    <section className="setting">
      <span className="setting__label">🛡 {language === "fr" ? "Pare-feu Windows" : "Windows Firewall"}</span>
      <p className="setting__hint">
        {language === "fr" 
          ? "Ports bloqués en entrée via netsh advfirewall." 
          : "Inbound ports blocked via netsh advfirewall."}
      </p>
      {blocks.length === 0 ? (
        <p className="muted" style={{ fontSize: 12 }}>
          {language === "fr" ? "Aucun port bloqué pour le moment." : "No ports blocked for now."}
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
                onClick={() => {
                  sound.click();
                  unblock.mutate({ port: b.port, protocol: b.protocol });
                }}
                title={language === "fr" ? "Débloquer" : "Unblock"}
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