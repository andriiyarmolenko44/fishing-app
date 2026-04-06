import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register } from "../auth/auth";
import { getErrorMessage } from "../api/getErrorMessage";
import { useI18n } from "../client/i18n/I18nContext";
import PasswordInput from "../components/PasswordInput";
import "./RegisterPage.css";

function isValidEmail(emailValue) {
  const e = String(emailValue || "").trim();

  if (!/^[\u0021-\u007E]+$/.test(e)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function isValidDisplayName(displayNameValue) {
  const regexForDisplayName = /^[a-zA-Z0-9._]{3,30}$/;
  return regexForDisplayName.test(displayNameValue);
}

function FieldError({ msg }) {
  if (!msg) return null;
  return <div className="error-text register-page__field-error">{msg}</div>;
}

export default function RegisterPage() {
  const nav = useNavigate();
  const { t } = useI18n();

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("USER");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const [termsError, setTermsError] = useState("");

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({
    email: "",
    displayName: "",
    password: "",
    confirmPassword: "",
    form: "",
  });

  function validate() {
    const next = {
      email: "",
      displayName: "",
      password: "",
      confirmPassword: "",
      form: "",
    };

    const emailTrim = email.trim().toLowerCase();
    const displayNameTrim = displayName.trim();

    if (!emailTrim) next.email = t("auth.errors.emailRequired");
    else if (!isValidEmail(emailTrim)) next.email = t("auth.errors.invalidEmail");

    if (!displayNameTrim) next.displayName = t("auth.errors.displayNameRequired");
    else if (!isValidDisplayName(displayNameTrim))
      next.displayName = t("auth.errors.invalidDisplayName");

    if (!password) next.password = t("auth.errors.passwordRequired");
    else if (password.length < 8) next.password = t("auth.errors.passwordMin");

    if (!confirmPassword) next.confirmPassword = t("auth.errors.confirmPasswordRequired");
    else if (password !== confirmPassword)
      next.confirmPassword = t("auth.errors.passwordMismatch");

    const nextTermsError = acceptedTerms ? "" : t("auth.terms.validationError");

    setErrors(next);
    setTermsError(nextTermsError);
    return (
      !next.email &&
      !next.displayName &&
      !next.password &&
      !next.confirmPassword &&
      !nextTermsError
    );
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErrors((p) => ({ ...p, form: "" }));

    if (!validate()) return;

    const emailTrim = email.trim().toLowerCase();
    const displayNameTrim = displayName.trim();

    try {
      setLoading(true);
      await register({
        email: emailTrim,
        password,
        displayName: displayNameTrim,
        role,
      });
      nav("/");
    } catch (err) {
      setErrors((p) => ({
        ...p,
        form: getErrorMessage(err, t("auth.errors.registrationFailed")),
      }));
    } finally {
      setLoading(false);
    }
  }

  const termsLabel = t("auth.terms.checkboxLabel");
  const termsLinkText = t("auth.terms.linkText");
  const termsTitle = t("auth.terms.title");
  const termsParagraphsValue = t("auth.terms.paragraphs", []);
  const termsParagraphs = Array.isArray(termsParagraphsValue) ? termsParagraphsValue : [];
  const [termsPrefix, termsSuffix = ""] = termsLabel.includes(termsLinkText)
    ? termsLabel.split(termsLinkText)
    : [termsLabel, ""];

  return (
    <div className="page register-page">
      <div className="container register-page__container">
        <section className="register-page__brand">
          <div className="register-page__brand-surface">
            <h1 className="register-page__brand-title">fishing-app</h1>
            <p className="register-page__brand-subtitle">{t("auth.registerBrandSubtitle")}</p>
          </div>
        </section>

        <section className="card register-page__card">
          <h2 className="section-title register-page__form-title">{t("auth.registerTitle")}</h2>

          <form onSubmit={onSubmit} className="register-page__form">
            <div className="register-page__field">
              <input
                placeholder={t("auth.emailPlaceholder")}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((p) => ({ ...p, email: "" }));
                }}
                className={`input${errors.email ? " register-page__input--error" : ""}`}
              />
              <FieldError msg={errors.email} />
            </div>

            <div className="register-page__field">
              <input
                placeholder={t("auth.displayNamePlaceholder")}
                value={displayName}
                onChange={(e) => {
                  setDisplayName(e.target.value);
                  if (errors.displayName) setErrors((p) => ({ ...p, displayName: "" }));
                }}
                className={`input${errors.displayName ? " register-page__input--error" : ""}`}
              />
              <FieldError msg={errors.displayName} />
            </div>

            <div className="register-page__field">
              <PasswordInput
                placeholder={t("auth.passwordPlaceholder")}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((p) => ({ ...p, password: "" }));
                }}
                className={`input${errors.password ? " register-page__input--error" : ""}`}
              />
              <FieldError msg={errors.password} />
            </div>

            <div className="register-page__field">
              <PasswordInput
                placeholder={t("auth.confirmPasswordPlaceholder")}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (errors.confirmPassword)
                    setErrors((p) => ({ ...p, confirmPassword: "" }));
                }}
                className={`input${errors.confirmPassword ? " register-page__input--error" : ""}`}
              />
              <FieldError msg={errors.confirmPassword} />
            </div>

            <select value={role} onChange={(e) => setRole(e.target.value)} className="select">
              <option value="USER">{t("roles.USER", "USER")}</option>
              <option value="OWNER">{t("roles.OWNER", "OWNER")}</option>
            </select>

            <div className="terms-consent register-page__terms">
              <label className="terms-consent-label register-page__terms-label">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => {
                    const nextAccepted = e.target.checked;
                    setAcceptedTerms(nextAccepted);
                    if (nextAccepted && termsError) setTermsError("");
                  }}
                />
                <span className="terms-consent-text">
                  {termsPrefix}
                  <button
                    type="button"
                    className="terms-link register-page__terms-link"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setTermsOpen((prev) => !prev);
                    }}
                  >
                    {termsLinkText}
                  </button>
                  {termsSuffix}
                </span>
              </label>

              <FieldError msg={termsError} />

              {termsOpen ? (
                <div
                  className="terms-modal-overlay register-page__terms-modal-overlay"
                  onClick={() => setTermsOpen(false)}
                  role="presentation"
                >
                  <div
                    className="terms-modal register-page__terms-modal"
                    role="dialog"
                    aria-modal="true"
                    aria-label={termsTitle}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="terms-modal-title register-page__terms-modal-title">
                      {termsTitle}
                    </div>
                    {termsParagraphs.map((paragraph, index) => (
                      <p key={`terms-paragraph-${index}`} className="terms-modal-content">
                        {paragraph}
                      </p>
                    ))}
                    <button
                      type="button"
                      className="btn btn-secondary terms-modal-close"
                      onClick={() => setTermsOpen(false)}
                    >
                      {t("auth.terms.close")}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>

            <button
              disabled={loading || !acceptedTerms}
              className="btn btn-primary register-page__submit"
            >
              {loading ? t("common.loadingShort") : t("auth.createAccount")}
            </button>

            {errors.form ? <div className="error-text">{errors.form}</div> : null}
          </form>

          <div className="register-page__footer-text">
            {t("auth.haveAccount")} <Link to="/login">{t("nav.login")}</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
