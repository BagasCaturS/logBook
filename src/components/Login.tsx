import { useState } from "react";
import { t, type Lang } from "../lib/i18n";

interface Props {
  lang: Lang;
  onLogin: (email: string, password: string, mode: "login" | "signup") => Promise<string | null>;
}

export default function Login({ lang, onLogin }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

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
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
      </label>
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
      <button className="link" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
        {mode === "login" ? t(lang, "login.switchSignup") : t(lang, "login.switchLogin")}
      </button>
      <p className="login-credit">{t(lang, "login.credit")}</p>
    </div>
  );
}
