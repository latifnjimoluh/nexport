import { sound } from "../lib/sound";
import { useTranslation } from "../lib/i18n";

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
  const { t } = useTranslation();

  const handleRefresh = () => {
    sound.click();
    onRefresh();
  };

  const handleProtocolChange = (p: "ALL" | "TCP" | "UDP") => {
    sound.click();
    onProtocolChange(p);
  };

  const handleFavoritesToggle = () => {
    if (favoritesOnly) sound.toggleOff();
    else sound.toggleOn();
    onFavoritesOnlyChange(!favoritesOnly);
  };

  return (
    <div className="toolbar">
      <input
        className="toolbar__search"
        type="search"
        placeholder={t("searching")}
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
            onClick={() => handleProtocolChange(p)}
          >
            {p === "ALL" ? t("all") : p}
          </button>
        ))}
      </div>

      <button
        type="button"
        className={`chip ${favoritesOnly ? "chip--active" : ""}`}
        onClick={handleFavoritesToggle}
        disabled={favoritesCount === 0 && !favoritesOnly}
        title={
          favoritesCount === 0 && !favoritesOnly
            ? "Aucun favori — étoile une ligne pour commencer"
            : "Afficher uniquement les favoris"
        }
      >
        ★ {t("favorites")} ({favoritesCount})
      </button>

      <label className="toolbar__select">
        <span className="toolbar__select-label">{t("auto")}</span>
        <select
          value={refreshMs}
          onChange={(e) => {
            sound.click();
            onRefreshMsChange(Number(e.target.value));
          }}
        >
          {refreshOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <span className="toolbar__count">{count} {t("ports")}</span>

      <button
        type="button"
        className="btn btn--primary"
        onClick={handleRefresh}
        disabled={loading}
      >
        {loading ? "…" : t("refresh")}
      </button>
    </div>
  );
}
