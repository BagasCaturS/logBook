import { useEffect, useMemo, useState } from "react";
import { formatDateTime, todayIso } from "../lib/dates";
import { THEMES } from "../lib/themes";
import { LANGS, t, type Lang } from "../lib/i18n";
import { IconRefresh, IconLogout } from "./icons";
import type { Category, LogbookEntry } from "../lib/types";
import type { DownloadProgress, UpdateInfo } from "../lib/update";
import { buildPdf, savePdf } from "../lib/exportPdf";
import { buildBackupJson, pickBackupFile, saveBackupFile } from "../lib/backup";
import { importAll } from "../lib/db";
import { errMessage } from "../lib/sync";

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
  entries: LogbookEntry[];
  userId: string;
  updateInfo: UpdateInfo | null;
  updateState: string;
  updateError: string | null;
  downloadProgress: DownloadProgress;
  onCheckUpdate: () => void;
  onInstallUpdate: () => void;
  onRestored: () => void;
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
  entries,
  userId,
  updateInfo,
  updateState,
  updateError,
  downloadProgress,
  onCheckUpdate,
  onInstallUpdate,
  onRestored,
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
  const [rangeSel, setRangeSel] = useState("all");
  const [task, setTask] = useState<"export" | "save" | "restore" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [noteErr, setNoteErr] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);

  const weeks = useMemo(() => {
    const s = new Set<number>();
    for (const e of entries) {
      if (typeof e.minggu === "number" && Number.isInteger(e.minggu)) s.add(e.minggu);
    }
    return [...s].sort((a, b) => a - b);
  }, [entries]);

  const rangeOptions = useMemo(
    () => [
      { value: "all", label: t(lang, "export.rangeAll") },
      ...weeks.map((w) => ({
        value: `week-${w}`,
        label: t(lang, "export.rangeWeekOption", { minggu: w }),
      })),
    ],
    [weeks, lang]
  );

  useEffect(() => {
    if (rangeSel !== "all" && !rangeOptions.some((o) => o.value === rangeSel)) {
      setRangeSel("all");
    }
  }, [rangeOptions, rangeSel]);

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

  async function handleExport() {
    setTask("export");
    setNote(null);
    setNoteErr(null);
    try {
      const range =
        rangeSel === "all"
          ? { kind: "all" as const }
          : { kind: "week" as const, minggu: Number(rangeSel.slice(5)) };
      const sel =
        range.kind === "week"
          ? entries.filter((e) => e.minggu === range.minggu)
          : entries;
      if (sel.length === 0) {
        setNoteErr(t(lang, "export.empty"));
        return;
      }
      const data = buildPdf(sel, categories, lang, range);
      const path = await savePdf(data, `logbook-${todayIso()}.pdf`);
      if (path) setNote(t(lang, "export.done"));
    } catch (e) {
      setNoteErr(t(lang, "export.error", { error: errMessage(e) }));
    } finally {
      setTask(null);
    }
  }

  async function handleSaveBackup() {
    setTask("save");
    setNote(null);
    setNoteErr(null);
    try {
      const json = buildBackupJson(entries, categories, appVersion);
      const path = await saveBackupFile(json, `logbook-backup-${todayIso()}.json`);
      if (path) setNote(t(lang, "backup.saved"));
    } catch (e) {
      setNoteErr(t(lang, "backup.error", { error: errMessage(e) }));
    } finally {
      setTask(null);
    }
  }

  async function handleRestore() {
    setConfirmRestore(false);
    setTask("restore");
    setNote(null);
    setNoteErr(null);
    try {
      const res = await pickBackupFile();
      if (res.cancelled) return;
      if (!res.data) {
        setNoteErr(t(lang, "backup.invalid"));
        return;
      }
      await importAll(res.data, userId);
      onRestored();
      setNote(
        t(lang, "backup.restored", {
          entries: res.data.entries.length,
          categories: res.data.categories.length,
        })
      );
    } catch (e) {
      setNoteErr(t(lang, "backup.error", { error: errMessage(e) }));
    } finally {
      setTask(null);
    }
  }

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
      <h3>{t(lang, "export.title")}</h3>
      <p className="hint">{t(lang, "export.hint")}</p>
      <label>
        {t(lang, "export.rangeLabel")}
        <select value={rangeSel} onChange={(e) => setRangeSel(e.target.value)}>
          {rangeOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <div className="row actions">
        <button disabled={task !== null} onClick={() => void handleExport()}>
          {task === "export" ? t(lang, "export.exporting") : t(lang, "export.button")}
        </button>
      </div>
      {note && (
        <p className="info" role="status">
          {note}
        </p>
      )}
      {noteErr && (
        <p className="error" role="alert">
          {noteErr}
        </p>
      )}
      <hr />
      <h3>{t(lang, "backup.title")}</h3>
      <p className="hint">{t(lang, "backup.hint")}</p>
      <div className="row actions">
        <button className="secondary" disabled={task !== null} onClick={() => void handleSaveBackup()}>
          {task === "save" ? t(lang, "backup.saving") : t(lang, "backup.save")}
        </button>
        <button disabled={task !== null} onClick={() => setConfirmRestore(true)}>
          {t(lang, "backup.restore")}
        </button>
      </div>
      {confirmRestore && (
        <div className="overlay">
          <div className="dialog">
            <p>
              <strong>{t(lang, "backup.confirmTitle")}</strong>
            </p>
            <p className="dialog-sub">{t(lang, "backup.confirmText")}</p>
            <div className="row actions">
              <button disabled={task === "restore"} onClick={() => void handleRestore()}>
                {task === "restore" ? t(lang, "backup.restoring") : t(lang, "backup.confirm")}
              </button>
              <button className="secondary" onClick={() => setConfirmRestore(false)}>
                {t(lang, "dialog.cancel")}
              </button>
            </div>
          </div>
        </div>
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
