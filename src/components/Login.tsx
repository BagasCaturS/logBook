import { useEffect, useRef, useState } from "react";
import { t, type Lang } from "../lib/i18n";
import ConnectionForm from "./ConnectionForm";
import {
  IconMail,
  IconLock,
  IconEye,
  IconEyeOff,
  IconCheck,
  IconCloud,
  IconDatabase,
  IconArrowRight,
} from "./icons";

interface Props {
  lang: Lang;
  mode: "supabase" | "local";
  initialUrl: string;
  initialKey: string;
  connOpen: boolean;
  onToggleConn: () => void;
  onChangeConnection: (url: string, key: string) => void;
  onCheckEmail: (email: string) => Promise<boolean | null>;
  onLogin: (email: string, password: string, mode: "login" | "signup") => Promise<string | null>;
  onLocalLogin: (password: string) => Promise<string | null>;
  onCreateLocalPassword: (password: string) => Promise<string | null>;
  onSwitchMode: (toLocal: boolean) => Promise<void>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login({
  lang,
  mode,
  initialUrl,
  initialKey,
  connOpen,
  onToggleConn,
  onChangeConnection,
  onCheckEmail,
  onLogin,
  onLocalLogin,
  onCreateLocalPassword,
  onSwitchMode,
}: Props) {
  // Supabase mode state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [emailCheck, setEmailCheck] = useState<"idle" | "checking" | "taken" | "available" | "unknown">("idle");
  const [showPassword, setShowPassword] = useState(false);
  const emailTimer = useRef<number | null>(null);

  // Local mode state
  const [localMode, setLocalMode] = useState<"login" | "createPassword" | "changePassword">("login");
  const [localPassword, setLocalPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [localBusy, setLocalBusy] = useState(false);
  const [localInfo, setLocalInfo] = useState<string | null>(null);
  const [showLocalPassword, setShowLocalPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    return () => {
      if (emailTimer.current) window.clearTimeout(emailTimer.current);
    };
  }, []);

  function handleEmailChange(value: string) {
    setEmail(value);
    if (emailTimer.current) window.clearTimeout(emailTimer.current);
    const e = value.trim();
    if (authMode !== "signup" || !EMAIL_RE.test(e)) {
      setEmailCheck("idle");
      return;
    }
    setEmailCheck("checking");
    emailTimer.current = window.setTimeout(() => {
      void onCheckEmail(e).then((r) => {
        if (r === null) setEmailCheck("unknown");
        else setEmailCheck(r ? "taken" : "available");
      });
    }, 600);
  }

  function switchAuthMode() {
    if (emailTimer.current) window.clearTimeout(emailTimer.current);
    setAuthMode((m) => (m === "login" ? "signup" : "login"));
    setEmailCheck("idle");
    setError(null);
  }

  async function submit() {
    if (!email || !password) {
      setError(t(lang, "login.errEmpty"));
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const err = await onLogin(email.trim(), password, authMode);
      if (err) setError(err);
      else if (authMode === "signup") {
        setInfo(t(lang, "login.infoSignup"));
        setAuthMode("login");
        setEmailCheck("idle");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleLocalSubmit() {
    if (localMode === "createPassword" || localMode === "changePassword") {
      if (!localPassword || !confirmPassword) {
        setLocalError(t(lang, "login.errEmpty"));
        return;
      }
      if (localPassword !== confirmPassword) {
        setLocalError(t(lang, "settings.passwordMismatch"));
        return;
      }
      if (localPassword.length < 6) {
        setLocalError(t(lang, "settings.passwordTooShort"));
        return;
      }
      setLocalBusy(true);
      setLocalError(null);
      setLocalInfo(null);
      try {
        const err = await onCreateLocalPassword(localPassword);
        if (err) setLocalError(err);
        else setLocalInfo(t(lang, "settings.passwordChanged"));
      } finally {
        setLocalBusy(false);
      }
      return;
    }

    // local login
    if (!localPassword) {
      setLocalError(t(lang, "login.errEmpty"));
      return;
    }
    setLocalBusy(true);
    setLocalError(null);
    setLocalInfo(null);
    try {
      const err = await onLocalLogin(localPassword);
      if (err) setLocalError(err);
    } finally {
      setLocalBusy(false);
    }
  }

  function switchLocalMode(newMode: "login" | "createPassword" | "changePassword") {
    setLocalMode(newMode);
    setLocalError(null);
    setLocalInfo(null);
    setLocalPassword("");
    setConfirmPassword("");
    setShowLocalPassword(false);
    setShowConfirmPassword(false);
  }

  const isSupabaseMode = mode === "supabase";

  return (
    <div className="login-page" key={mode}>
      <div className="login-container">
        {/* Mode Switcher */}
        <div className="mode-switcher" role="group" aria-label={t(lang, "login.modeToggle")}>
          <button
            type="button"
            className={`mode-btn ${mode === "supabase" ? "active" : ""}`}
            onClick={() => void onSwitchMode(false)}
            disabled={busy || localBusy}
            aria-pressed={mode === "supabase"}
          >
            <IconCloud size={18} />
            <span>{t(lang, "login.supabaseSwitch")}</span>
            <span className="mode-desc">{t(lang, "login.cloudModeDesc")}</span>
          </button>
          <button
            type="button"
            className={`mode-btn ${mode === "local" ? "active" : ""}`}
            onClick={() => void onSwitchMode(true)}
            disabled={busy || localBusy}
            aria-pressed={mode === "local"}
          >
            <IconDatabase size={18} />
            <span>{t(lang, "login.localSwitch")}</span>
            <span className="mode-desc">{t(lang, "login.localModeDesc")}</span>
          </button>
        </div>

        {isSupabaseMode ? (
          <div className="login-card" key={authMode}>
            <div className="login-header">
              <div className="login-icon">
                <IconCloud size={32} />
              </div>
              <h1>{authMode === "login" ? t(lang, "login.welcomeBack") : t(lang, "login.createAccount")}</h1>
              <p className="login-subtitle">
                {authMode === "login"
                  ? t(lang, "login.enterCredentials")
                  : t(lang, "login.createAccount")}
              </p>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); void submit(); }} noValidate>
              <div className="form-group">
                <label htmlFor="email" className="form-label">
                  <IconMail size={16} className="input-icon" />
                  <span>{t(lang, "login.email")}</span>
                </label>
                <div className="input-wrapper">
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    autoFocus
                    autoComplete="email"
                    placeholder={t(lang, "login.email")}
                    disabled={busy}
                    aria-describedby={emailCheck === "checking" ? "email-checking" : emailCheck === "taken" ? "email-taken" : emailCheck === "available" ? "email-available" : undefined}
                    aria-invalid={emailCheck === "taken"}
                  />
                  {authMode === "signup" && emailCheck !== "idle" && (
                    <div className="input-feedback" role="status" aria-live="polite">
                      {emailCheck === "checking" && (
                        <span id="email-checking" className="checking">
                          <span className="spinner" aria-hidden="true"></span>
                          {t(lang, "login.emailChecking")}
                        </span>
                      )}
                      {emailCheck === "taken" && (
                        <span id="email-taken" className="error">
                          <IconCheck size={14} /> {t(lang, "login.emailTaken")}
                          <button type="button" className="link" onClick={switchAuthMode}>
                            {t(lang, "login.loginLink")}
                          </button>
                        </span>
                      )}
                      {emailCheck === "available" && (
                        <span id="email-available" className="success">
                          <IconCheck size={14} /> {t(lang, "login.emailAvailable")}
                        </span>
                      )}
                      {emailCheck === "unknown" && (
                        <span className="warning">{t(lang, "login.emailChecking")}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="password" className="form-label">
                  <IconLock size={16} className="input-icon" />
                  <span>{t(lang, "login.password")}</span>
                </label>
                <div className="input-wrapper">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                    autoComplete={authMode === "login" ? "current-password" : "new-password"}
                    placeholder={t(lang, "login.password")}
                    disabled={busy}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? t(lang, "login.hidePassword") : t(lang, "login.showPassword")}
                    aria-pressed={showPassword}
                    disabled={busy}
                  >
                    {showPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="alert error" role="alert">
                  {error}
                </div>
              )}

              {info && (
                <div className="alert success" role="status">
                  {info}
                </div>
              )}

              <div className="form-options">
                {authMode === "login" && (
                  <label className="checkbox-wrapper">
                    <input type="checkbox" />
                    <span>{t(lang, "login.rememberMe")}</span>
                  </label>
                )}
                {authMode === "login" && (
                  <a href="#" className="forgot-link">{t(lang, "login.forgotPassword")}</a>
                )}
              </div>

              <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
                {busy ? (
                  <>
                    <span className="btn-spinner" aria-hidden="true"></span>
                    {t(lang, "login.processing")}
                  </>
                ) : (
                  authMode === "login" ? t(lang, "login.title") : t(lang, "login.signupTitle")
                )}
              </button>
            </form>

            <div className="auth-switch">
              <p className="auth-switch-text">
                {authMode === "login" ? t(lang, "login.noAccount") : t(lang, "login.haveAccount")}
                <button type="button" className="link" onClick={switchAuthMode}>
                  {authMode === "login" ? t(lang, "login.signupLink") : t(lang, "login.loginLink")}
                </button>
              </p>
            </div>

            {/* Connection Panel */}
            <div className="conn-block">
              <button
                className="conn-toggle"
                onClick={onToggleConn}
                aria-expanded={connOpen}
                aria-controls="conn-panel"
              >
                <span>{t(lang, "login.changeConnection")}</span>
                <span className={`conn-caret${connOpen ? " open" : ""}`} aria-hidden>
                  ▸
                </span>
              </button>
              {connOpen && (
                <div className="conn-panel" id="conn-panel" role="region" aria-label={t(lang, "settings.connectionNote")}>
                  <p className="hint">{t(lang, "settings.connectionNote")}</p>
                  <ConnectionForm
                    initialUrl={initialUrl}
                    initialKey={initialKey}
                    lang={lang}
                    onSave={onChangeConnection}
                  />
                </div>
              )}
            </div>

            <p className="login-credit">{t(lang, "login.credit")}</p>
          </div>
        ) : (
          <div className="login-card" key={localMode}>
            <div className="login-header">
              <div className="login-icon local">
                <IconDatabase size={32} />
              </div>
              <h1>{t(lang, "login.localTitle")}</h1>
              <p className="login-subtitle">
                {localMode === "login"
                  ? t(lang, "login.setupLocal")
                  : localMode === "createPassword"
                  ? t(lang, "login.createPassword")
                  : t(lang, "settings.changeLocalPassword")}
              </p>
              <p className="local-hint">{t(lang, "login.localModeDesc")}</p>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); void handleLocalSubmit(); }} noValidate>
              {localMode === "createPassword" && (
                <>
                  <div className="form-group">
                    <label htmlFor="localPassword" className="form-label">
                      <IconLock size={16} className="input-icon" />
                      <span>{t(lang, "login.password")}</span>
                    </label>
                    <div className="input-wrapper">
                      <input
                        id="localPassword"
                        type={showLocalPassword ? "text" : "password"}
                        value={localPassword}
                        onChange={(e) => setLocalPassword(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => e.key === "Enter" && handleLocalSubmit()}
                        autoComplete="new-password"
                        placeholder={t(lang, "login.passwordHint")}
                        disabled={localBusy}
                        aria-describedby="password-hint"
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowLocalPassword(!showLocalPassword)}
                        aria-label={showLocalPassword ? t(lang, "login.hidePassword") : t(lang, "login.showPassword")}
                        aria-pressed={showLocalPassword}
                        disabled={localBusy}
                      >
                        {showLocalPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                      </button>
                    </div>
                    <p id="password-hint" className="field-hint">{t(lang, "login.passwordHint")}</p>
                  </div>

                  <div className="form-group">
                    <label htmlFor="confirmPassword" className="form-label">
                      <IconLock size={16} className="input-icon" />
                      <span>{t(lang, "login.confirmPassword")}</span>
                    </label>
                    <div className="input-wrapper">
                      <input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleLocalSubmit()}
                        autoComplete="new-password"
                        placeholder={t(lang, "login.confirmPassword")}
                        disabled={localBusy}
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        aria-label={showConfirmPassword ? t(lang, "login.hidePassword") : t(lang, "login.showPassword")}
                        aria-pressed={showConfirmPassword}
                        disabled={localBusy}
                      >
                        {showConfirmPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                      </button>
                    </div>
                  </div>

                  {localError && (
                    <div className="alert error" role="alert">
                      {localError}
                    </div>
                  )}
                  {localInfo && (
                    <div className="alert success" role="status">
                      {localInfo}
                    </div>
                  )}

                  <button type="submit" className="btn btn-primary btn-block" disabled={localBusy}>
                    {localBusy ? (
                      <>
                        <span className="btn-spinner" aria-hidden="true"></span>
                        {t(lang, "login.processing")}
                      </>
                    ) : (
                      t(lang, "login.createPassword")
                    )}
                  </button>
                </>
              )}

              {localMode === "changePassword" && (
                <>
                  <div className="form-group">
                    <label htmlFor="currentPassword" className="form-label">
                      <IconLock size={16} className="input-icon" />
                      <span>{t(lang, "settings.currentPassword")}</span>
                    </label>
                    <div className="input-wrapper">
                      <input
                        id="currentPassword"
                        type={showLocalPassword ? "text" : "password"}
                        value={localPassword}
                        onChange={(e) => setLocalPassword(e.target.value)}
                        autoFocus
                        autoComplete="current-password"
                        placeholder={t(lang, "settings.currentPassword")}
                        disabled={localBusy}
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowLocalPassword(!showLocalPassword)}
                        aria-label={showLocalPassword ? t(lang, "login.hidePassword") : t(lang, "login.showPassword")}
                        aria-pressed={showLocalPassword}
                        disabled={localBusy}
                      >
                        {showLocalPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="newLocalPassword" className="form-label">
                      <IconLock size={16} className="input-icon" />
                      <span>{t(lang, "settings.newLocalPassword")}</span>
                    </label>
                    <div className="input-wrapper">
                      <input
                        id="newLocalPassword"
                        type={showLocalPassword ? "text" : "password"}
                        value={localPassword}
                        onChange={(e) => setLocalPassword(e.target.value)}
                        autoComplete="new-password"
                        placeholder={t(lang, "settings.newLocalPassword")}
                        disabled={localBusy}
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowLocalPassword(!showLocalPassword)}
                        aria-label={showLocalPassword ? t(lang, "login.hidePassword") : t(lang, "login.showPassword")}
                        aria-pressed={showLocalPassword}
                        disabled={localBusy}
                      >
                        {showLocalPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label htmlFor="confirmNewPassword" className="form-label">
                      <IconLock size={16} className="input-icon" />
                      <span>{t(lang, "settings.confirmLocalPassword")}</span>
                    </label>
                    <div className="input-wrapper">
                      <input
                        id="confirmNewPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                        placeholder={t(lang, "settings.confirmLocalPassword")}
                        disabled={localBusy}
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        aria-label={showConfirmPassword ? t(lang, "login.hidePassword") : t(lang, "login.showPassword")}
                        aria-pressed={showConfirmPassword}
                        disabled={localBusy}
                      >
                        {showConfirmPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                      </button>
                    </div>
                  </div>

                  {localError && (
                    <div className="alert error" role="alert">
                      {localError}
                    </div>
                  )}
                  {localInfo && (
                    <div className="alert success" role="status">
                      {localInfo}
                    </div>
                  )}

                  <button type="submit" className="btn btn-primary btn-block" disabled={localBusy}>
                    {localBusy ? (
                      <>
                        <span className="btn-spinner" aria-hidden="true"></span>
                        {t(lang, "login.processing")}
                      </>
                    ) : (
                      t(lang, "settings.changeLocalPassword")
                    )}
                  </button>
                </>
              )}

              {localMode === "login" && (
                <>
                  <div className="form-group">
                    <label htmlFor="localPassword" className="form-label">
                      <IconLock size={16} className="input-icon" />
                      <span>{t(lang, "login.password")}</span>
                    </label>
                    <div className="input-wrapper">
                      <input
                        id="localPassword"
                        type={showLocalPassword ? "text" : "password"}
                        value={localPassword}
                        onChange={(e) => setLocalPassword(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => e.key === "Enter" && handleLocalSubmit()}
                        autoComplete="current-password"
                        placeholder={t(lang, "login.password")}
                        disabled={localBusy}
                      />
                      <button
                        type="button"
                        className="password-toggle"
                        onClick={() => setShowLocalPassword(!showLocalPassword)}
                        aria-label={showLocalPassword ? t(lang, "login.hidePassword") : t(lang, "login.showPassword")}
                        aria-pressed={showLocalPassword}
                        disabled={localBusy}
                      >
                        {showLocalPassword ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                      </button>
                    </div>
                  </div>

                  {localError && (
                    <div className="alert error" role="alert">
                      {localError}
                    </div>
                  )}
                  {localInfo && (
                    <div className="alert success" role="status">
                      {localInfo}
                    </div>
                  )}

                  <button type="submit" className="btn btn-primary btn-block" disabled={localBusy}>
                    {localBusy ? (
                      <>
                        <span className="btn-spinner" aria-hidden="true"></span>
                        {t(lang, "login.processing")}
                      </>
                    ) : (
                      t(lang, "login.title")
                    )}
                  </button>
                </>
              )}

              <div className="local-actions">
                {localMode === "login" && (
                  <>
                    <button type="button" className="link" onClick={() => switchLocalMode("createPassword")}>
                      {t(lang, "login.createPassword")}
                    </button>
                    <button type="button" className="link" onClick={() => void onSwitchMode(false)}>
                      <IconArrowRight size={14} /> {t(lang, "login.supabaseSwitch")}
                    </button>
                  </>
                )}
                {localMode === "createPassword" && (
                  <button type="button" className="link" onClick={() => switchLocalMode("login")}>
                    <IconArrowRight size={14} /> {t(lang, "login.title")}
                  </button>
                )}
                {localMode === "changePassword" && (
                  <button type="button" className="link" onClick={() => switchLocalMode("login")}>
                    <IconArrowRight size={14} /> {t(lang, "login.title")}
                  </button>
                )}
              </div>

              <p className="login-credit">{t(lang, "login.credit")}</p>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}