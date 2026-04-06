import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../client/i18n/I18nContext";
import "./PhotoUploader.css";
export default function PhotoUploader({
  photos = [],
  onChange,
  max = 10,
  onRemove,
  draftFolder,
  previewHintStyle,
}) {
  const { t } = useI18n();

  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [pendingUploads, setPendingUploads] = useState([]);
  const pendingBlobUrlsRef = useRef(new Set());

  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  const MAX_BYTES = 10 * 1024 * 1024;

  useEffect(() => {
    const pendingBlobUrls = pendingBlobUrlsRef.current;

    return () => {
      for (const url of pendingBlobUrls) {
        URL.revokeObjectURL(url);
      }
      pendingBlobUrls.clear();
    };
  }, []);

  function revokePendingPreview(url) {
    if (!url) return;
    if (!pendingBlobUrlsRef.current.has(url)) return;
    URL.revokeObjectURL(url);
    pendingBlobUrlsRef.current.delete(url);
  }

  function makePendingItem(file, index) {
    const previewUrl = URL.createObjectURL(file);
    pendingBlobUrlsRef.current.add(previewUrl);

    return {
      tempId: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
      previewUrl,
      status: "uploading",
      fileName: file?.name ? String(file.name) : "",
    };
  }

  function uniqByUrl(list) {
    const out = [];
    const seen = new Set();
    for (const p of list) {
      const url = p?.url ? String(p.url).trim() : "";
      if (!url) continue;
      if (seen.has(url)) continue;
      seen.add(url);
      out.push({ ...p, url });
    }
    return out;
  }

  async function upload(files) {
    if (!cloudName || !uploadPreset) {
      setErrorText(t("photos.errors.envMissing"));
      return;
    }

    const current = Array.isArray(photos) ? photos.length : 0;
    const left = Math.max(0, max - current);

    if (left === 0) {
      setErrorText(t("photos.errors.maxReached").replace("{max}", String(max)));
      return;
    }

    const arr = Array.from(files);

    const nonImages = arr.filter((f) => !f.type?.startsWith("image/"));
    const tooBig = arr.filter(
      (f) => f.type?.startsWith("image/") && f.size > MAX_BYTES,
    );

    const picked = arr
      .filter((f) => f.type?.startsWith("image/"))
      .filter((f) => f.size <= MAX_BYTES)
      .slice(0, left);

    if (!picked.length) {
      if (nonImages.length) {
        setErrorText(t("photos.errors.onlyImages"));
        return;
      }
      if (tooBig.length) {
        setErrorText(t("photos.errors.tooLarge"));
        return;
      }
      setErrorText(t("photos.errors.nothingToUpload"));
      return;
    }

    if (arr.length > left) {
      setErrorText(
        t("photos.errors.limitReached")
          .replace("{left}", String(left))
          .replace("{max}", String(max)),
      );
    } else {
      setErrorText("");
    }

    setUploading(true);

    try {
      const batchPending = picked.map((file, idx) => makePendingItem(file, idx));
      const batchIds = new Set(batchPending.map((x) => x.tempId));
      setPendingUploads((prev) => [...prev, ...batchPending]);

      const uploads = picked.map(async (file) => {
        const form = new FormData();
        form.append("file", file);
        form.append("upload_preset", uploadPreset);

        if (draftFolder) {
          form.append("folder", String(draftFolder));
        }

        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
          { method: "POST", body: form },
        );

        if (!res.ok) throw new Error("Upload failed");

        const data = await res.json();

        if (!data.secure_url) throw new Error("No secure_url");
        if (!data.public_id) throw new Error("No public_id");

        return {
          url: data.secure_url,
          publicId: data.public_id,
        };
      });

      const settled = await Promise.allSettled(uploads);

      const uploaded = settled
        .filter((r) => r.status === "fulfilled")
        .map((r) => r.value);

      const failedIds = new Set();
      for (let i = 0; i < settled.length; i += 1) {
        if (settled[i].status === "rejected") {
          failedIds.add(batchPending[i].tempId);
        }
      }

      setPendingUploads((prev) =>
        prev.flatMap((item) => {
          if (!batchIds.has(item.tempId)) return [item];

          if (failedIds.has(item.tempId)) {
            return [{ ...item, status: "failed" }];
          }

          revokePendingPreview(item.previewUrl);
          return [];
        }),
      );

      const failedCount = settled.length - uploaded.length;
      const hadFailures = failedCount > 0;

      if (!uploaded.length) {
        setErrorText(t("photos.errors.uploadFailed"));
        return;
      }

      const next = uniqByUrl([...(photos || []), ...uploaded]).slice(0, max);
      onChange(next);

      if (hadFailures) {
        setErrorText(
          `${t("photos.errors.uploadFailed")} (${failedCount}/${picked.length})`,
        );
      } else {
        setErrorText("");
      }
    } catch {
      setErrorText(t("photos.errors.uploadFailed"));
    } finally {
      setUploading(false);
    }
  }

  async function onPick(e) {
    const files = e.target.files;
    try {
      if (files?.length) await upload(files);
    } finally {
      e.target.value = "";
    }
  }

  function onDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    if (uploading) return;
    const files = e.dataTransfer?.files;
    if (files?.length) upload(files);
  }

  async function removePhoto(photo, idx) {
    try {
      if (typeof onRemove === "function") {
        await onRemove(photo);
      }

      const next = (photos || []).filter((_, i) => i !== idx);
      onChange(next);
      setErrorText("");
    } catch {
      setErrorText(t("photos.errors.removeFailed"));
    }
  }

  function removePendingItem(tempId) {
    setPendingUploads((prev) => {
      const next = [];
      for (const item of prev) {
        if (item.tempId === tempId) {
          revokePendingPreview(item.previewUrl);
          continue;
        }
        next.push(item);
      }
      return next;
    });
  }

  function movePhotoByIndex(fromIdx, toIdx) {
    if (!Array.isArray(photos)) return;
    if (fromIdx < 0 || toIdx < 0) return;
    if (fromIdx >= photos.length || toIdx >= photos.length) return;
    if (fromIdx === toIdx) return;

    const next = [...photos];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    onChange(next);
  }

  const photosList = photos || [];
  const previewItems = [
    ...photosList.map((p, idx) => ({
      kind: "saved",
      key: `${p?.id || p?.publicId || p?.url}-${idx}`,
      photo: p,
      index: idx,
      isCover: idx === 0,
    })),
    ...pendingUploads.map((item, idx) => {
      const overallIndex = photosList.length + idx;
      return {
        kind: "pending",
        key: item.tempId,
        pending: item,
        fileName: item.fileName || "",
        isCover: overallIndex === 0,
      };
    }),
  ];

  return (
    <div className="photo-uploader">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={onPick}
      />

      <div
        className="photo-uploader__dropzone"
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={onDrop}
      >
        <div className="photo-uploader__dropzone-row">
          <div className="photo-uploader__dropzone-text">
            <div className="photo-uploader__drop-hint">
              {t("photos.dragDropHint", "Drag and drop images here")}
            </div>

            <div className="photo-uploader__limit-hint">
              {t("photos.hint").includes("{max}")
                ? t("photos.hint").replace("{max}", String(max))
                : `${t("photos.hint")} ${max}`}
            </div>
          </div>

          <div className="photo-uploader__toolbar">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="btn btn-secondary photo-uploader__add-btn"
            >
              {uploading ? t("photos.uploading") : t("photos.addPhotos")}
            </button>
          </div>
        </div>
      </div>

      {errorText ? <div className="photo-uploader__error">{errorText}</div> : null}

      {previewItems.length ? (
        <>
          <div style={previewHintStyle}>{t("photos.previewOrderHint")}</div>
          <div className="photo-uploader__preview-list">
            {previewItems.map((item) => {
              const isSaved = item.kind === "saved";
              const isFirst = isSaved && item.index === 0;
              const isLast = isSaved && item.index === photosList.length - 1;
              const disableReorder = !isSaved;

              return (
                <div key={item.key} className="photo-uploader__row">
                  <div className="photo-uploader__media">
                    <div className="photo-uploader__thumb-wrap">
                      <img
                        src={
                          item.kind === "saved" ? item.photo?.url : item.pending?.previewUrl
                        }
                        alt="Photo preview"
                        className="photo-uploader__thumb"
                      />
                      {item.isCover ? (
                        <span className="photo-uploader__cover-badge">Cover</span>
                      ) : null}
                      {item.kind === "pending" && item.pending?.status === "uploading" ? (
                        <span className="photo-uploader__status photo-uploader__status--uploading">
                          {t("photos.uploading")}
                        </span>
                      ) : null}
                      {item.kind === "pending" && item.pending?.status === "failed" ? (
                        <span className="photo-uploader__status photo-uploader__status--failed">
                          Upload failed
                        </span>
                      ) : null}
                    </div>

                    <div className="photo-uploader__meta">
                      {item.kind === "pending" && item.fileName ? (
                        <div className="photo-uploader__filename" title={item.fileName}>
                          {item.fileName}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="photo-uploader__controls">
                    <div className="photo-uploader__reorder-controls">
                      <button
                        type="button"
                        className="photo-uploader__reorder-btn"
                        disabled={disableReorder || isFirst}
                        aria-label="Move photo up"
                        onClick={() =>
                          movePhotoByIndex(item.index, item.index - 1)
                        }
                      >
                        {"\u2191"}
                      </button>
                      <button
                        type="button"
                        className="photo-uploader__reorder-btn"
                        disabled={disableReorder || isLast}
                        aria-label="Move photo down"
                        onClick={() =>
                          movePhotoByIndex(item.index, item.index + 1)
                        }
                      >
                        {"\u2193"}
                      </button>
                    </div>
                    {item.kind === "saved" ? (
                      <button
                        type="button"
                        onClick={() => removePhoto(item.photo, item.index)}
                        disabled={uploading}
                        title={
                          item.photo?.id
                            ? t("photos.removeTitleSaved")
                            : t("photos.removeTitleLocal")
                        }
                        className="btn btn-secondary photo-uploader__remove-btn"
                      >
                        {t("photos.remove")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => removePendingItem(item.pending.tempId)}
                        disabled={item.pending?.status === "uploading"}
                        className="btn btn-secondary photo-uploader__remove-btn"
                      >
                        {t("photos.remove")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="photo-uploader__empty">{t("photos.empty")}</div>
      )}
    </div>
  );
}

