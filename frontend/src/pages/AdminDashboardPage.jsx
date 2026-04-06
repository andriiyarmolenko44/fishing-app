import { useEffect, useMemo, useState } from "react";
import { http } from "../api/http";
import { Link, Navigate } from "react-router-dom";
import { MapContainer, Marker, TileLayer } from "react-leaflet";
import { getStoredUser } from "../auth/auth";
import LocationCard from "../components/LocationCard";
import { getCloudinaryVariant } from "../utils/cloudinaryUrl";
import { toCompactFishChipLabel } from "../utils/fishChipLabel";
import { getErrorMessage } from "../api/getErrorMessage";
import { useI18n } from "../client/i18n/I18nContext";
import { displayFishName } from "../client/i18n/displayName";
import "./AdminDashboardPage.css";

const LIMIT = 6;
const ADMIN_CARD_VISIBLE_FISH_LIMIT = 3;

export default function AdminDashboardPage() {
  const user = getStoredUser();
  const { t, locale } = useI18n();

  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("PENDING");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [expandedId, setExpandedId] = useState(null);
  const [detailsById, setDetailsById] = useState({});
  const [detailsLoadingId, setDetailsLoadingId] = useState(null);
  const [activeModalPhotoIndex, setActiveModalPhotoIndex] = useState(0);

  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / LIMIT)),
    [total],
  );

  async function loadLocations(pageArg = page, statusArg = status) {
    setLoading(true);
    setErrorText("");

    try {
      const res = await http.get("/admin/locations", {
        params: { status: statusArg, page: pageArg, limit: LIMIT },
      });
      setItems(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch (e) {
      setErrorText(getErrorMessage(e, t("home.errors.loadFailed"), t));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!user || user.role !== "ADMIN") return;
    setExpandedId(null);
    loadLocations(1, status);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    if (!expandedId) return;

    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [expandedId]);

  useEffect(() => {
    setActiveModalPhotoIndex(0);
  }, [expandedId]);

  function goNext() {
    const next = page + 1;
    setPage(next);
    loadLocations(next, status);
  }

  function goPrev() {
    const prev = page - 1;
    setPage(prev);
    loadLocations(prev, status);
  }

  async function setStatusForLocation(id, nextStatus) {
    setErrorText("");
    try {
      await http.patch(`/admin/locations/${id}/status`, { status: nextStatus });
      await loadLocations(page, status);
    } catch (e) {
      setErrorText(getErrorMessage(e, t("errors.locations.updateStatusFailed"), t));
    }
  }

  async function toggleDetails(id) {
    setErrorText("");

    setExpandedId((prev) => (prev === id ? null : id));
    if (detailsById[id]) return;

    setDetailsLoadingId(id);
    try {
      const res = await http.get(`/admin/locations/${id}`);
      const item = res.data.item;
      setDetailsById((prev) => ({ ...prev, [id]: item }));
    } catch (e) {
      setErrorText(getErrorMessage(e, t("errors.locations.loadDetailsFailed"), t));
    } finally {
      setDetailsLoadingId(null);
    }
  }

  function canDelete(it) {
    return it.status === "HIDDEN";
  }

  async function deleteLocation(it) {
    if (!canDelete(it)) return;

    const ok = window.confirm(
      `Delete permanently?\n\nTitle: ${it.title || "(no title)"}\nStatus: ${it.status}\n\nThis will remove photos and related records.`,
    );
    if (!ok) return;

    setErrorText("");
    try {
      await http.delete(`/admin/locations/${it.id}`);
      const willBeEmpty = items.length === 1;
      const newPage = willBeEmpty && page > 1 ? page - 1 : page;
      setPage(newPage);
      setExpandedId(null);
      await loadLocations(newPage, status);
    } catch (e) {
      setErrorText(getErrorMessage(e, t("errors.locations.deleteFailed"), t));
    }
  }

  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "ADMIN") return <Navigate to="/" replace />;

  const activeItem = expandedId
    ? items.find((candidate) => candidate.id === expandedId) || null
    : null;
  const activeFull = expandedId ? detailsById[expandedId] || null : null;
  const activeData = activeItem || activeFull;

  const activeFish = activeFull?.fish ?? activeItem?.fish ?? [];
  const activeSeasons = activeFull?.seasons ?? activeItem?.seasons ?? [];
  const activeDesc = activeFull?.description ?? activeItem?.description ?? "";
  const activeContacts = activeFull?.contactInfo ?? activeItem?.contactInfo ?? "";
  const activePhotos = activeFull?.photos ?? activeItem?.photos ?? [];
  const normalizedModalPhotoIndex = Math.min(
    activeModalPhotoIndex,
    Math.max(activePhotos.length - 1, 0),
  );
  const activeModalPhoto = activePhotos[normalizedModalPhotoIndex] || null;
  const activeLatNum = Number(activeFull?.lat ?? activeItem?.lat);
  const activeLngNum = Number(activeFull?.lng ?? activeItem?.lng);
  const activeCoordsOk = Number.isFinite(activeLatNum) && Number.isFinite(activeLngNum);
  const activeStatus = String(activeData?.status || "").toUpperCase();
  const activeOwner = activeFull?.owner ?? activeItem?.owner ?? null;

  return (
    <div className="page admin-page">
      <div className="container admin-page__container">
        <div className="admin-page__top-row">
          <Link to="/" className="btn btn-secondary admin-page__back-btn">
            {t("locationDetails.back")}
          </Link>
        </div>

        <header className="admin-page__header">
          <div className="admin-page__header-surface">
            <h1 className="page-title admin-page__title">{t("admin.title")}</h1>
            <div className="text-muted admin-page__summary">
              {t("admin.summary.totalLabel")} {total}
            </div>
          </div>
        </header>

        <section className="card admin-page__tabs-card">
          <div className="admin-page__tabs">
            {["PENDING", "APPROVED", "REJECTED", "HIDDEN"].map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`btn admin-page__tab-btn admin-page__tab-btn--${s.toLowerCase()} ${
                  status === s ? "admin-page__tab--active" : ""
                }`}
                disabled={loading && status === s}
              >
                {t(`admin.tabs.${s}`, s)}
              </button>
            ))}
          </div>
        </section>

        {errorText ? (
          <div className="admin-page__error">
            <div>{errorText}</div>
            <button
              onClick={() => loadLocations(page, status)}
              disabled={loading}
              className="btn btn-secondary admin-page__retry-btn"
            >
              {t("admin.retry")}
            </button>
          </div>
        ) : null}

        {loading ? (
          <div className="text-muted admin-page__state">{t("admin.loading")}</div>
        ) : null}

        {!loading && !errorText && items.length === 0 ? (
          <div className="text-muted admin-page__state">
            {t("admin.empty")} {t(`admin.tabs.${status}`, status)}
          </div>
        ) : null}

        <section className="admin-page__results">
          {items.map((it) => {
            const isExpanded = expandedId === it.id;
            const fishItems = (it.fish || []).map((x) => {
              const fullLabel = displayFishName(x.fish?.name, locale) || t("admin.unknown");
              return {
                fullLabel,
                compactLabel: toCompactFishChipLabel(fullLabel) || fullLabel,
                keyBase: x.fishId || fullLabel,
              };
            });
            const visibleFish = fishItems.slice(0, ADMIN_CARD_VISIBLE_FISH_LIMIT);
            const hiddenFishCount = Math.max(
              0,
              fishItems.length - visibleFish.length,
            );

            return (
              <LocationCard
                key={it.id}
                loc={it}
                variant="admin"
                hideAdminDescription
                footer={
                  <div className="admin-page__footer-grid">
                    <div className="admin-page__group">
                      <div className="admin-page__group-label">
                        {t("admin.groups.fish")}
                      </div>
                      <div className="admin-page__group-chips">
                        {visibleFish.map((item, idx) => (
                          <span
                            key={`${it.id}-fish-${item.keyBase}-${idx}`}
                            className="chip admin-page__group-chip"
                            title={item.fullLabel}
                          >
                            {item.compactLabel}
                          </span>
                        ))}
                        {hiddenFishCount > 0 ? (
                          <span className="chip admin-page__group-chip admin-page__group-chip--more">
                            +{hiddenFishCount}
                          </span>
                        ) : null}
                        {!it.fish || it.fish.length === 0 ? (
                          <span className="admin-page__empty-dash">{"\u2014"}</span>
                        ) : null}
                      </div>
                    </div>

                    <div className="admin-page__group">
                      <div className="admin-page__group-label">
                        {t("admin.groups.seasons")}
                      </div>
                      <div className="admin-page__group-chips">
                        {(it.seasons || []).map((x, idx) => (
                          <span
                            key={
                              x.seasonId
                                ? `${it.id}-season-${x.seasonId}`
                                : `${it.id}-season-${idx}`
                            }
                            className="chip admin-page__group-chip"
                          >
                            {(() => {
                              const code = x.season?.code || x.season?.name || "";
                              return code
                                ? t(`seasons.${code}`, code)
                                : t("admin.unknown");
                            })()}
                          </span>
                        ))}
                        {!it.seasons || it.seasons.length === 0 ? (
                          <span className="admin-page__empty-dash">{"\u2014"}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                }
                actions={
                  <>
                    <button
                      type="button"
                      onClick={() => toggleDetails(it.id)}
                      disabled={loading}
                      className="btn btn-secondary admin-page__action-btn"
                    >
                      {isExpanded
                        ? t("admin.actions.close")
                        : t("admin.actions.details")}
                    </button>

                    <button
                      onClick={() => setStatusForLocation(it.id, "APPROVED")}
                      disabled={loading || it.status === "APPROVED"}
                      className="btn btn-primary admin-page__action-btn"
                    >
                      {t("admin.actions.approve")}
                    </button>

                    <button
                      onClick={() => setStatusForLocation(it.id, "REJECTED")}
                      disabled={loading || it.status === "REJECTED"}
                      className="btn btn-secondary admin-page__action-btn"
                    >
                      {t("admin.actions.reject")}
                    </button>

                    <button
                      onClick={() => setStatusForLocation(it.id, "HIDDEN")}
                      disabled={loading || it.status === "HIDDEN"}
                      className="btn btn-secondary admin-page__action-btn"
                    >
                      {t("admin.actions.hide")}
                    </button>

                    <button
                      onClick={() => deleteLocation(it)}
                      disabled={loading || !canDelete(it)}
                      title={
                        !canDelete(it)
                          ? t("admin.delete.onlyHidden")
                          : t("admin.delete.permanent")
                      }
                      className={`btn btn-secondary admin-page__action-btn ${
                        canDelete(it) ? "admin-page__action-btn--danger" : ""
                      }`}
                    >
                      {t("admin.actions.delete")}
                    </button>
                  </>
                }
              />
            );
          })}
        </section>

        {expandedId ? (
          <div
            className="admin-page__details-modal-overlay"
            onClick={() => setExpandedId(null)}
            role="presentation"
          >
            <div
              className="admin-page__details-modal"
              role="dialog"
              aria-modal="true"
              aria-label={t("admin.actions.details")}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="admin-page__details-modal-head">
                <div className="admin-page__details-modal-title-wrap">
                  <div className="admin-page__details-modal-meta">
                    <div className="text-muted">
                      {t("card.ownerLabel")}{" "}
                      {activeOwner
                        ? `${activeOwner.displayName || "\u2014"}${
                            activeOwner.email ? ` (${activeOwner.email})` : ""
                          }`
                        : "\u2014"}
                    </div>
                    <div className="text-muted">
                      {t("card.createdAtLabel", "Created at:")}{" "}
                      {activeData?.createdAt
                        ? new Date(activeData.createdAt).toLocaleString()
                        : "\u2014"}
                    </div>
                  </div>
                </div>

                {activeStatus ? (
                  <span
                    className="chip admin-page__details-modal-status"
                    style={statusBadgeStyle(activeStatus)}
                  >
                    {t(`card.statuses.${activeStatus}`, activeStatus)}
                  </span>
                ) : null}
              </div>

              <div className="admin-page__details-modal-content">
                <div className="admin-page__details-fields">
                  <div className="admin-page__field-block">
                    <div className="admin-page__field-label">{t("locationForm.labels.title")}</div>
                    <div className="admin-page__field-value admin-page__field-value--title">
                      {activeData?.title || t("card.noTitle")}
                    </div>
                  </div>

                  <div className="admin-page__field-block">
                    <div className="admin-page__field-label">
                      {t("admin.details.description")}
                    </div>
                    <div className="admin-page__field-value admin-page__field-value--text">
                      {activeDesc || "\u2014"}
                    </div>
                  </div>

                  <div className="admin-page__field-block">
                    <div className="admin-page__field-label">{t("admin.details.contacts")}</div>
                    <div className="admin-page__field-value admin-page__field-value--text">
                      {activeContacts || "\u2014"}
                    </div>
                  </div>

                  <div className="admin-page__field-block">
                    <div className="admin-page__field-label">{t("locationForm.labels.region")}</div>
                    <div className="admin-page__field-value">
                      {activeData?.region
                        ? t(
                            `regions.${String(activeData.region).toUpperCase()}`,
                            activeData.region,
                          )
                        : "\u2014"}
                    </div>
                  </div>

                  <div className="admin-page__field-block">
                    <div className="admin-page__field-label">
                      {t("locationForm.labels.waterType")}
                    </div>
                    <div className="admin-page__field-value">
                      {activeData?.waterType
                        ? t(
                            `locationForm.waterTypes.${String(activeData.waterType).toUpperCase()}`,
                            activeData.waterType,
                          )
                        : "\u2014"}
                    </div>
                  </div>

                  <div className="admin-page__field-block">
                    <div className="admin-page__field-label">
                      {t("admin.details.coordinates")}
                    </div>
                    <div className="admin-page__coords-map-wrap">
                      {activeCoordsOk ? (
                        <MapContainer
                          key={`admin-preview-map-${expandedId}`}
                          center={[activeLatNum, activeLngNum]}
                          zoom={13}
                          scrollWheelZoom
                          dragging
                          doubleClickZoom
                          touchZoom
                          boxZoom
                          keyboard
                          zoomControl
                          className="admin-page__coords-map"
                        >
                          <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          />
                          <Marker position={[activeLatNum, activeLngNum]} />
                        </MapContainer>
                      ) : (
                        <div className="admin-page__coords-map-placeholder text-muted">
                          {t("admin.details.invalidCoords")}
                        </div>
                      )}
                    </div>
                    {activeCoordsOk ? (
                      <div className="admin-page__coords-row">
                        <div className="admin-page__coords-values">
                          <div className="admin-page__coords-item">
                            <div className="admin-page__coords-item-label">
                              {t("admin.details.latShort")}
                            </div>
                            <div className="admin-page__field-value admin-page__coords-item-value">
                              {activeLatNum.toFixed(6)}
                            </div>
                          </div>

                          <div className="admin-page__coords-item">
                            <div className="admin-page__coords-item-label">
                              {t("admin.details.lngShort")}
                            </div>
                            <div className="admin-page__field-value admin-page__coords-item-value">
                              {activeLngNum.toFixed(6)}
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            window.open(
                              `https://www.google.com/maps?q=${activeLatNum},${activeLngNum}`,
                              "_blank",
                              "noopener,noreferrer",
                            )
                          }
                          className="btn btn-primary admin-page__coords-map-btn"
                        >
                          {t("admin.details.openGoogleMaps")}
                        </button>
                      </div>
                    ) : (
                      <div className="admin-page__field-value text-muted">
                        {t("admin.details.invalidCoords")}
                      </div>
                    )}
                  </div>

                  <div className="admin-page__field-block">
                    <div className="admin-page__field-label">{t("admin.groups.fish")}</div>
                    <div className="admin-page__field-value">
                      <div className="admin-page__group-chips">
                        {activeFish.slice(0, 20).map((x, idx) => (
                          <span
                            key={
                              x.fishId
                                ? `${expandedId}-fish-full-${x.fishId}`
                                : `${expandedId}-fish-full-${idx}`
                            }
                            className="chip admin-page__group-chip"
                          >
                            {displayFishName(x.fish?.name, locale) || t("admin.unknown")}
                          </span>
                        ))}
                        {!activeFish.length ? (
                          <span className="admin-page__empty-dash">{"\u2014"}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="admin-page__field-block">
                    <div className="admin-page__field-label">{t("admin.groups.seasons")}</div>
                    <div className="admin-page__field-value">
                      <div className="admin-page__group-chips">
                        {activeSeasons.slice(0, 20).map((x, idx) => (
                          <span
                            key={
                              x.seasonId
                                ? `${expandedId}-season-full-${x.seasonId}`
                                : `${expandedId}-season-full-${idx}`
                            }
                            className="chip admin-page__group-chip"
                          >
                            {(() => {
                              const code = x.season?.code || x.season?.name || "";
                              return code ? t(`seasons.${code}`, code) : t("admin.unknown");
                            })()}
                          </span>
                        ))}
                        {!activeSeasons.length ? (
                          <span className="admin-page__empty-dash">{"\u2014"}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="admin-page__field-block">
                    <div className="admin-page__field-label">{t("admin.details.photos")}</div>
                    <div className="admin-page__field-value">
                      {detailsLoadingId === expandedId ? (
                        <div className="text-muted">{t("admin.details.loadingPhotos")}</div>
                      ) : activePhotos && activePhotos.length ? (
                        <div className="admin-page__photos-gallery">
                          <div className="admin-page__photos-main">
                            {activeModalPhoto ? (
                              <img
                                src={getCloudinaryVariant(activeModalPhoto.url, {
                                  w: 1600,
                                  h: 1000,
                                  crop: "fill",
                                  gravity: "auto",
                                })}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                className="admin-page__photos-main-img"
                              />
                            ) : null}
                          </div>

                          {activePhotos.length > 1 ? (
                            <div className="admin-page__photos-thumbs" role="list">
                              {activePhotos.map((p, idx) => (
                                <button
                                  key={p.id ? `thumb-${p.id}` : `thumb-${idx}`}
                                  type="button"
                                  onClick={() => setActiveModalPhotoIndex(idx)}
                                  className={`admin-page__photos-thumb ${
                                    idx === normalizedModalPhotoIndex
                                      ? "admin-page__photos-thumb--active"
                                      : ""
                                  }`}
                                  title={t("admin.details.photos")}
                                >
                                  <img
                                    src={getCloudinaryVariant(p.url, {
                                      w: 180,
                                      h: 120,
                                      crop: "fill",
                                      gravity: "auto",
                                    })}
                                    alt=""
                                    loading="lazy"
                                    decoding="async"
                                  />
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="text-muted">{t("admin.details.noPhotos")}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="admin-page__details-modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setExpandedId(null)}
                >
                  {t("admin.actions.close")}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="pagination admin-page__pagination">
          <button
            onClick={goPrev}
            disabled={loading || page === 1}
            className="btn btn-secondary"
          >
            {t("common.prev")}
          </button>

          <div className="text-muted admin-page__pagination-meta">
            {t("admin.summary.pageLabel")} {page} / {totalPages}
          </div>

          <button
            onClick={goNext}
            disabled={loading || page >= totalPages}
            className="btn btn-secondary"
          >
            {t("common.next")}
          </button>
        </div>
      </div>
    </div>
  );
}

function statusBadgeStyle(status) {
  const s = String(status || "").toUpperCase();
  if (s === "PENDING") {
    return {
      background: "var(--color-status-pending-bg)",
      borderColor: "var(--color-status-pending-border)",
    };
  }
  if (s === "APPROVED") {
    return {
      background: "var(--color-status-approved-bg)",
      borderColor: "var(--color-status-approved-border)",
    };
  }
  if (s === "REJECTED") {
    return {
      background: "var(--color-status-rejected-bg)",
      borderColor: "var(--color-status-rejected-border)",
    };
  }
  if (s === "HIDDEN") {
    return {
      background: "var(--color-status-hidden-bg)",
      borderColor: "var(--color-status-hidden-border)",
    };
  }
  return {
    background: "var(--color-status-hidden-bg)",
    borderColor: "var(--color-status-hidden-border)",
  };
}
