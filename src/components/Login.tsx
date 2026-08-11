import { useState } from "react";

interface Props {
  onLogin: (email: string, password: string, mode: "login" | "signup") => Promise<string | null>;
}

export default function Login({ onLogin }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState<string | null>(null);

  async function submit() {
    if (!email || !password) {
      setError("Isi email dan password dulu.");
      return;
    }
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const err = await onLogin(email.trim(), password, mode);
      if (err) setError(err);
      else if (mode === "signup") {
        setInfo("Akun dibuat! Cek email kamu untuk konfirmasi, lalu login.");
        setMode("login");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="setup" key={mode}>
      <h2>{mode === "login" ? "Login" : "Daftar Akun"}</h2>
      <label>
        Email
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
      </label>
      <label>
        Password
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
        {busy ? "Memproses..." : mode === "login" ? "Login" : "Daftar"}
      </button>
      <button className="link" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
        {mode === "login" ? "Belum punya akun? Daftar" : "Sudah punya akun? Login"}
      </button>
      <p className="login-credit">Dibuat oleh Sapporo</p>
    </div>
  );
}
