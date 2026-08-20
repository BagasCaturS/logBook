import { useEffect, useMemo, useState } from "react";
import { formatDateTime, todayIso } from "../lib/dates";
import { THEMES } from "../lib/themes";
import { LANGS, t, type Lang } from "../lib/i18n";
import { DEFAULT_HOUR_LABEL } from "../lib/settings";
import { IconRefresh, IconLogout } from "./icons";
import type { Category, DailyNote, LogbookEntry } from "../lib/types";
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
  notes: DailyNote[];
  userId: string;
  hourStart: string;
  hourLabel: string;
  supabaseUrl: string;
  updateInfo: UpdateInfo | null;
  updateState: string;
  updateError: string | null;
  downloadProgress: DownloadProgress;
  onCheckUpdate: () => void;
  onInstallUpdate: () => void;
  onRestored: () => void;
  onSaveStartDate: (d: string) => void;
  onSaveHours: (start: string, label: string) => void;
  onSaveTheme: (id: string) => void;
  onSaveLang: (l: Lang) => void;
  onDeleteCategory: (c: Category) => void;
  onChangeConnection: () => void;
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
  notes,
  userId,
  hourStart,
  hourLabel,
  supabaseUrl,
  updateInfo,
  updateState,
  updateError,
  downloadProgress,
  onCheckUpdate,
  onInstallUpdate,
  onRestored,
  onSaveStartDate,
  onSaveHours,
  onSaveTheme,
  onSaveLang,
  onDeleteCategory,
  onChangeConnection,
  onLogout,
  onBack,
}: Props) {
  const [draft, setDraft] = useState(startDate);
  const dirty = draft !== startDate;
  const [hourDraft, setHourDraft] = useState(hourStart);
  const [labelDraft, setLabelDraft] = useState(hourLabel);
  const hourDirty = hourDraft !== hourStart || labelDraft !== hourLabel;
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
      const data = buildPdf(sel, categories, lang, range, hourLabel);
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
      const json = buildBackupJson(entries, categories, notes, appVersion);
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
    <div className="form settings">
      <div className="set-head">
        <div className="set-head-text">
          <h3 className="set-title">{t(lang, "settings.title")}</h3>
          <p className="set-sub">{t(lang, "settings.subtitle")}</p>
        </div>
        <button className="danger-soft" onClick={onBack}>
          {t(lang, "settings.back")}
        </button>
      </div>

      <section className="set-section" aria-labelledby="set-head-appearance">
        <h4 className="set-section-title" id="set-head-appearance">
          {t(lang, "settings.sectionAppearance")}
        </h4>
        <div className="theme-picker">
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
                <span className="theme-name">
                  {th.id === theme && (
                    <span className="theme-check" aria-hidden>
                      ✓
                    </span>
                  )}
                  {th.name}
                </span>
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
      </section>

      <section className="set-section" aria-labelledby="set-head-period">
        <h4 className="set-section-title" id="set-head-period">
          {t(lang, "settings.sectionPeriod")}
        </h4>
        <div className="set-cols">
          <div className="set-fieldset">
            <p className="set-fieldset-title">{t(lang, "settings.startDate")}</p>
            <input
              type="date"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-label={t(lang, "settings.startDate")}
            />
            {draft && <p className="hint">{t(lang, "settings.startDateHint")}</p>}
            <div className="row set-fieldset-actions">
              <button
                disabled={!dirty}
                onClick={() => {
                  onSaveStartDate(draft);
                  setSavedPhase("show");
                }}
              >
                {t(lang, "settings.save")}
              </button>
            </div>
          </div>
          <div className="set-fieldset">
            <p className="set-fieldset-title">{t(lang, "settings.hourTitle")}</p>
            <div className="row">
              <label>
                {t(lang, "settings.hourStart")}
                <input
                  type="time"
                  value={hourDraft}
                  onChange={(e) => setHourDraft(e.target.value)}
                />
              </label>
              <label>
                {t(lang, "settings.hourLabel")}
                <input
                  type="text"
                  value={labelDraft}
                  onChange={(e) => setLabelDraft(e.target.value)}
                  placeholder={DEFAULT_HOUR_LABEL}
                />
              </label>
            </div>
            <p className="hint">
              {t(lang, "settings.hourStartHint")} {t(lang, "settings.hourLabelHint")}
            </p>
            <div className="row set-fieldset-actions">
              <button
                disabled={!hourDirty}
                onClick={() => {
                  onSaveHours(hourDraft, labelDraft.trim() || DEFAULT_HOUR_LABEL);
                  setSavedPhase("show");
                }}
              >
                {t(lang, "settings.save")}
              </button>
            </div>
          </div>
        </div>
        {savedPhase && (
          <p
            className={`info saved-toast${savedPhase === "leave" ? " leaving" : ""}`}
            role="status"
          >
            {t(lang, "form.saved")}
          </p>
        )}
      </section>

      <section className="set-section" aria-labelledby="set-head-cats">
        <h4 className="set-section-title" id="set-head-cats">
          {t(lang, "settings.categoriesTitle")}
          {categories.length > 0 && (
            <span className="count-badge">
              {t(lang, "settings.categoryCount", { n: categories.length })}
            </span>
          )}
        </h4>
        <p className="hint">{t(lang, "settings.categoriesHint")}</p>
        {categories.length === 0 ? (
          <p className="hint">{t(lang, "settings.noCategories")}</p>
        ) : (
          <div className="cat-manage">
            {categories.map((c) => (
              <span key={c.id} className="cat-manage-item">
                <span className="cat-manage-chip">
                  <span className="cat-dot" style={{ background: c.color }} />
                  {c.name}
                </span>
                <button
                  className="cat-manage-x"
                  onClick={() => onDeleteCategory(c)}
                  aria-label={`${t(lang, "list.delete")}: ${c.name}`}
                  title={t(lang, "list.delete")}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="set-section" aria-labelledby="set-head-data">
        <h4 className="set-section-title" id="set-head-data">
          {t(lang, "settings.sectionData")}
        </h4>
        <p className="hint">{t(lang, "export.hint")}</p>
        <div className="set-data-row">
          <div className="set-data-main">
            <p className="set-fieldset-title">{t(lang, "export.title")}</p>
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
          </div>
          <button disabled={task !== null} onClick={() => void handleExport()}>
            {task === "export" ? t(lang, "export.exporting") : t(lang, "export.button")}
          </button>
        </div>
        <div className="set-data-row">
          <div className="set-data-main">
            <p className="set-fieldset-title">{t(lang, "backup.title")}</p>
            <p className="hint">{t(lang, "backup.hint")}</p>
          </div>
          <div className="row actions">
            <button
              className="secondary"
              disabled={task !== null}
              onClick={() => void handleSaveBackup()}
            >
              {task === "save" ? t(lang, "backup.saving") : t(lang, "backup.save")}
            </button>
            <button disabled={task !== null} onClick={() => setConfirmRestore(true)}>
              {t(lang, "backup.restore")}
            </button>
          </div>
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
      </section>

      <section className="set-section" aria-labelledby="set-head-account">
        <h4 className="set-section-title" id="set-head-account">
          {t(lang, "settings.sectionAccount")}
        </h4>
        <div className="settings-meta">
          <p>
            <span>{t(lang, "settings.account")}</span>
            <strong>{email ?? "-"}</strong>
          </p>
          <p>
            <span>{t(lang, "settings.syncStatus")}</span>
            <strong>
              {syncState}
              {lastSyncAt
                ? ` · ${t(lang, "settings.lastSync", { time: formatDateTime(lastSyncAt) })}`
                : ""}
            </strong>
          </p>
        </div>
        {syncError && (
          <p className="error" role="alert">
            Error: {syncError}
          </p>
        )}
        <div className="settings-meta">
          <p>
            <span>{t(lang, "settings.connectionCurrent")}</span>
            <strong>{supabaseUrl || "-"}</strong>
          </p>
        </div>
        <p className="hint">{t(lang, "settings.connectionNote")}</p>
        <div className="row actions">
          <button className="secondary" onClick={onChangeConnection}>
            {t(lang, "settings.changeConnection")}
          </button>
          <button className="secondary" onClick={onLogout}>
            <IconLogout size={15} />
            {t(lang, "settings.logout")}
          </button>
        </div>
      </section>

      <section className="set-section" aria-labelledby="set-head-app">
        <h4 className="set-section-title" id="set-head-app">
          {t(lang, "settings.update")}
        </h4>
        <div className="settings-meta">
          <p>
            <span>{t(lang, "settings.version")}</span>
            <strong>{appVersion || "-"}</strong>
          </p>
        </div>
        {updateInfo && (
          <p className="hint">
            {t(lang, "settings.versionAvailable")} <span className="badge">v{updateInfo.version}</span>
          </p>
        )}
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
      </section>

      <p className="set-footer">
        {t(lang, "settings.madeBy")} {t(lang, "settings.aboutLine", { version: appVersion || "-" })}
      </p>
    </div>
  );
}
