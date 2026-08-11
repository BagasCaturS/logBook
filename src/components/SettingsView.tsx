import { useEffect, useState } from "react";
import { formatDateTime } from "../lib/dates";
import { THEMES } from "../lib/themes";
import { IconLogout } from "./icons";

interface Props {
  startDate: string;
  theme: string;
  email: string | undefined;
  lastSyncAt: string | null;
  syncState: string;
  syncError?: string;
  onSaveStartDate: (d: string) => void;
  onSaveTheme: (id: string) => void;
  onLogout: () => void;
  onBack: () => void;
}

export default function SettingsView({
  startDate,
  theme,
  email,
  lastSyncAt,
  syncState,
  syncError,
  onSaveStartDate,
  onSaveTheme,
  onLogout,
  onBack,
}: Props) {
  const [draft, setDraft] = useState(startDate);
  const dirty = draft !== startDate;
  const [savedPhase, setSavedPhase] = useState<"show" | "leave" | null>(null);

  useEffect(() => {
    if (savedPhase === "show") {
      const t = window.setTimeout(() => setSavedPhase("leave"), 1600);
      return () => window.clearTimeout(t);
    }
    if (savedPhase === "leave") {
      const t = window.setTimeout(() => setSavedPhase(null), 260);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [savedPhase]);

  return (
    <div className="form">
      <h3>Pengaturan</h3>

      <div className="theme-picker">
        <label>Tema aplikasi</label>
        <div className="theme-grid">
          {THEMES.map((t) => (
            <button
              key={t.id}
              className={`theme-card${t.id === theme ? " active" : ""}`}
              onClick={() => onSaveTheme(t.id)}
              aria-pressed={t.id === theme}
              aria-label={`Pilih tema ${t.name}`}
            >
              <span className="swatches" aria-hidden>
                {t.colors.map((c) => (
                  <span key={c} className="swatch" style={{ background: c }} />
                ))}
              </span>
              <span className="theme-name">{t.name}</span>
            </button>
          ))}
        </div>
      </div>

      <label>
        Tanggal mulai magang (untuk auto-hitung minggu)
        <input type="date" value={draft} onChange={(e) => setDraft(e.target.value)} />
      </label>
      {draft && (
        <p className="hint">
          Entri baru akan otomatis dihitung minggu ke-? dan hari ke-N dari tanggal ini.
        </p>
      )}
      <div className="row actions">
        <button
          disabled={!dirty}
          onClick={() => {
            onSaveStartDate(draft);
            setSavedPhase("show");
          }}
        >
          Simpan
        </button>
        <button className="secondary" onClick={onBack}>
          Kembali
        </button>
      </div>
      {savedPhase && (
        <p
          className={`info saved-toast${savedPhase === "leave" ? " leaving" : ""}`}
          role="status"
        >
          Tersimpan
        </p>
      )}
      <hr />
      <div className="settings-meta">
        <p>
          <strong>Akun</strong> {email ?? "-"}
        </p>
        <p>
          <strong>Status sinkron</strong> {syncState}
          {lastSyncAt ? ` · terakhir ${formatDateTime(lastSyncAt)}` : ""}
        </p>
      </div>
      {syncError && (
        <p className="error" role="alert">
          Error: {syncError}
        </p>
      )}
      <div className="row actions">
        <button className="secondary" onClick={onLogout}>
          <IconLogout size={15} />
          Logout
        </button>
      </div>
    </div>
  );
}
