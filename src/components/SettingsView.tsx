import { useEffect, useState } from "react";
import { formatDateTime } from "../lib/dates";
import { THEMES } from "../lib/themes";
import { IconRefresh, IconLogout } from "./icons";
import type { DownloadProgress, UpdateInfo } from "../lib/update";

interface Props {
  startDate: string;
  theme: string;
  email: string | undefined;
  lastSyncAt: string | null;
  syncState: string;
  syncError?: string;
  appVersion: string;
  updateInfo: UpdateInfo | null;
  updateState: string;
  updateError: string | null;
  downloadProgress: DownloadProgress;
  onCheckUpdate: () => void;
  onInstallUpdate: () => void;
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
  appVersion,
  updateInfo,
  updateState,
  updateError,
  downloadProgress,
  onCheckUpdate,
  onInstallUpdate,
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

  const pct =
    downloadProgress.total && downloadProgress.total > 0
      ? Math.min(100, Math.round((downloadProgress.downloaded / downloadProgress.total) * 100))
      : null;
  const busy = updateState === "checking" || updateState === "downloading";

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
      <hr />
      <h3>Pembaruan</h3>
      <p className="settings-meta">
        <strong>Versi terpasang</strong> {appVersion || "-"}
        {updateInfo && (
          <span>
            . Versi tersedia: <span className="badge">v{updateInfo.version}</span>
          </span>
        )}
      </p>
      {updateInfo && (
        <div className="changelog">{updateInfo.body || "Rilis baru tersedia."}</div>
      )}
      {updateState === "checking" && <p className="hint">Memeriksa update...</p>}
      {updateState === "up-to-date" && (
        <p className="info" role="status">
          Sudah versi terbaru
        </p>
      )}
      {updateState === "downloading" && (
        <div className="update-download">
          {pct !== null ? (
            <>
              <div className="progress">
                <span style={{ width: `${pct}%` }} />
              </div>
              <p className="hint">Mengunduh update... {pct}%</p>
            </>
          ) : (
            <>
              <div className="progress indeterminate">
                <span />
              </div>
              <p className="hint">Mengunduh update...</p>
            </>
          )}
        </div>
      )}
      {updateState === "ready" && (
        <p className="info" role="status">
          Update terpasang — buka ulang aplikasi untuk memakai versi terbaru.
        </p>
      )}
      {updateState === "error" && (
        <p className="error" role="alert">
          Gagal memasang update: {updateError}
        </p>
      )}
      <div className="row actions">
        <button className="secondary" disabled={busy} onClick={onCheckUpdate}>
          <IconRefresh size={15} />
          Periksa Update
        </button>
        {updateInfo && !busy && updateState !== "ready" && (
          <button onClick={onInstallUpdate}>Unduh & Pasang</button>
        )}
      </div>
    </div>
  );
}
