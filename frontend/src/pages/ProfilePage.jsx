import { useEffect, useMemo, useState } from "react";
import { http } from "../api/http";
import { Navigate, Link } from "react-router-dom";
import { clearAuth, getStoredUser } from "../auth/auth";
import { getErrorMessage } from "../api/getErrorMessage";
import { useI18n } from "../client/i18n/I18nContext";
import PasswordInput from "../components/PasswordInput";
import "./ProfilePage.css";

export default function ProfilePage() {
  const storedUser = getStoredUser();
  const { t } = useI18n();

  const [profile, setProfile] = useState(null);

  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState("");
  const [infoText, setInfoText] = useState("");

  const [redirectToLogin, setRedirectToLogin] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const displayNameTrim = displayName.trim();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const canSaveName = useMemo(() => {
    if (!profile) return false;
    if (displayNameTrim.length < 3) return false;
    return displayNameTrim !== String(profile.displayName || "").trim();
  }, [profile, displayNameTrim]);

  const canChangePassword = useMemo(() => {
    if (!currentPassword || !newPassword || !confirmPassword) return false;
    if (newPassword.trim().length < 8) return false;
    if (newPassword !== confirmPassword) return false;
    return true;
  }, [currentPassword, newPassword, confirmPassword]);

  function isWrongCurrentPasswordError(err) {
    const status = err?.response?.status;
    if (status !== 401) return false;

    const payload = err?.response?.data;
    const code = payload?.error?.code || payload?.code;
    const message = String(
      payload?.error?.message || payload?.message || payload?.error || "",
    ).toLowerCase();

    if (code === "UNAUTHORIZED" && message.includes("wrong password")) {
      return true;
    }

    return message.includes("wrong password");
  }

  async function loadProfile() {
    setLoading(true);
    setErrorText("");
    setInfoText("");

    try {
      const res = await http.get("/me");
      const user = res.data.user;
      setProfile(user);
      setDisplayName(user?.displayName || "");

      if (user) {
        localStorage.setItem("user", JSON.stringify(user));
        window.dispatchEvent(new Event("authChanged"));
      }
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) {
        clearAuth();
        setRedirectToLogin(true);
        return;
      }
      setErrorText(getErrorMessage(err, t("profile.errors.loadFailed"), t));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveProfile() {
    setErrorText("");
    setInfoText("");

    if (displayNameTrim.length < 3) {
      setErrorText(t("profile.errors.displayNameMin"));
      return;
    }

    try {
      setInfoText(t("profile.info.saving"));
      const res = await http.patch("/me", { displayName: displayNameTrim });
      const user = res.data.user;

      setProfile(user);
      setDisplayName(user?.displayName || "");

      if (user) {
        localStorage.setItem("user", JSON.stringify(user));
        window.dispatchEvent(new Event("authChanged"));
      }

      setInfoText(t("profile.info.nameChanged"));
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401) {
        clearAuth();
        setRedirectToLogin(true);
        return;
      }
      setErrorText(getErrorMessage(err, t("common.saveFailed"), t));
      setInfoText("");
    }
  }

  async function changePassword() {
    setErrorText("");
    setInfoText("");

    const next = newPassword.trim();

    if (!currentPassword) {
      setErrorText(t("profile.errors.currentPasswordRequired"));
      return;
    }
    if (next.length < 8) {
      setErrorText(t("profile.errors.newPasswordMin"));
      return;
    }
    if (next !== confirmPassword) {
      setErrorText(t("profile.errors.passwordMismatch"));
      return;
    }

    try {
      setInfoText(t("profile.info.changingPassword"));
      await http.patch("/me/password", { currentPassword, newPassword: next });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      setInfoText(t("profile.info.passwordChanged"));
    } catch (err) {
      const status = err?.response?.status;

      if (isWrongCurrentPasswordError(err)) {
        setErrorText(
          t("profile.errors.invalidCurrentPassword") ||
            "Incorrect current password",
        );
        setInfoText("");
        return;
      }

      if (status === 401) {
        clearAuth();
        setRedirectToLogin(true);
        return;
      }

      setErrorText(
        getErrorMessage(err, t("profile.errors.changePasswordFailed"), t),
      );
      setInfoText("");
    }
  }

  if (redirectToLogin) return <Navigate to="/login" replace />;
  if (!storedUser) return <Navigate to="/login" replace />;
  const summaryName =
    profile?.displayName || storedUser.displayName || storedUser.email;
  const summaryEmail = profile?.email || storedUser.email;
  const summaryRole = profile?.role || storedUser.role;
  const avatarLetter = String(summaryName || "").trim().charAt(0).toUpperCase();
  const hasFeedback = Boolean(errorText || infoText);

  return (
    <div className="page profile-page">
      <div className="container profile-page__container">
        <div className="profile-page__top">
          <div className="profile-page__back-row">
            <Link to="/" className="btn btn-secondary profile-page__back-btn">
              {t("profile.back")}
            </Link>
          </div>
          <div className="profile-page__top-avatar">
            <div className="profile-avatar">{avatarLetter || "?"}</div>
          </div>
        </div>

        <header className="profile-page__header">
          <div className="profile-page__header-surface">
            <h1 className="page-title profile-page__title">{t("profilePage.title")}</h1>
          </div>

          {hasFeedback ? (
            <div className="profile-feedback-slot">
              {errorText ? (
                <div className="profile-alert profile-alert--error">
                  <span className="profile-alert__text">{errorText}</span>
                </div>
              ) : (
                <div className="profile-alert profile-alert--info">
                  <span className="profile-alert__text">{infoText}</span>
                </div>
              )}
            </div>
          ) : null}
        </header>

        {loading ? (
          <div className="profile-loading">{t("common.loading")}</div>
        ) : null}

        {!loading && profile ? (
          <div className={`profile-content ${hasFeedback ? "profile-content--with-feedback" : ""}`}>
            <div className="profile-layout">
              <aside className="profile-card profile-summary-card">
                <h3 className="profile-summary-name">{summaryName}</h3>
                <div className="profile-summary-email">{summaryEmail}</div>
                <div className="chip profile-summary-role">
                  {t(`roles.${summaryRole}`, summaryRole)}
                </div>

                <div className="profile-divider" />
                <div className="profile-section profile-section--editable">
                  <div className="profile-section__title">{t("profile.displayName")}</div>
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="profile-input"
                  />
                  <div className="text-muted profile-section__helper">
                    {t("profile.minLen3")}
                  </div>
                  <div className="profile-actions">
                    <button
                      onClick={saveProfile}
                      disabled={!canSaveName || loading}
                      className="profile-btn profile-btn--primary"
                    >
                      {t("profile.save")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDisplayName(profile.displayName || "")}
                      disabled={loading}
                      className="profile-btn profile-btn--secondary"
                    >
                      {t("profile.resetName")}
                    </button>
                  </div>
                </div>
              </aside>

              <div className="profile-card profile-action-card">
                <h3 className="profile-card__title">{t("profile.changePasswordTitle")}</h3>

                <div className="profile-security-body">
                  <div className="profile-security-fields">
                    <PasswordInput
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder={t("profile.currentPassword")}
                      className="profile-input"
                    />

                    <PasswordInput
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={t("profile.newPasswordMin8")}
                      className="profile-input"
                    />

                    <PasswordInput
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder={t("profile.confirmNewPassword")}
                      className="profile-input"
                    />
                  </div>

                  <div className="profile-actions">
                    <button
                      onClick={changePassword}
                      disabled={!canChangePassword || loading}
                      className="profile-btn profile-btn--primary"
                    >
                      {t("profile.changePasswordBtn")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentPassword("");
                        setNewPassword("");
                        setConfirmPassword("");
                        setErrorText("");
                        setInfoText("");
                      }}
                      disabled={loading}
                      className="profile-btn profile-btn--secondary"
                    >
                      {t("profile.clear")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
