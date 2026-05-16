import { create } from "zustand";

export type ProtocolFilter = "ALL" | "TCP" | "UDP";

export interface RefreshOption {
  readonly label: string;
  readonly value: number;
}

export const REFRESH_OPTIONS: readonly RefreshOption[] = [
  { label: "Off", value: 0 },
  { label: "1 s", value: 1000 },
  { label: "2 s", value: 2000 },
  { label: "5 s", value: 5000 },
  { label: "10 s", value: 10000 },
] as const;

interface FiltersState {
  search: string;
  protocolFilter: ProtocolFilter;
  favoritesOnly: boolean;
  setSearch: (v: string) => void;
  setProtocolFilter: (v: ProtocolFilter) => void;
  setFavoritesOnly: (v: boolean) => void;
}

export const useFilters = create<FiltersState>((set) => ({
  search: "",
  protocolFilter: "ALL",
  favoritesOnly: false,
  setSearch: (v) => set({ search: v }),
  setProtocolFilter: (v) => set({ protocolFilter: v }),
  setFavoritesOnly: (v) => set({ favoritesOnly: v }),
}));
