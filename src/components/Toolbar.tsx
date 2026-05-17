interface RefreshOption {
  readonly label: string;
  readonly value: number;
}

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  protocolFilter: "ALL" | "TCP" | "UDP";
  onProtocolChange: (v: "ALL" | "TCP" | "UDP") => void;
  onRefresh: () => void;
  loading: boolean;
  count: number;
  refreshMs: number;
  onRefreshMsChange: (v: number) => void;
  refreshOptions: readonly RefreshOption[];
  favoritesOnly: boolean;
  onFavoritesOnlyChange: (v: boolean) => void;
  favoritesCount: number;
}

export function Toolbar({
  search,
  onSearchChange,
  protocolFilter,
  onProtocolChange,
  onRefresh,
  loading,
  count,
  refreshMs,
  onRefreshMsChange,
  refreshOptions,
  favoritesOnly,
  onFavoritesOnlyChange,
  favoritesCount,
}: Props) {
  return (
    <div className="toolbar">
      <input
        className="toolbar__search"
        type="search"
        placeholder="Rechercher  ·  ex: port:>3000  name:node  state:LISTEN"
        title={
          "Operateurs : port:3000  port:>3000  port:3000-4000  pid:1234  " +
          "name:node  path:nodejs  state:LISTEN  proto:TCP  fav:true\n" +
          "Sans prefixe : recherche fuzzy sur port/pid/nom/chemin."
        }
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />

      <div className="toolbar__group" role="tablist" aria-label="Protocole">
        {(["ALL", "TCP", "UDP"] as const).map((p) => (
          <button
            key={p}
            type="button"
            className={`chip ${protocolFilter === p ? "chip--active" : ""}`}
            onClick={() => onProtocolChange(p)}
          >
            {p === "ALL" ? "Tous" : p}
          </button>
        ))}
      </div>

      <button
        type="button"
        className={`chip ${favoritesOnly ? "chip--active" : ""}`}
        onClick={() => onFavoritesOnlyChange(!favoritesOnly)}
        disabled={favoritesCount === 0 && !favoritesOnly}
        title={
          favoritesCount === 0 && !favoritesOnly
            ? "Aucun favori — étoile une ligne pour commencer"
            : "Afficher uniquement les favoris"
        }
      >
        ★ Favoris ({favoritesCount})
      </button>

      <label className="toolbar__select">
        <span className="toolbar__select-label">Auto</span>
        <select
          value={refreshMs}
          onChange={(e) => onRefreshMsChange(Number(e.target.value))}
        >
          {refreshOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <span className="toolbar__count">{count} ports</span>

      <button
        type="button"
        className="btn btn--primary"
        onClick={onRefresh}
        disabled={loading}
      >
        {loading ? "…" : "Rafraîchir"}
      </button>
    </div>
  );
}
