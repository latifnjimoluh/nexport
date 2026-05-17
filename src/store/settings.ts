import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getSettings, isTauri, setSettings as writeSettings } from "../lib/api";
import type { Settings } from "../types";

interface SettingsStore extends Settings {
  hydrated: boolean;
  hydrate: () => Promise<void>;
  update: (patch: Partial<Settings>) => void;
}

const DEFAULTS: Settings = {
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

export const useSettings = create<SettingsStore>()(
  persist(
    (set, get) => ({
      ...DEFAULTS,
      hydrated: false,
      hydrate: async () => {
        if (!isTauri) {
          set({ hydrated: true });
          return;
        }
        try {
          const s = await getSettings();
          set({ ...s, hydrated: true });
        } catch (e) {
          console.warn("settings hydrate failed", e);
          set({ hydrated: true });
        }
      },
      update: (patch) => {
        const previous: Settings = {
          refreshMs: get().refreshMs,
          notificationsEnabled: get().notificationsEnabled,
          soundEnabled: get().soundEnabled,
          theme: get().theme,
          language: get().language,
          autoKillPorts: get().autoKillPorts ?? [],
          autoKillEnabled: get().autoKillEnabled ?? true,
          readOnly: get().readOnly ?? false,
          pinHash: get().pinHash ?? null,
        };
        const next: Settings = { ...previous, ...patch };
        set(next);
        if (isTauri) {
          writeSettings(next).catch((e) => {
            console.warn("settings write-through failed", e);
            set(previous);
          });
        }
      },
    }),
    {
      name: "nexport.settings.v1",
      partialize: (s): Settings => ({
        refreshMs: s.refreshMs,
        notificationsEnabled: s.notificationsEnabled,
        soundEnabled: s.soundEnabled,
        theme: s.theme,
        language: s.language,
        autoKillPorts: s.autoKillPorts ?? [],
        autoKillEnabled: s.autoKillEnabled ?? true,
        readOnly: s.readOnly ?? false,
        pinHash: s.pinHash ?? null,
      }),
    },
  ),
);

