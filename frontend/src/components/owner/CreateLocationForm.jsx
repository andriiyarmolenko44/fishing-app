import { useEffect, useRef, useState } from "react";
import { http } from "../../api/http";
import { getStoredUser } from "../../auth/auth";
import { getErrorMessage } from "../../api/getErrorMessage";
import { useI18n } from "../../client/i18n/I18nContext";
import { displayFishName } from "../../client/i18n/displayName";

import RegionPicker from "../pickers/RegionPicker";
import FishPicker from "../pickers/FishPicker";
import SeasonPicker from "../pickers/SeasonPicker";
import PhotoUploader from "./PhotoUploader";
import LocationPickerMap from "./LocationPickerMap";
import {
  LOCATION_LIMITS,
  validateLocationTextFields,
  hasLocationFieldErrors,
} from "./locationFormValidation";
import {
  locationFormFieldCounterStyle,
  locationFormFieldLabelStyle,
} from "./locationFormTypography";

const emptyFieldErrors = {
  title: "",
  description: "",
  contactInfo: "",
  region: "",
  coordinates: "",
  photos: "",
};

export default function CreateLocationForm({ onCreate, onCancel }) {
  const user = getStoredUser();
  const draftFolder = user ? `drafts/${user.id}` : undefined;
  const { t, locale } = useI18n();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const [regionSelected, setRegionSelected] = useState("");
  const [waterType, setWaterType] = useState("LAKE");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  const [fishSelected, setFishSelected] = useState([]);
  const [seasonSelected, setSeasonSelected] = useState([]);

  const [contactInfo, setContactInfo] = useState("");

  const [photos, setPhotos] = useState([]);

  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [fieldErrors, setFieldErrors] = useState(emptyFieldErrors);

  const createdRef = useRef(false);
  const photosRef = useRef([]);
  const descriptionRef = useRef(null);
  const contactsRef = useRef(null);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  function getDraftPublicIds() {
    return (photos || [])
      .filter((p) => !p.id && p.publicId)
      .map((p) => String(p.publicId).trim())
      .filter(Boolean);
  }

  async function cleanupDrafts() {
    const publicIds = getDraftPublicIds();
    if (!publicIds.length) return;

    try {
      await http.post("/photos/cleanup", { publicIds });
    } catch (e) {
      console.error("cleanup failed:", getErrorMessage(e, "cleanup failed"));
    }
  }

  // cleanup when leaving the create form without creating
  useEffect(() => {
    return () => {
      if (createdRef.current) return;
      const publicIds = (photosRef.current || [])
        .filter((p) => !p.id && p.publicId)
        .map((p) => String(p.publicId).trim())
        .filter(Boolean);
      if (!publicIds.length) return;

      http.post("/photos/cleanup", { publicIds }).catch((e) => {
        console.error("cleanup failed:", getErrorMessage(e, "cleanup failed"));
      });
    };
  }, []);

  async function submit(e) {
    e.preventDefault();
    setCreating(true);
    setCreateError("");

    try {
      const regionCode = String(regionSelected || "").trim();
      const latStr = String(lat).trim();
      const lngStr = String(lng).trim();
      const normalizedPhotos = normalizePhotos(photos);

      const nextFieldErrors = {
        ...validateLocationTextFields({ title, description, contactInfo }, t),
        region: regionCode ? "" : t("locationForm.errors.regionRequired"),
        coordinates: getCoordinatesError(latStr, lngStr, t),
        photos: getPhotosError(normalizedPhotos.length, t),
      };

      setFieldErrors(nextFieldErrors);
      if (hasLocationFieldErrors(nextFieldErrors)) return;

      createdRef.current = true;
      await onCreate({
        title: title.trim(),
        description: description.trim(),
        region: regionCode,
        waterType,
        lat: Number(latStr),
        lng: Number(lngStr),
        fishNames: fishSelected,
        seasonCodes: seasonSelected,
        contactInfo: contactInfo.trim() || undefined,

        photos: normalizedPhotos,
        photoUrls: normalizedPhotos.map((p) => p.url), // optional backward compat
      });

      setTitle("");
      setDescription("");
      setRegionSelected("");
      setWaterType("LAKE");
      setLat("");
      setLng("");
      setFishSelected([]);
      setSeasonSelected([]);
      setContactInfo("");
      setPhotos([]);
      setFieldErrors(emptyFieldErrors);
    } catch (err) {
      createdRef.current = false;
      setCreateError(getErrorMessage(err, t("ownerCreate.errors.createFailed"), t));
    } finally {
      setCreating(false);
    }
  }

  async function cancel() {
    if (creating) return;
    await cleanupDrafts();

    if (typeof onCancel === "function") onCancel();
  }

  function handleRegionChange(next) {
    const nextRegion = String(next || "").trim();
    setRegionSelected(next);
    setFieldErrors((prev) => ({
      ...prev,
      region: prev.region ? (nextRegion ? "" : t("locationForm.errors.regionRequired")) : "",
    }));
  }

  function handleCoordinatesSelect(nextLat, nextLng) {
    const latValue = String(nextLat);
    const lngValue = String(nextLng);

    setLat(latValue);
    setLng(lngValue);

    setFieldErrors((prev) => ({
      ...prev,
      coordinates: prev.coordinates
        ? getCoordinatesError(latValue.trim(), lngValue.trim(), t)
        : "",
    }));
  }

  function handlePhotosChange(nextPhotos) {
    setPhotos(nextPhotos);
    setFieldErrors((prev) => ({
      ...prev,
      photos: prev.photos ? getPhotosError(normalizePhotos(nextPhotos).length, t) : "",
    }));
  }

  function handleTitleChange(next) {
    setTitle(next);
    setFieldErrors((prev) => ({
      ...prev,
      ...validateLocationTextFields({ title: next, description, contactInfo }, t),
    }));
  }

  function handleDescriptionChange(target, next) {
    setDescription(next);
    autoResizeTextarea(target);
    setFieldErrors((prev) => ({
      ...prev,
      ...validateLocationTextFields({ title, description: next, contactInfo }, t),
    }));
  }

  function handleContactInfoChange(target, next) {
    setContactInfo(next);
    autoResizeTextarea(target);
    setFieldErrors((prev) => ({
      ...prev,
      ...validateLocationTextFields({ title, description, contactInfo: next }, t),
    }));
  }

  function handleFishChange(next) {
    setFishSelected(uniqueValues(next));
  }

  function handleSeasonChange(next) {
    setSeasonSelected(uniqueValues(next));
  }

  function handleRemoveFishType(name) {
    setFishSelected((prev) => (prev || []).filter((x) => x !== name));
  }

  function handleRemoveSeason(code) {
    setSeasonSelected((prev) => (prev || []).filter((x) => x !== code));
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 8 }}>
      <div style={fieldBlock}>
        <div style={fieldLabel}>{t("locationForm.labels.title")}</div>
        <input
          className="input"
          placeholder={t("locationForm.titlePlaceholder")}
          value={title}
          maxLength={LOCATION_LIMITS.title}
          onChange={(e) => handleTitleChange(e.target.value)}
          style={{
            ...input,
            borderColor: fieldErrors.title ? "var(--color-error)" : "var(--color-border-soft)",
          }}
        />
      </div>
      <div style={fieldMetaRow}>
        <div className="error-text register-page__field-error">{fieldErrors.title || ""}</div>
        <div style={fieldCounterText}>
          {title.length}/{LOCATION_LIMITS.title}
        </div>
      </div>

      <div style={fieldBlock}>
        <div style={fieldLabel}>{t("locationForm.labels.description")}</div>
        <textarea
          className="textarea"
          ref={descriptionRef}
          placeholder={t("locationForm.descriptionPlaceholder")}
          value={description}
          maxLength={LOCATION_LIMITS.description}
          onChange={(e) => handleDescriptionChange(e.target, e.target.value)}
          rows={3}
          style={{
            ...textareaInput,
            borderColor: fieldErrors.description ? "var(--color-error)" : "var(--color-border-soft)",
          }}
        />
      </div>
      <div style={fieldMetaRow}>
        <div className="error-text register-page__field-error">{fieldErrors.description || ""}</div>
        <div style={fieldCounterText}>
          {description.length}/{LOCATION_LIMITS.description}
        </div>
      </div>

      <div style={fieldBlock}>
        <div style={fieldLabel}>{t("locationForm.labels.contacts")}</div>
        <textarea
          className="textarea"
          ref={contactsRef}
          placeholder={t("locationForm.contactsPlaceholderFull")}
          value={contactInfo}
          maxLength={LOCATION_LIMITS.contactInfo}
          onChange={(e) => handleContactInfoChange(e.target, e.target.value)}
          rows={2}
          style={{
            ...textareaInput,
            borderColor: fieldErrors.contactInfo ? "var(--color-error)" : "var(--color-border-soft)",
          }}
        />
      </div>
      <div style={fieldMetaRow}>
        <div className="error-text register-page__field-error">{fieldErrors.contactInfo || ""}</div>
        <div style={fieldCounterText}>
          {contactInfo.length}/{LOCATION_LIMITS.contactInfo}
        </div>
      </div>

      <div style={fieldBlock}>
        <div style={fieldLabel}>{t("locationForm.labels.region")}</div>
        <RegionPicker
          value={regionSelected}
          onChange={handleRegionChange}
          dropdownZIndex={1301}
        />
        <FieldError msg={fieldErrors.region} />
      </div>

      <div style={fieldBlock}>
        <div style={fieldLabel}>{t("locationForm.labels.waterType")}</div>
        <select
          className="select"
          value={waterType}
          onChange={(e) => setWaterType(e.target.value)}
          style={input}
        >
          <option value="LAKE">
            {t("locationForm.waterTypes.LAKE", "LAKE")}
          </option>
          <option value="RIVER">
            {t("locationForm.waterTypes.RIVER", "RIVER")}
          </option>
          <option value="POND">
            {t("locationForm.waterTypes.POND", "POND")}
          </option>
          <option value="SEA">{t("locationForm.waterTypes.SEA", "SEA")}</option>
          <option value="OTHER">
            {t("locationForm.waterTypes.OTHER", "OTHER")}
          </option>
        </select>
      </div>

      <div style={fieldBlock}>
        <div style={fieldLabel}>{t("locationForm.labels.selectCoordinatesOnMap")}</div>
        <LocationPickerMap
          lat={lat}
          lng={lng}
          onSelect={handleCoordinatesSelect}
        />

        <div style={{ display: "flex", gap: 10 }}>
          <div
            style={{
              ...displayField,
              flex: 1,
              borderColor: fieldErrors.coordinates ? "var(--color-error)" : "var(--color-border-soft)",
            }}
          >
            {lat || t("locationForm.latPlaceholder")}
          </div>
          <div
            style={{
              ...displayField,
              flex: 1,
              borderColor: fieldErrors.coordinates ? "var(--color-error)" : "var(--color-border-soft)",
            }}
          >
            {lng || t("locationForm.lngPlaceholder")}
          </div>
        </div>
        <FieldError msg={fieldErrors.coordinates} />
      </div>

      <div style={fieldBlock}>
        <div style={fieldLabel}>{t("locationForm.labels.fish")}</div>
        <FishPicker value={fishSelected} onChange={handleFishChange} />
        {fishSelected.length ? (
          <div className="owner-location-form__chips">
            {fishSelected.map((name) => (
              <span key={`selected-fish-${name}`} className="chip owner-location-form__chip">
                <span className="owner-location-form__chip-label">
                  {displayFishName(name, locale)}
                </span>
                <button
                  type="button"
                  className="owner-location-form__chip-remove"
                  onClick={() => handleRemoveFishType(name)}
                  title={t("home.removeFilterTitle")}
                  aria-label={`${t("home.removeFilterTitle")}: ${displayFishName(name, locale)}`}
                >
                  {"\u2715"}
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div style={fieldBlock}>
        <div style={fieldLabel}>{t("locationForm.labels.seasons")}</div>
        <SeasonPicker value={seasonSelected} onChange={handleSeasonChange} />
        {seasonSelected.length ? (
          <div className="owner-location-form__chips">
            {seasonSelected.map((code) => {
              const label = t(`seasons.${String(code).toUpperCase()}`, code);
              return (
                <span key={`selected-season-${code}`} className="chip owner-location-form__chip">
                  <span className="owner-location-form__chip-label">{label}</span>
                  <button
                    type="button"
                    className="owner-location-form__chip-remove"
                    onClick={() => handleRemoveSeason(code)}
                    title={t("home.removeFilterTitle")}
                    aria-label={`${t("home.removeFilterTitle")}: ${label}`}
                  >
                    {"\u2715"}
                  </button>
                </span>
              );
            })}
          </div>
        ) : null}
      </div>

      <div style={fieldBlock}>
        <div style={fieldLabel}>{t("locationForm.labels.photos")}</div>
        <PhotoUploader
          photos={photos}
          onChange={handlePhotosChange}
          max={6}
          draftFolder={draftFolder}
          previewHintStyle={locationFormFieldLabelStyle}
        />
        <FieldError msg={fieldErrors.photos} />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button disabled={creating} className="btn btn-primary" type="submit">
          {creating
            ? t("createLocation.creating")
            : t("createLocation.create")}
        </button>

        <button
          type="button"
          onClick={cancel}
          disabled={creating}
          className="btn btn-secondary"
        >
          {t("locationForm.cancel")}
        </button>
      </div>

      {createError ? (
        <div className="error-text">{createError}</div>
      ) : null}
    </form>
  );
}

function FieldError({ msg }) {
  if (!msg) return null;
  return <div className="error-text register-page__field-error">{msg}</div>;
}

const input = {
  padding: 10,
  borderRadius: 8,
  border: "1px solid var(--owner-modal-input-border, var(--color-border-soft))",
};
const textareaInput = {
  ...input,
  resize: "none",
  overflow: "hidden",
  minHeight: 88,
  lineHeight: "var(--type-body-line)",
};
const displayField = {
  ...input,
  color: "var(--color-text)",
  background: "var(--color-surface)",
  cursor: "default",
  userSelect: "text",
};
const fieldBlock = { display: "grid", gap: 6 };
const fieldMetaRow = {
  marginTop: -6,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  minHeight: 20,
};
const fieldLabel = locationFormFieldLabelStyle;
const fieldCounterText = locationFormFieldCounterStyle;

function autoResizeTextarea(node) {
  if (!node) return;
  node.style.height = "auto";
  node.style.height = `${node.scrollHeight}px`;
}

function uniqueValues(items) {
  return Array.from(new Set((items || []).filter(Boolean)));
}

function getCoordinatesError(latStr, lngStr, t) {
  if (!latStr || !lngStr) {
    return t("locationForm.errors.coordsRequired");
  }

  const latNum = Number(latStr);
  const lngNum = Number(lngStr);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    return t("locationForm.errors.coordsInvalid");
  }
  if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
    return t("locationForm.errors.coordsRange");
  }

  return "";
}

function getPhotosError(photoCount, t) {
  if (photoCount < 1) return t("locationForm.errors.minPhotos");
  if (photoCount > 6) return t("locationForm.errors.maxPhotos");
  return "";
}

function normalizePhotos(photos) {
  return Array.isArray(photos)
    ? photos
        .map((p) => ({
          url: p?.url ? String(p.url).trim() : "",
          publicId: p?.publicId ? String(p.publicId).trim() : "",
        }))
        .filter((p) => p.url && p.publicId)
    : [];
}

