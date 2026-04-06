import { useEffect, useMemo, useState } from "react";
import { http } from "../api/http";
import { getStoredUser } from "../auth/auth";
import { Link } from "react-router-dom";
import { useI18n } from "../client/i18n/I18nContext";

import CreateLocationForm from "../components/owner/CreateLocationForm";
import MyLocationsList from "../components/owner/MyLocationsList";
import { getErrorMessage } from "../api/getErrorMessage";
import "./OwnerDashboardPage.css";

const LIMIT = 12;

export default function OwnerDashboardPage() {
  const user = getStoredUser();
  const { t } = useI18n();

  const [activeTab, setActiveTab] = useState("LIST");

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(total / LIMIT)),
    [total],
  );

  const [editingId, setEditingId] = useState(null);
  const createOpen = activeTab === "CREATE";

  async function loadMyLocations(pageArg = page) {
    const res = await http.get("/owner/locations", {
      params: { page: pageArg, limit: LIMIT },
    });

    if (res.data && Array.isArray(res.data.items)) {
      setItems(res.data.items);
      setTotal(res.data.total || 0);
      return;
    }

    const arr = res.data.items || res.data || [];
    setItems(arr);
    setTotal(Array.isArray(arr) ? arr.length : 0);
  }

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");
        setEditingId(null);
        setPage(1);
        await loadMyLocations(1);
      } catch (err) {
        if (!cancelled)
          setError(
            getErrorMessage(err, t("owner.errors.loadLocationsFailed"), t),
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!createOpen) return;

    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [createOpen]);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      await loadMyLocations(page);
    } catch (e) {
      setError(getErrorMessage(e, t("owner.errors.loadLocationsFailed"), t));
    } finally {
      setLoading(false);
    }
  }

  async function onCreate(payload) {
    const safePayload = { ...payload };

    try {
      setError("");
      await http.post("/locations", safePayload);
      setActiveTab("LIST");
      await refresh();
    } catch (e) {
      setError(getErrorMessage(e, t("owner.errors.createLocationFailed"), t));
      throw e;
    }
  }

  function startEdit(loc) {
    setEditingId(loc.id);
    setActiveTab("LIST");
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function onSaveEdit(id, payload) {
    try {
      setError("");
      await http.patch(`/owner/locations/${id}`, payload);
      await refresh();
      setEditingId(null);
    } catch (e) {
      setError(getErrorMessage(e, t("owner.errors.updateLocationFailed"), t));
      throw e;
    }
  }

  async function onToggleHidden(loc) {
    try {
      setError("");
      const path =
        loc.status === "HIDDEN"
          ? `/owner/locations/${loc.id}/unhide`
          : `/owner/locations/${loc.id}/hide`;

      await http.post(path);
      await refresh();
    } catch (e) {
      setError(getErrorMessage(e, t("owner.errors.updateStatusFailed"), t));
    }
  }

  async function goNext() {
    const next = page + 1;
    setPage(next);
    setLoading(true);
    setError("");
    setEditingId(null);

    try {
      await loadMyLocations(next);
    } catch (e) {
      setError(getErrorMessage(e, t("owner.errors.loadLocationsFailed"), t));
    } finally {
      setLoading(false);
    }
  }

  async function goPrev() {
    const prev = page - 1;
    setPage(prev);
    setLoading(true);
    setError("");
    setEditingId(null);

    try {
      await loadMyLocations(prev);
    } catch (e) {
      setError(getErrorMessage(e, t("owner.errors.loadLocationsFailed"), t));
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingId(null);
    setActiveTab("CREATE");
  }

  function closeCreateModal() {
    setActiveTab("LIST");
  }

  if (!user) return <div className="owner-page__guard">{t("owner.authRequired")}</div>;
  if (user.role !== "OWNER")
    return <div className="owner-page__guard">{t("owner.ownerOnly")}</div>;

  return (
    <div className="page owner-page">
      <div className="container owner-page__container">
        <div className="owner-page__top">
          <div className="owner-page__back-row">
            <Link to="/" className="btn btn-secondary owner-page__back-btn">
              {t("profile.back")}
            </Link>
          </div>
          <div className="owner-page__top-actions">
            <button
              onClick={openCreateModal}
              disabled={loading}
              className="btn btn-primary owner-page__header-action"
            >
              {t("owner.tabs.create")}
            </button>
          </div>
        </div>

        <header className="owner-page__header">
          <div className="owner-page__header-surface">
            <h1 className="page-title owner-page__title">{t("owner.title")}</h1>
            <div className="text-muted owner-page__summary">
              {t("owner.summary.totalLabel")} {total}
            </div>
          </div>
        </header>

        {error ? (
          <div className="owner-page__error">{error}</div>
        ) : null}

        <MyLocationsList
          items={items}
          loading={loading}
          error={error}
          page={page}
          total={total}
          totalPages={totalPages}
          onPrev={goPrev}
          onNext={goNext}
          onRefresh={refresh}
          editingId={editingId}
          onStartEdit={startEdit}
          onCancelEdit={cancelEdit}
          onSaveEdit={onSaveEdit}
          onToggleHidden={onToggleHidden}
        />

        {createOpen ? (
          <div
            className="owner-page__create-modal-overlay"
            onClick={closeCreateModal}
            role="presentation"
          >
            <div
              className="owner-page__create-modal"
              role="dialog"
              aria-modal="true"
              aria-label={t("owner.tabs.create")}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="owner-page__create-modal-title">
                {t("owner.tabs.create")}
              </div>

              <div className="owner-page__create-modal-content">
                <CreateLocationForm
                  onCreate={onCreate}
                  onCancel={closeCreateModal}
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
