import { useEffect, useRef, useState } from "react";
import { t, type Lang } from "../lib/i18n";
import ConnectionForm from "./ConnectionForm";

interface Props {
  lang: Lang;
  initialUrl: string;
  initialKey: string;
  connOpen: boolean;
  onToggleConn: () => void;
  onChangeConnection: (url: string, key: string) => void;
  onCheckEmail: (email: string) => Promise<boolean | null>;
  onLogin: (email: string, password: string, mode: "login" | "signup") => Promise<string | null>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type EmailCheck = "idle" | "checking" | "taken" | "available" | "unknown";

export default function Login({
  lang,
  initialUrl,
  initialKey,
  connOpen,
  onToggleConn,
  onChangeConnection,
  onCheckEmail,
  onLogin,
}: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);
  const [emailCheck, setEmailCheck] = useState<EmailCheck>("idle");
  const emailTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (emailTimer.current) window.clearTimeout(emailTimer.current);
    };
  }, []);

  function handleEmailChange(value: string) {
    setEmail(value);
    if (emailTimer.current) window.clearTimeout(emailTimer.current);
    const e = value.trim();
    if (mode !== "signup" || !EMAIL_RE.test(e)) {
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

  function switchMode() {
    if (emailTimer.current) window.clearTimeout(emailTimer.current);
    setMode(mode === "login" ? "signup" : "login");
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
      const err = await onLogin(email.trim(), password, mode);
      if (err) setError(err);
      else if (mode === "signup") {
        setInfo(t(lang, "login.infoSignup"));
        setMode("login");
        setEmailCheck("idle");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="setup" key={mode}>
      <h2>{mode === "login" ? t(lang, "login.title") : t(lang, "login.signupTitle")}</h2>
      <label>
        {t(lang, "login.email")}
        <input type="email" value={email} onChange={(e) => handleEmailChange(e.target.value)} autoFocus />
      </label>
      {mode === "signup" && emailCheck === "taken" && (
        <p className="info warn" role="status">
          {t(lang, "login.emailTaken")}
          <button className="link" onClick={switchMode}>
            {t(lang, "login.title")}
          </button>
        </p>
      )}
      {mode === "signup" && emailCheck === "available" && (
        <p className="info" role="status">
          {t(lang, "login.emailAvailable")}
        </p>
      )}
      {mode === "signup" && emailCheck === "checking" && (
        <p className="hint" role="status">
          {t(lang, "login.emailChecking")}
        </p>
      )}
      <label>
        {t(lang, "login.password")}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {info && (
        <p className="info" role="status">
          {info}
        </p>
      )}
      <button disabled={busy} onClick={submit}>
        {busy
          ? t(lang, "login.processing")
          : mode === "login"
            ? t(lang, "login.title")
            : t(lang, "login.signup")}
      </button>
      <button className="link" onClick={switchMode}>
        {mode === "login" ? t(lang, "login.switchSignup") : t(lang, "login.switchLogin")}
      </button>

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
          <div className="conn-panel" id="conn-panel">
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
  );
}