import { create } from "zustand";
import { persist } from "zustand/middleware";

type Sizing = Record<string, number>;
type SizingUpdater = Sizing | ((old: Sizing) => Sizing);

interface TableState {
  columnSizing: Sizing;
  setColumnSizing: (updater: SizingUpdater) => void;
}

// Persiste la largeur des colonnes du tableau Ports dans localStorage.
// Pas via le backend Rust : c'est de l'état UI pur, et un drag de redimension
// peut emettre 60 events/s — pas envie d'inonder set_settings.
export const useTableState = create<TableState>()(
  persist(
    (set, get) => ({
      columnSizing: {},
      setColumnSizing: (updater) =>
        set({
          columnSizing:
            typeof updater === "function" ? updater(get().columnSizing) : updater,
        }),
    }),
    { name: "nexport.table.v1" },
  ),
);
