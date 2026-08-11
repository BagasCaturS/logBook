import { useEffect, useState } from "react";
import { formatDateTime } from "../lib/dates";
import { THEMES } from "../lib/themes";
import { LANGS, t, type Lang } from "../lib/i18n";
import { IconRefresh, IconLogout } from "./icons";
import type { Category } from "../lib/types";
import type { DownloadProgress, UpdateInfo } from "../lib/update";

interface Props {
  startDate: string;
  theme: string;
  lang: Lang;
  email: string | undefined;
  lastSyncAt: string | null;
  syncState: string;
  syncError?: string;
  appVersion: string;
  categories: Category[];
  updateInfo: UpdateInfo | null;
  updateState: string;
  updateError: string | null;
  downloadProgress: DownloadProgress;
  onCheckUpdate: () => void;
  onInstallUpdate: () => void;
  onSaveStartDate: (d: string) => void;
  onSaveTheme: (id: string) => void;
  onSaveLang: (l: Lang) => void;
  onDeleteCategory: (c: Category) => void;
  onLogout: () => void;
  onBack: () => void;
}

export default function SettingsView({
  startDate,
  theme,
  lang,
  email,
  lastSyncAt,
  syncState,
  syncError,
  appVersion,
  categories,
  updateInfo,
  updateState,
  updateError,
  downloadProgress,
  onCheckUpdate,
  onInstallUpdate,
  onSaveStartDate,
  onSaveTheme,
  onSaveLang,
  onDeleteCategory,
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
      <h3>{t(lang, "settings.title")}</h3>

      <div className="theme-picker">
        <label>{t(lang, "settings.theme")}</label>
        <div className="theme-grid">
          {THEMES.map((th) => (
            <button
              key={th.id}
              className={`theme-card${th.id === theme ? " active" : ""}`}
              onClick={() => onSaveTheme(th.id)}
              aria-pressed={th.id === theme}
              aria-label={`${t(lang, "settings.theme")}: ${th.name}`}
            >
              <span className="swatches" aria-hidden>
                {th.colors.map((c) => (
                  <span key={c} className="swatch" style={{ background: c }} />
                ))}
              </span>
              <span className="theme-name">{th.name}</span>
            </button>
          ))}
        </div>
      </div>

      <label>
        {t(lang, "settings.lang")}
        <select value={lang} onChange={(e) => onSaveLang(e.target.value as Lang)}>
          {LANGS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>

      <label>
        {t(lang, "settings.startDate")}
        <input type="date" value={draft} onChange={(e) => setDraft(e.target.value)} />
      </label>
      {draft && (
        <p className="hint">{t(lang, "settings.startDateHint")}</p>
      )}
      <div className="row actions">
        <button
          disabled={!dirty}
          onClick={() => {
            onSaveStartDate(draft);
            setSavedPhase("show");
          }}
        >
          {t(lang, "settings.save")}
        </button>
        <button className="secondary" onClick={onBack}>
          {t(lang, "settings.back")}
        </button>
      </div>
      {savedPhase && (
        <p
          className={`info saved-toast${savedPhase === "leave" ? " leaving" : ""}`}
          role="status"
        >
          {t(lang, "form.saved")}
        </p>
      )}
      <hr />
      <h3>{t(lang, "settings.categoriesTitle")}</h3>
      <p className="hint">{t(lang, "settings.categoriesHint")}</p>
      {categories.length === 0 ? (
        <p className="hint">{t(lang, "settings.noCategories")}</p>
      ) : (
        <ul className="cat-manage-list">
          {categories.map((c) => (
            <li key={c.id}>
              <span className="cat-chip" style={{ background: c.color, color: "#fff" }}>
                {c.name}
              </span>
              <button className="link danger" onClick={() => onDeleteCategory(c)}>
                {t(lang, "list.delete")}
              </button>
            </li>
          ))}
        </ul>
      )}
      <hr />
      <div className="settings-meta">
        <p>
          <strong>{t(lang, "settings.account")}</strong> {email ?? "-"}
        </p>
        <p>
          <strong>{t(lang, "settings.syncStatus")}</strong> {syncState}
          {lastSyncAt
            ? ` · ${t(lang, "settings.lastSync", { time: formatDateTime(lastSyncAt) })}`
            : ""}
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
          {t(lang, "settings.logout")}
        </button>
      </div>
      <hr />
      <h3>{t(lang, "settings.update")}</h3>
      <p className="settings-meta">
        <strong>{t(lang, "settings.version")}</strong> {appVersion || "-"}
        {updateInfo && (
          <span>
            . {t(lang, "settings.versionAvailable")}{" "}
            <span className="badge">v{updateInfo.version}</span>
          </span>
        )}
      </p>
      {updateInfo && (
        <div className="changelog">{updateInfo.body || t(lang, "settings.newRelease")}</div>
      )}
      {updateState === "checking" && <p className="hint">{t(lang, "settings.checking")}</p>}
      {updateState === "up-to-date" && (
        <p className="info" role="status">
          {t(lang, "settings.upToDate")}
        </p>
      )}
      {updateState === "downloading" && (
        <div className="update-download">
          {pct !== null ? (
            <>
              <div className="progress">
                <span style={{ width: `${pct}%` }} />
              </div>
              <p className="hint">{t(lang, "settings.downloading", { pct })}</p>
            </>
          ) : (
            <>
              <div className="progress indeterminate">
                <span />
              </div>
              <p className="hint">{t(lang, "settings.downloadingIndet")}</p>
            </>
          )}
        </div>
      )}
      {updateState === "ready" && (
        <p className="info" role="status">
          {t(lang, "settings.ready")}
        </p>
      )}
      {updateState === "error" && (
        <p className="error" role="alert">
          {t(lang, "settings.updateError", { error: updateError ?? "-" })}
        </p>
      )}
      <div className="row actions">
        <button className="secondary" disabled={busy} onClick={onCheckUpdate}>
          <IconRefresh size={15} />
          {t(lang, "settings.checkUpdate")}
        </button>
        {updateInfo && !busy && updateState !== "ready" && (
          <button onClick={onInstallUpdate}>{t(lang, "settings.downloadInstall")}</button>
        )}
      </div>
      <hr />
      <h3>{t(lang, "settings.about")}</h3>
      <p className="settings-meta">
        <strong>{t(lang, "settings.madeBy")}</strong>{" "}
        {t(lang, "settings.aboutLine", { version: appVersion || "-" })}
      </p>
    </div>
  );
}
