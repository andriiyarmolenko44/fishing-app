import { useEffect, useMemo, useState } from "react";
import { http } from "../api/http";
import { useFavorites } from "../client/hooks/useFavorites";
import LocationCard from "../components/LocationCard";

import RegionPicker from "../components/pickers/RegionPicker";
import FishPicker from "../components/pickers/FishPicker";
import SeasonPicker from "../components/pickers/SeasonPicker";
import SortPicker from "../components/pickers/SortPicker";
import { getErrorMessage } from "../api/getErrorMessage";
import { useI18n } from "../client/i18n/I18nContext";
import { displayFishName } from "../client/i18n/displayName";
import "./HomePage.css";

const LIMIT = 6;

export default function HomePage() {
  const { t, locale } = useI18n();

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [favoriteError, setFavoriteError] = useState("");

  const [regionSelected, setRegionSelected] = useState("");
  const [waterType, setWaterType] = useState("");
  const [fishSelected, setFishSelected] = useState([]);
  const [seasonsSelected, setSeasonsSelected] = useState([]);
  const [sortValue, setSortValue] = useState("createdAt:desc");

  const [appliedFilters, setAppliedFilters] = useState({
    region: "",
    waterType: "",
    fish: [],
    seasons: [],
  });

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const { canUseFavorites, isFavorite, toggleFavorite } = useFavorites();

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / LIMIT)),
    [total],
  );
  const canPrev = page > 1;
  const canNext = page < totalPages;

  async function load(activeFilters, activeSort, pageArg = page) {
    const params = { page: pageArg, limit: LIMIT };

    if (activeFilters.region) params.region = activeFilters.region;
    if (activeFilters.waterType) params.waterType = activeFilters.waterType;

    if (activeFilters.fish && activeFilters.fish.length) {
      params.fish = activeFilters.fish.join(",");
    }

    if (activeFilters.seasons && activeFilters.seasons.length) {
      params.seasons = activeFilters.seasons.join(",");
    }

    const sv = activeSort || "createdAt:desc";
    const [sort, order] = sv.split(":");
    params.sort = sort || "createdAt";
    params.order = order === "asc" ? "asc" : "desc";

    try {
      setLoading(true);
      setError("");
      const res = await http.get("/locations", { params });
      setItems(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      setError(getErrorMessage(err, t("home.errors.loadFailed"), t));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(appliedFilters, sortValue, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, appliedFilters, sortValue]);

  function onSearch(e) {
    e.preventDefault();
    setPage(1);

    setAppliedFilters({
      region: regionSelected,
      waterType: waterType.trim(),
      fish: fishSelected,
      seasons: seasonsSelected,
    });
  }

  function onReset() {
    setRegionSelected("");
    setWaterType("");
    setFishSelected([]);
    setSeasonsSelected([]);
    setPage(1);

    setAppliedFilters({
      region: "",
      waterType: "",
      fish: [],
      seasons: [],
    });
  }

  function removeFilter(kind, value) {
    if (kind === "region") setRegionSelected("");
    if (kind === "waterType") setWaterType("");
    if (kind === "fish")
      setFishSelected((prev) => prev.filter((x) => x !== value));
    if (kind === "season")
      setSeasonsSelected((prev) => prev.filter((x) => x !== value));

    setPage(1);

    setAppliedFilters((prev) => {
      const next = { ...prev };

      if (kind === "region") next.region = "";
      if (kind === "waterType") next.waterType = "";
      if (kind === "fish")
        next.fish = (prev.fish || []).filter((x) => x !== value);
      if (kind === "season")
        next.seasons = (prev.seasons || []).filter((x) => x !== value);

      return next;
    });
  }

  function onSortChange(nextSortValue) {
    setSortValue(nextSortValue);
    setPage(1);
  }

  const hasActiveFilters =
    appliedFilters.region ||
    appliedFilters.waterType ||
    (appliedFilters.fish && appliedFilters.fish.length) ||
    (appliedFilters.seasons && appliedFilters.seasons.length);

  return (
    <div className="page home-page">
      <div className="container home-page__container">
        <header className="home-page__hero">
          <div className="home-page__hero-surface">
            <h1 className="page-title">{t("home.title")}</h1>
            <p className="text-muted home-page__subtitle">
              {t("home.subtitle")}
            </p>
          </div>
        </header>

        <section className="card home-page__filters">
          <form onSubmit={onSearch} className="grid home-page__filters-form">
            <div className="home-page__filters-grid">
              <div className="home-page__field">
                <RegionPicker
                  value={regionSelected}
                  onChange={setRegionSelected}
                  placeholder={t("home.regionPlaceholder")}
                />
              </div>

              <div className="home-page__field">
                <select
                  value={waterType}
                  onChange={(e) => setWaterType(e.target.value)}
                  className="select"
                >
                  <option value="">{t("home.waterTypeAll")}</option>
                  <option value="LAKE">{t("home.waterTypes.LAKE")}</option>
                  <option value="RIVER">{t("home.waterTypes.RIVER")}</option>
                  <option value="POND">{t("home.waterTypes.POND")}</option>
                  <option value="SEA">{t("home.waterTypes.SEA")}</option>
                </select>
              </div>

              <div className="home-page__field">
                <FishPicker value={fishSelected} onChange={setFishSelected} />
              </div>

              <div className="home-page__field">
                <SeasonPicker value={seasonsSelected} onChange={setSeasonsSelected} />
              </div>

              <div className="home-page__action-cell">
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary home-page__action-btn"
                >
                  {t("home.search")}
                </button>
              </div>

              <div className="home-page__action-cell">
                <button
                  type="button"
                  onClick={onReset}
                  disabled={loading}
                  className="btn btn-secondary home-page__action-btn"
                >
                  {t("home.reset")}
                </button>
              </div>
            </div>
          </form>
        </section>

        {loading ? <div className="text-muted">{t("common.loading")}</div> : null}
        {error ? <div className="error-text">{error}</div> : null}
        {favoriteError ? (
          <div className="error-text home-page__favorite-error">{favoriteError}</div>
        ) : null}

        <section className="home-page__results-section">
          <div className="home-page__results-header">
            <div className="home-page__results-surface">
              <div className="home-page__results-header-left">
                <h2 className="section-title">{t("home.resultsTitle")}</h2>
                <div className="text-muted">
                  {t("home.foundLabel")} {total}
                </div>
              </div>
            </div>

            <div className="home-page__results-sort">
              <SortPicker value={sortValue} onChange={onSortChange} />
            </div>
          </div>

          {hasActiveFilters ? (
            <div className="home-page__active-filters-inline">
              <div className="text-muted home-page__active-filters-title">
                {t("home.activeFilters")}
              </div>

              <div className="home-page__chips">
                {appliedFilters.region ? (
                  <Chip
                    label={`${t("home.filterLabels.region")} ${t(
                      `regions.${appliedFilters.region}`,
                      appliedFilters.region,
                    )}`}
                    onRemove={() => removeFilter("region")}
                    removeTitle={t("home.removeFilterTitle")}
                  />
                ) : null}

                {appliedFilters.waterType ? (
                  <Chip
                    label={`${t("home.filterLabels.water")} ${t(
                      `home.waterTypes.${appliedFilters.waterType}`,
                      appliedFilters.waterType,
                    )}`}
                    onRemove={() => removeFilter("waterType")}
                    removeTitle={t("home.removeFilterTitle")}
                  />
                ) : null}

                {(appliedFilters.fish || []).map((name) => (
                  <Chip
                    key={`fish-${name}`}
                    label={`${t("home.filterLabels.fish")} ${displayFishName(
                      name,
                      locale,
                    )}`}
                    onRemove={() => removeFilter("fish", name)}
                    removeTitle={t("home.removeFilterTitle")}
                  />
                ))}

                {(appliedFilters.seasons || []).map((code) => (
                  <Chip
                    key={`season-${code}`}
                    label={`${t("home.filterLabels.season")} ${t(
                      `seasons.${code}`,
                      code,
                    )}`}
                    onRemove={() => removeFilter("season", code)}
                    removeTitle={t("home.removeFilterTitle")}
                  />
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid home-page__results">
            {items.map((loc) => {
              const favorited = isFavorite(loc.id);
              return (
                <LocationCard
                  key={loc.id}
                  loc={loc}
                  to={`/locations/${loc.id}`}
                  variant="public"
                  compactFishLabelMode="locale-smart"
                  actions={
                    canUseFavorites ? (
                      <button
                        type="button"
                        title={favorited ? t("favorites.remove") : t("favorites.add")}
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setFavoriteError("");
                          const result = await toggleFavorite(loc.id);
                          if (!result.ok) {
                            setFavoriteError(t("errors.favorites.toggleFailed"));
                          }
                        }}
                        className={`btn btn-secondary home-page__favorite-btn ${
                          favorited ? "favorite-toggle-btn--active" : ""
                        }`}
                      >
                        {favorited ? "\u2605" : "\u2606"}
                      </button>
                    ) : null
                  }
                />
              );
            })}
          </div>
        </section>

        <div className="pagination home-page__pagination">
          <button
            disabled={!canPrev || loading}
            onClick={() => setPage((p) => p - 1)}
            className="btn btn-secondary"
          >
            {t("common.prev")}
          </button>

          <div className="text-muted">
            {t("home.pageLabel")} {page} {t("home.ofLabel")} {totalPages}
          </div>

          <button
            disabled={!canNext || loading}
            onClick={() => setPage((p) => p + 1)}
            className="btn btn-secondary"
          >
            {t("common.next")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Chip({ label, onRemove, removeTitle }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="chip home-page__chip-btn"
      title={removeTitle}
    >
      {label} {"\u2715"}
    </button>
  );
}
