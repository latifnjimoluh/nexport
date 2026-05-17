import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  addFavorite,
  isTauri,
  listFavorites,
  removeFavorite,
} from "../lib/api";

import { sound } from "../lib/sound";

interface FavoritesState {
  favorites: number[];
  hydrated: boolean;
  toggle: (port: number) => void;
  isFavorite: (port: number) => boolean;
  hydrate: () => Promise<void>;
}

export const useFavorites = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favorites: [],
      hydrated: false,
      toggle: (port) => {
        const has = get().favorites.includes(port);
        
        if (has) sound.toggleOff();
        else sound.toggleOn();

        // Optimiste : on met à jour l'UI tout de suite.
        set((s) => ({
          favorites: has
            ? s.favorites.filter((p) => p !== port)
            : [...s.favorites, port],
        }));
        // Write-through best-effort vers SQLite.
        if (isTauri) {
          const writeBack = has ? removeFavorite(port) : addFavorite(port);
          writeBack.catch((e) => {
            console.warn("favorites write-through failed", e);
            // Rollback en cas d'échec backend.
            set((s) => ({
              favorites: has
                ? [...s.favorites, port]
                : s.favorites.filter((p) => p !== port),
            }));
          });
        }
      },
      isFavorite: (port) => get().favorites.includes(port),
      hydrate: async () => {
        if (!isTauri) {
          set({ hydrated: true });
          return;
        }
        try {
          const fromDb = await listFavorites();
          set({ favorites: fromDb, hydrated: true });
        } catch (e) {
          console.warn("favorites hydrate failed", e);
          set({ hydrated: true });
        }
      },
    }),
    {
      name: "nexport.favorites.v1",
      // En mode Tauri, SQLite est la source de vérité — on n'écrase pas avec localStorage.
      partialize: (s) => ({ favorites: s.favorites }),
    },
  ),
);
