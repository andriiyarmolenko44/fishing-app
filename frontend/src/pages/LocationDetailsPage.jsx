import { useEffect, useCallback, useState } from "react";
import { useParams, Link, useLocation } from "react-router-dom";
import { http } from "../api/http";
import { getStoredUser } from "../auth/auth";
import { useFavorites } from "../client/hooks/useFavorites";
import { getCloudinaryVariant } from "../utils/cloudinaryUrl";
import { getErrorMessage } from "../api/getErrorMessage";
import { useI18n } from "../client/i18n/I18nContext";
import { displayFishName } from "../client/i18n/displayName";
import "./LocationDetailsPage.css";

export default function LocationDetailsPage() {
  const REVIEWS_INITIAL_COUNT = 3;
  const REVIEWS_SHOW_MORE_STEP = 3;
  const REVIEW_COMMENT_MAX = 250;
  const { id } = useParams();
  const routerLocation = useLocation();
  const { t, locale } = useI18n();
  const backTo = resolveBackPath(routerLocation?.state);

  const [user, setUser] = useState(getStoredUser());
  const [contactInfo, setContactInfo] = useState(null);

  const [location, setLocation] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [favoriteError, setFavoriteError] = useState("");
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  const { canUseFavorites, isFavorite, toggleFavorite } = useFavorites();

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [visibleReviewsCount, setVisibleReviewsCount] = useState(REVIEWS_INITIAL_COUNT);
  const [reviewsSort, setReviewsSort] = useState("newest");

  const loadAll = useCallback(async () => {
    const [locRes, revRes] = await Promise.all([
      http.get(`/locations/${id}`),
      http.get(`/locations/${id}/reviews`),
    ]);
    setLocation(locRes?.data || null);
    setReviews(revRes?.data?.items || []);
  }, [id]);

  useEffect(() => {
    function onAuthChanged() {
      setUser(getStoredUser());
    }
    window.addEventListener("authChanged", onAuthChanged);
    return () => window.removeEventListener("authChanged", onAuthChanged);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");
        await loadAll();
      } catch (err) {
        if (!cancelled) {
          setError(getErrorMessage(err, t("locationDetails.errors.loadFailed"), t));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadAll]);

  useEffect(() => {
    let cancelled = false;

    async function loadContacts() {
      if (!user) {
        setContactInfo(null);
        return;
      }

      try {
        const res = await http.get(`/locations/${id}/contact`);
        if (!cancelled) setContactInfo(res.data.contactInfo || null);
      } catch {
        if (!cancelled) setContactInfo(null);
      }
    }

    loadContacts();
    return () => {
      cancelled = true;
    };
  }, [id, user]);

  useEffect(() => {
    setActivePhotoIndex(0);
  }, [id]);

  useEffect(() => {
    setVisibleReviewsCount(REVIEWS_INITIAL_COUNT);
  }, [id, reviews.length, reviewsSort]);

  async function submitReview(e) {
    e.preventDefault();
    if (!user) return;

    try {
      setSubmitting(true);
      setFormError("");

      await http.post(`/locations/${id}/reviews`, {
        rating: Number(rating),
        comment: comment.trim(),
      });

      setComment("");
      setRating(5);
      await loadAll();
    } catch (err) {
      setFormError(
        getErrorMessage(err, t("locationDetails.errors.submitReviewFailed"), t),
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="page location-details-page">
        <div className="container location-details-page__state">
          <div className="text-muted">{t("common.loading")}</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page location-details-page">
        <div className="container location-details-page__state">
          <div className="error-text">{error}</div>
        </div>
      </div>
    );
  }

  if (!location) {
    return (
      <div className="page location-details-page">
        <div className="container location-details-page__state">
          <div className="text-muted">{t("common.notFound")}</div>
        </div>
      </div>
    );
  }

  const latNum = Number(location.lat);
  const lngNum = Number(location.lng);
  const hasCoords = Number.isFinite(latNum) && Number.isFinite(lngNum);

  const googleMapsUrl = hasCoords
    ? `https://www.google.com/maps/search/?api=1&query=${latNum},${lngNum}`
    : null;

  const delta = 0.01;
  const left = lngNum - delta;
  const right = lngNum + delta;
  const top = latNum + delta;
  const bottom = latNum - delta;

  const osmEmbedUrl = hasCoords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${latNum}%2C${lngNum}`
    : null;

  const photos = Array.isArray(location.photos) ? location.photos : [];
  const normalizedPhotoIndex = Math.min(activePhotoIndex, Math.max(photos.length - 1, 0));
  const activePhoto = photos[normalizedPhotoIndex] || null;

  const regionLabel = location?.region
    ? t(`regions.${String(location.region).toUpperCase()}`, location.region)
    : t("card.unknownRegion");

  const waterTypeLabel = location?.waterType
    ? t(`locationForm.waterTypes.${String(location.waterType).toUpperCase()}`, location.waterType)
    : t("card.unknownType");

  const statusLabel = location?.status
    ? t(`card.statuses.${String(location.status).toUpperCase()}`, location.status)
    : null;
  const statusCode = String(location?.status || "").toUpperCase();
  const showStatusChip = Boolean(statusLabel) && statusCode !== "APPROVED";

  const avg = Number(location?.avgRating ?? 0);
  const reviewsCount = Number(location?.reviewsCount ?? 0);
  const favorited = isFavorite(location.id);
  const ratingValue = reviewsCount > 0 ? avg.toFixed(1) : "\u2014";
  const sortedReviews = [...reviews].sort((a, b) => {
    if (reviewsSort === "oldest") {
      return new Date(a?.createdAt || 0).getTime() - new Date(b?.createdAt || 0).getTime();
    }
    if (reviewsSort === "highest") {
      return Number(b?.rating ?? 0) - Number(a?.rating ?? 0);
    }
    if (reviewsSort === "lowest") {
      return Number(a?.rating ?? 0) - Number(b?.rating ?? 0);
    }
    return new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime();
  });

  const visibleReviews = sortedReviews.slice(0, visibleReviewsCount);
  const fishNames = extractFishNames(location?.fish).map((name) =>
    displayFishName(name, locale),
  );
  const seasonLabels = extractSeasonCodes(location?.seasons).map((code) =>
    t(`seasons.${String(code).toUpperCase()}`, code),
  );

  return (
    <div className="page location-details-page">
      <div className="container location-details-page__container">
        <div className="location-details-page__back-row">
          <Link to={backTo} className="btn btn-secondary location-details-page__back-btn">
            {t("locationDetails.back")}
          </Link>
          {canUseFavorites ? (
            <button
              type="button"
              onClick={async () => {
                setFavoriteError("");
                const result = await toggleFavorite(location.id);
                if (!result.ok) {
                  setFavoriteError(t("errors.favorites.toggleFailed"));
                }
              }}
              title={
                favorited ? t("locationDetails.favRemove") : t("locationDetails.favAdd")
              }
              className={`btn btn-secondary location-details-page__favorite-btn ${
                favorited ? "favorite-toggle-btn--active" : ""
              }`}
            >
              {favorited ? "\u2605" : "\u2606"}
            </button>
          ) : null}
        </div>

        <section className="card location-details-page__hero">
          <div className="location-details-page__hero-main">
            <div className="location-details-page__media-column">
              <div className="location-details-page__media">
                {activePhoto ? (
                  <img
                    src={getCloudinaryVariant(activePhoto.url, {
                      w: 1600,
                      h: 1000,
                      crop: "fill",
                      gravity: "auto",
                    })}
                    alt={location.title || t("card.photoAlt")}
                    loading="lazy"
                    decoding="async"
                    className="location-details-page__hero-image"
                  />
                ) : (
                  <div className="location-details-page__media-empty">{t("card.noPhoto")}</div>
                )}
              </div>

              {photos.length > 1 ? (
                <div className="location-details-page__thumbs" role="list">
                  {photos.map((photo, index) => (
                    <button
                      key={photo.id || photo.url || index}
                      type="button"
                      onClick={() => setActivePhotoIndex(index)}
                      className={`location-details-page__thumb ${
                        index === normalizedPhotoIndex ? "location-details-page__thumb--active" : ""
                      }`}
                      title={t("locationDetails.photos")}
                    >
                      <img
                        src={getCloudinaryVariant(photo.url, {
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

            <div className="location-details-page__primary">
              <div className="location-details-page__primary-top">
                <div className="location-details-page__title-wrap">
                  <h1 className="page-title location-details-page__title">
                    {location.title || t("card.noTitle")}
                  </h1>
                </div>
              </div>

              {favoriteError ? (
                <div className="error-text location-details-page__favorite-error">
                  {favoriteError}
                </div>
              ) : null}

              <div className="location-details-page__meta-grid">
                <div className="location-details-page__meta-item">
                  <span className="text-muted location-details-page__meta-label">
                    {t("regionPicker.placeholder", "Region")}
                  </span>
                  <strong className="location-details-page__meta-value">{regionLabel}</strong>
                </div>
                <div className="location-details-page__meta-item">
                  <span className="text-muted location-details-page__meta-label">
                    {String(t("home.filterLabels.water", "Water type")).replace(/:\s*$/, "")}
                  </span>
                  <strong className="location-details-page__meta-value">{waterTypeLabel}</strong>
                </div>
              </div>

              <div className="location-details-page__highlights">
                <div className="location-details-page__highlights-row">
                  <div
                    className="location-details-page__rating-display"
                    title={`${t("locationDetails.ratingLabel")} ${ratingValue}`}
                  >
                    <span className="location-details-page__rating-star" aria-hidden>
                      {"\u2605"}
                    </span>
                    <span className="location-details-page__rating-value">{ratingValue}</span>
                  </div>

                  <div className="chip location-details-page__highlight-chip location-details-page__posted-by-chip">
                    {t("locationDetails.postedBy")}{" "}
                    {location.owner?.displayName || t("locationDetails.unknown")}
                  </div>
                </div>

                {showStatusChip ? (
                  <div className="location-details-page__highlights-status">
                    <div className="chip location-details-page__highlight-chip">{statusLabel}</div>
                  </div>
                ) : null}
              </div>

              <article className="location-details-page__hero-contact">
                <h2 className="location-details-page__mini-title">
                  {t("locationDetails.contacts")}
                </h2>
                {user ? (
                  contactInfo ? (
                    <p className="location-details-page__contacts">{contactInfo}</p>
                  ) : (
                    <p className="text-muted">{t("locationDetails.unknown")}</p>
                  )
                ) : (
                  <p className="text-muted">{t("locationDetails.contactsLoginHint")}</p>
                )}
              </article>

              <div className="location-details-page__primary-actions">
                {googleMapsUrl ? (
                  <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-primary location-details-page__maps-btn"
                  >
                    {t("locationDetails.openGoogleMaps")}
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <article className="card location-details-page__section">
          <h2 className="section-title">{t("locationDetails.description")}</h2>
          {seasonLabels.length ? (
            <div className="location-details-page__description-meta">
              <h3 className="location-details-page__subsection-title">
                {t("home.filterLabels.season", "Seasons:")}
              </h3>
              <div className="location-details-page__chips">
                {seasonLabels.map((label) => (
                  <span
                    key={`season-${label}`}
                    className="chip location-details-page__chip"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {fishNames.length ? (
            <div className="location-details-page__description-meta">
              <h3 className="location-details-page__subsection-title">
                {t("home.filterLabels.fish", "Fish")}
              </h3>
              <div className="location-details-page__chips">
                {fishNames.map((name) => (
                  <span key={`fish-${name}`} className="chip location-details-page__chip">
                    {name}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          <p className="location-details-page__description">
            {location.description || t("card.noDescription")}
          </p>
        </article>

        <section className="location-details-page__content-grid">
          <div className="location-details-page__main grid">

            {hasCoords ? (
              <article className="card location-details-page__section">
                <h2 className="section-title">{t("locationDetails.map")}</h2>
                <div className="location-details-page__map-wrap">
                  <iframe
                    title={t("locationDetails.mapPreviewTitle")}
                    src={osmEmbedUrl}
                    width="100%"
                    height="250"
                    className="location-details-page__map"
                    loading="lazy"
                  />
                </div>
                <p className="text-muted location-details-page__map-helper">
                  {t("locationDetails.mapHelper")}
                </p>
              </article>
            ) : null}

          </div>

          <aside className="location-details-page__side grid">
            <article className="card location-details-page__section">
              <h2 className="section-title">{t("locationDetails.leaveReview")}</h2>

              {!user ? (
                <div className="text-muted">{t("locationDetails.loginToReview")}</div>
              ) : (
                <form onSubmit={submitReview} className="location-details-page__review-form">
                  <div className="location-details-page__field">
                    <div className="location-details-page__field-head">
                      <span className="text-muted">{t("locationDetails.form.rating")}</span>
                    </div>
                    <div
                      className="location-details-page__rating-controls"
                      role="radiogroup"
                      aria-label={t("locationDetails.form.rating")}
                    >
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button
                          key={value}
                          type="button"
                          role="radio"
                          aria-checked={rating === value}
                          onClick={() => setRating(value)}
                          className={`chip location-details-page__rating-option ${
                            rating === value
                              ? "location-details-page__rating-option--active is-selected"
                              : ""
                          }`}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="location-details-page__field">
                    <div className="location-details-page__field-head">
                      <span className="text-muted">{t("locationDetails.form.comment")}</span>
                      <span className="text-muted location-details-page__field-counter">
                        {comment.length}/{REVIEW_COMMENT_MAX}
                      </span>
                    </div>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={3}
                      maxLength={REVIEW_COMMENT_MAX}
                      placeholder={t("locationDetails.form.commentPlaceholder")}
                      className="textarea"
                    />
                  </div>

                  <button
                    disabled={submitting}
                    className="btn btn-primary location-details-page__submit-btn"
                  >
                    {submitting
                      ? t("locationDetails.form.submitting")
                      : t("locationDetails.form.submit")}
                  </button>

                  {formError ? <div className="error-text">{formError}</div> : null}
                </form>
              )}
            </article>

            <article className="card location-details-page__section location-details-page__reviews-section">
              <div className="location-details-page__reviews-header">
                <div className="location-details-page__reviews-title-wrap">
                  <h2 className="section-title">{t("locationDetails.reviewsTitle")}</h2>
                  <div className="text-muted location-details-page__reviews-meta">
                    {formatReviewsCountLabel(reviews.length, locale, t)}
                  </div>
                </div>
                {reviews.length > 0 ? (
                  <label className="location-details-page__reviews-sort">
                    <span className="text-muted">{t("sort.title")}</span>
                    <select
                      value={reviewsSort}
                      onChange={(e) => setReviewsSort(e.target.value)}
                      className="select"
                    >
                      <option value="newest">
                        {t("locationDetails.reviewsSortNewest")}
                      </option>
                      <option value="oldest">
                        {t("locationDetails.reviewsSortOldest")}
                      </option>
                      <option value="highest">
                        {t("locationDetails.reviewsSortHighest")}
                      </option>
                      <option value="lowest">
                        {t("locationDetails.reviewsSortLowest")}
                      </option>
                    </select>
                  </label>
                ) : null}
              </div>

              {reviews.length === 0 ? (
                <div className="text-muted">{t("locationDetails.noReviews")}</div>
              ) : (
                <>
                  <div className="location-details-page__reviews">
                    {visibleReviews.map((r) => (
                      <article key={r.id} className="location-details-page__review">
                        <div className="location-details-page__review-head">
                          <strong className="location-details-page__review-user">
                            {r.user?.displayName ?? t("locationDetails.anonymous")}
                          </strong>
                          <span className="chip location-details-page__rating-chip location-details-page__review-rating">
                            {formatReviewRating(r.rating)}
                          </span>
                          <span className="text-muted location-details-page__review-time">
                            {new Date(r.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="location-details-page__review-comment">{r.comment}</p>
                      </article>
                    ))}
                  </div>
                  {visibleReviews.length < sortedReviews.length ? (
                    <div className="location-details-page__reviews-pagination">
                      <button
                        type="button"
                        className="btn btn-secondary location-details-page__reviews-more-btn"
                        onClick={() =>
                          setVisibleReviewsCount((prev) =>
                            Math.min(prev + REVIEWS_SHOW_MORE_STEP, sortedReviews.length),
                          )
                        }
                      >
                        {t("locationDetails.showMore")}
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </article>
          </aside>
        </section>
      </div>
    </div>
  );
}

function extractFishNames(fish) {
  if (!Array.isArray(fish)) return [];
  const names = fish
    .map((x) => {
      if (typeof x === "string") return x;
      return x?.fish?.name || x?.name || "";
    })
    .map((x) => String(x || "").trim())
    .filter(Boolean);
  return [...new Set(names)];
}

function extractSeasonCodes(seasons) {
  if (!Array.isArray(seasons)) return [];
  const codes = seasons
    .map((x) => {
      if (typeof x === "string") return x;
      return x?.season?.code || x?.code || x?.season?.name || x?.name || "";
    })
    .map((x) => String(x || "").trim())
    .filter(Boolean);
  return [...new Set(codes)];
}

function formatReviewRating(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "\u2014";
  return Number.isInteger(numeric) ? String(numeric) : String(numeric);
}

function resolveBackPath(state) {
  const from = state?.from;
  if (typeof from === "string" && from.startsWith("/")) {
    return from;
  }
  return "/";
}

function formatReviewsCountLabel(count, locale, t) {
  const normalized = Number.isFinite(Number(count)) ? Math.max(0, Number(count)) : 0;
  const rules = new Intl.PluralRules(locale === "uk" ? "uk" : "en");
  const category = rules.select(normalized);
  const template = t(
    `locationDetails.reviewsCount.${category}`,
    t("locationDetails.reviewsCount.other", "{count} reviews"),
  );
  return String(template).replace("{count}", String(normalized));
}
