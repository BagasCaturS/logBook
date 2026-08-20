import { useCallback, useEffect, useRef, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import EntryForm from "./components/EntryForm";
import EntryList from "./components/EntryList";
import Login from "./components/Login";
import SettingsView from "./components/SettingsView";
import Setup from "./components/Setup";
import CalendarView from "./components/CalendarView";
import UndoToast from "./components/UndoToast";
import { IconBook, IconGear, IconRefresh } from "./components/icons";
import {
  addCategory,
  addEntry,
  deleteCategory,
  deleteEntry,
  listCategories,
  listDailyNotes,
  listEntries,
  markSettingsChanged,
  restoreEntry,
  saveDailyNote,
  updateEntry,
} from "./lib/db";
import { formatDateTime } from "./lib/dates";
import { t } from "./lib/i18n";
import { plainTextFromHtml } from "./lib/richtext";
import { checkEmailRegistered, getClient, getCurrentSession, onAuthChange, signIn, signOut, signUp } from "./lib/supabase";
import { deletePhotos, uploadPhoto, type PhotoOps } from "./lib/photos";
import { loadSettings, normalizeUrl, saveSettings } from "./lib/settings";
import { syncNow } from "./lib/sync";
import { DEFAULT_THEME } from "./lib/themes";
import { checkForUpdate, downloadAndInstall } from "./lib/update";
import type { AppSettings, Category, DailyNote, EntryInput, LogbookEntry, SyncStatus } from "./lib/types";
import type { DownloadProgress, UpdateInfo } from "./lib/update";

const SYNC_INTERVAL_MS = 30_000;

const delay = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

type UpdateState =
  | "idle"
  | "checking"
  | "available"
  | "up-to-date"
  | "downloading"
  | "ready"
  | "error";

export default function App() {
  const [initialSettings] = useState(() => loadSettings());
  const [settings, setSettings] = useState<AppSettings>(initialSettings);
  const [session, setSession] = useState<{ userId: string; email: string | undefined } | null>(null);
  const [entries, setEntries] = useState<LogbookEntry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [notes, setNotes] = useState<DailyNote[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    state: "offline",
    lastSyncAt: initialSettings.lastSyncAt,
  });
  const [view, setView] = useState<"main" | "settings">("main");
  const [editing, setEditing] = useState<LogbookEntry | null>(null);
  const [formDate, setFormDate] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<LogbookEntry | null>(null);
  const [confirmDeleteCategory, setConfirmDeleteCategory] = useState<Category | null>(null);
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const [dialogLeaving, setDialogLeaving] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [appVersion, setAppVersion] = useState("");
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateState, setUpdateState] = useState<UpdateState>("idle");
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress>({
    downloaded: 0,
    total: null,
  });
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [undoEntry, setUndoEntry] = useState<LogbookEntry | null>(null);
  const [connOpen, setConnOpen] = useState(false);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const syncTimer = useRef<number | null>(null);
  const syncInFlight = useRef(false);
  const undoTimer = useRef<number | null>(null);

  const refreshEntries = useCallback(async (userId: string) => {
    setEntries(await listEntries(userId));
  }, []);

  const refreshCategories = useCallback(async (userId: string) => {
    setCategories(await listCategories(userId));
  }, []);

  const refreshNotes = useCallback(async (userId: string) => {
    setNotes(await listDailyNotes(userId));
  }, []);

  const runSync = useCallback(async () => {
    if (syncInFlight.current) return;
    syncInFlight.current = true;
    try {
      const s = settingsRef.current;
      const client = getClient(s);
      await syncNow(client, session?.userId ?? null, s, setSyncStatus);
      // syncNow bisa menulis pengaturan cloud ke localStorage — sinkronkan state
      setSettings(loadSettings());
    } finally {
      syncInFlight.current = false;
    }
  }, [session]);

  const queueSync = useCallback(() => {
    if (syncTimer.current) window.clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(() => {
      void runSync();
    }, 2000);
  }, [runSync]);

  // apply selected theme to the document
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme || DEFAULT_THEME;
  }, [settings.theme]);

  // check for updates on boot
  useEffect(() => {
    void getVersion().then(setAppVersion);
    void checkForUpdate().then((info) => {
      if (info) {
        setUpdateInfo(info);
        setUpdateState("available");
      }
    });
  }, []);

  // restore session on boot; ikuti perubahan sesi dari client AKTIF. Client
  // dibuat ulang saat koneksi berubah, jadi listener re-subscribe mengikuti
  // url+key terkini — mencegah event dari client baru tidak sampai ke UI.
  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | undefined;
    (async () => {
      const s = loadSettings();
      const sess = await getCurrentSession(s);
      if (cancelled) return;
      setSession(sess ? { userId: sess.user.id, email: sess.user.email } : null);
      setInitializing(false);
      unsub = onAuthChange(s, (next) => {
        setSession(next ? { userId: next.user.id, email: next.user.email } : null);
      });
    })();
    return () => {
      cancelled = true;
      unsub?.();
      if (syncTimer.current) window.clearTimeout(syncTimer.current);
      if (undoTimer.current) window.clearTimeout(undoTimer.current);
    };
  }, [settings.supabaseUrl, settings.supabaseAnonKey]);

  // load entries + categories, start sync loop when session appears
  useEffect(() => {
    if (!session) {
      setEntries([]);
      setCategories([]);
      return;
    }
    setConnOpen(false);
    void refreshEntries(session.userId);
    void refreshCategories(session.userId);
    void refreshNotes(session.userId);
    void runSync();
    const interval = window.setInterval(() => void runSync(), SYNC_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [session?.userId, refreshEntries, refreshCategories, refreshNotes, runSync]);

  async function handleSaveSetup(url: string, key: string) {
    const next: AppSettings = {
      ...settingsRef.current,
      supabaseUrl: normalizeUrl(url),
      supabaseAnonKey: key.trim(),
    };
    saveSettings(next);
    setSettings(next);
  }

  /** Simpan kredensial baru dari panel Ubah Koneksi di halaman login. */
  async function handleChangeConnection(url: string, key: string) {
    const next: AppSettings = {
      ...settingsRef.current,
      supabaseUrl: normalizeUrl(url),
      supabaseAnonKey: key.trim(),
    };
    saveSettings(next);
    setSettings(next);
    setConnOpen(false);
  }

  /** Dari Pengaturan: logout lalu tampilkan halaman login dengan panel Ubah Koneksi terbuka. */
  async function handleOpenChangeConnection() {
    await signOut(settingsRef.current);
    setSession(null);
    setView("main");
    setConnOpen(true);
  }

  async function handleLogin(email: string, password: string, mode: "login" | "signup") {
    const s = settingsRef.current;
    const res =
      mode === "login" ? await signIn(s, email, password) : await signUp(s, email, password);
    if (res.error) {
      const msg = res.error.message;
      if (msg.toLowerCase().includes("invalid login credentials")) {
        return t(s.lang, "login.errInvalid");
      }
      return msg;
    }
    // Set state sesi secara EKSPLISIT: listener onAuthChange dapat terikat ke
    // client lama bila koneksi baru saja diubah, sehingga event SIGNED_IN tidak
    // sampai ke UI — gejala: login "tidak terjadi apa-apa", padahal sesi
    // tersimpan (terbukti dari auto-login setelah app dibuka ulang).
    if (res.data.session) {
      setSession({ userId: res.data.session.user.id, email: res.data.session.user.email });
    }
    return null;
  }

  async function handleCheckEmail(email: string): Promise<boolean | null> {
    return checkEmailRegistered(settingsRef.current, email);
  }

  async function handleSaveEntry(input: EntryInput, id: string | null, photoOps: PhotoOps) {
    if (!session) return;
    const s = settingsRef.current;
    const client = getClient(s);
    const removed = photoOps?.removed ?? [];
    const added = photoOps?.added ?? [];
    if (removed.length > 0 && client) {
      await deletePhotos(client, removed);
    }
    const newPaths: string[] = [];
    if (added.length > 0) {
      if (!client) throw new Error("Supabase belum dikonfigurasi");
      for (const f of added) {
        newPaths.push(await uploadPhoto(client, session.userId, f));
      }
    }
    const base = id ? (editing?.photo_paths ?? []) : [];
    const photoPaths = [...base.filter((p) => !removed.includes(p)), ...newPaths];
    const fullInput: EntryInput = { ...input, photo_paths: photoPaths };
    if (id) {
      await updateEntry(id, session.userId, fullInput);
    } else {
      await addEntry(session.userId, fullInput);
    }
    await refreshEntries(session.userId);
    setEditing(null);
    setFormDate(null);
    queueSync();
  }

  async function handleCreateCategory(name: string) {
    if (!session) return;
    const cat = await addCategory(session.userId, name, pickCategoryColor(categories.length));
    await refreshCategories(session.userId);
    queueSync();
    return cat;
  }

  async function handleSaveNote(tanggal: string, isi: string) {
    if (!session) return;
    await saveDailyNote(session.userId, tanggal, isi);
    await refreshNotes(session.userId);
    queueSync();
  }

  /** Tandai perubahan pengaturan untuk disinkronkan setelah ditulis ke localStorage. */
  async function handleSettingsSync(patch: {
    startDate?: string;
    hourStart?: string;
    hourLabel?: string;
    theme?: string;
    lang?: string;
  }) {
    if (!session) return;
    const base = settingsRef.current;
    await markSettingsChanged(session.userId, {
      startDate: patch.startDate ?? base.startDate,
      hourStart: patch.hourStart ?? base.hourStart,
      hourLabel: patch.hourLabel ?? base.hourLabel,
      theme: patch.theme ?? base.theme,
      lang: patch.lang ?? base.lang,
    });
    queueSync();
  }

  function closeDialog() {
    if (dialogLeaving) return;
    setDialogLeaving(true);
    window.setTimeout(() => {
      setConfirmDelete(null);
      setConfirmDeleteCategory(null);
      setDialogLeaving(false);
    }, 170);
  }

  async function handleConfirmDelete() {
    if (!session || !confirmDelete || dialogLeaving) return;
    const entry = confirmDelete;
    setDialogLeaving(true);
    await delay(170);
    setConfirmDelete(null);
    setDialogLeaving(false);
    setLeavingId(entry.id);
    await delay(260);
    await deleteEntry(entry.id, session.userId);
    await refreshEntries(session.userId);
    setLeavingId(null);
    queueSync();
    // Masa undo 10 detik: foto storage dihapus setelah lewat agar bisa dibatalkan.
    const paths = entry.photo_paths ?? [];
    if (undoTimer.current) window.clearTimeout(undoTimer.current);
    setUndoEntry(entry);
    undoTimer.current = window.setTimeout(() => {
      undoTimer.current = null;
      setUndoEntry(null);
      const client = getClient(settingsRef.current);
      if (client && paths.length > 0) {
        void deletePhotos(client, paths);
      }
    }, 10_000);
  }

  async function handleUndoDelete() {
    if (!session || !undoEntry) return;
    const entry = undoEntry;
    if (undoTimer.current) window.clearTimeout(undoTimer.current);
    undoTimer.current = null;
    setUndoEntry(null);
    await restoreEntry(entry.id, session.userId);
    await refreshEntries(session.userId);
    queueSync();
  }

  async function handleConfirmDeleteCategory() {
    if (!session || !confirmDeleteCategory || dialogLeaving) return;
    const cat = confirmDeleteCategory;
    setDialogLeaving(true);
    await delay(170);
    setConfirmDeleteCategory(null);
    setDialogLeaving(false);
    await deleteCategory(cat.id, session.userId);
    await Promise.all([refreshCategories(session.userId), refreshEntries(session.userId)]);
    queueSync();
  }

  async function handleLogout() {
    await signOut(settingsRef.current);
    setSession(null);
    setView("main");
  }

  async function handleCheckUpdate() {
    setUpdateState("checking");
    setUpdateError(null);
    const info = await checkForUpdate();
    setUpdateInfo(info);
    setUpdateState(info ? "available" : "up-to-date");
  }

  async function handleInstallUpdate() {
    if (!updateInfo) return;
    setUpdateState("downloading");
    setUpdateError(null);
    setDownloadProgress({ downloaded: 0, total: null });
    try {
      await downloadAndInstall((p) => setDownloadProgress(p));
      setUpdateState("ready");
    } catch (e) {
      setUpdateState("error");
      setUpdateError(e instanceof Error ? e.message : String(e));
    }
  }

  if (initializing) return <div className="setup">{t(settings.lang, "app.loading")}</div>;

  if (!settings.supabaseUrl || !settings.supabaseAnonKey) {
    return (
      <Setup
        initialUrl={settings.supabaseUrl}
        initialKey={settings.supabaseAnonKey}
        lang={settings.lang}
        onSave={handleSaveSetup}
      />
    );
  }

  if (!session) {
    return (
      <Login
        lang={settings.lang}
        initialUrl={settings.supabaseUrl}
        initialKey={settings.supabaseAnonKey}
        connOpen={connOpen}
        onToggleConn={() => setConnOpen(!connOpen)}
        onChangeConnection={(url, key) => void handleChangeConnection(url, key)}
        onCheckEmail={handleCheckEmail}
        onLogin={handleLogin}
      />
    );
  }

  const lang = settings.lang;
  const dotClass =
    syncStatus.state === "online"
      ? "dot online"
      : syncStatus.state === "syncing"
        ? "dot syncing"
        : syncStatus.state === "error"
          ? "dot error"
          : "dot offline";

  return (
    <div className="app">
      <header>
        <div className="brand">
          <div className="brand-mark">
            <IconBook size={24} />
          </div>
          <div>
            <h1>{t(lang, "app.title")}</h1>
            <p className="tagline">{t(lang, "app.tagline")}</p>
          </div>
        </div>
        <div className="sync-info">
          <span className="sync-status">
            <span className={dotClass} title={syncStatus.error ?? syncStatus.state} />
            <span>
              {syncStatus.state === "syncing"
                ? t(lang, "sync.syncing")
                : syncStatus.state === "online"
                  ? t(lang, "sync.online", {
                      time: syncStatus.lastSyncAt ? formatDateTime(syncStatus.lastSyncAt) : "",
                    })
                  : syncStatus.state === "error"
                    ? t(lang, "sync.error")
                    : t(lang, "sync.offline")}
            </span>
          </span>
          <button
            className={`secondary${syncStatus.state === "syncing" ? " syncing" : ""}`}
            disabled={syncStatus.state === "syncing"}
            onClick={async () => {
              await runSync();
              if (session) {
                await refreshEntries(session.userId);
                await refreshCategories(session.userId);
                await refreshNotes(session.userId);
              }
            }}
          >
            <IconRefresh size={15} />
            {t(lang, "sync.now")}
          </button>
          <button
            className="secondary"
            onClick={() => {
              setView("settings");
            }}
          >
            <IconGear size={15} />
            {t(lang, "settings.button")}
          </button>
        </div>
      </header>

      {view === "settings" ? (
        <SettingsView
          startDate={settings.startDate}
          theme={settings.theme}
          lang={lang}
          email={session.email}
          lastSyncAt={syncStatus.lastSyncAt}
          syncState={syncStatus.state}
          syncError={syncStatus.error}
          appVersion={appVersion}
          categories={categories}
          entries={entries}
          notes={notes}
          userId={session.userId}
          hourStart={settings.hourStart}
          hourLabel={settings.hourLabel}
          supabaseUrl={settings.supabaseUrl}
          updateInfo={updateInfo}
          updateState={updateState}
          updateError={updateError}
          downloadProgress={downloadProgress}
          onCheckUpdate={() => void handleCheckUpdate()}
          onInstallUpdate={() => void handleInstallUpdate()}
          onRestored={() => {
            void refreshEntries(session.userId);
            void refreshCategories(session.userId);
            void refreshNotes(session.userId);
            queueSync();
          }}
          onSaveStartDate={(d) => {
            const next = { ...settingsRef.current, startDate: d };
            saveSettings(next);
            setSettings(next);
            void handleSettingsSync({ startDate: d });
          }}
          onSaveHours={(start, label) => {
            const next = { ...settingsRef.current, hourStart: start, hourLabel: label };
            saveSettings(next);
            setSettings(next);
            void handleSettingsSync({ hourStart: start, hourLabel: label });
          }}
          onSaveTheme={(id) => {
            const next = { ...settingsRef.current, theme: id };
            saveSettings(next);
            setSettings(next);
            void handleSettingsSync({ theme: id });
          }}
          onSaveLang={(l) => {
            const next = { ...settingsRef.current, lang: l };
            saveSettings(next);
            setSettings(next);
            void handleSettingsSync({ lang: l });
          }}
          onDeleteCategory={(c) => setConfirmDeleteCategory(c)}
          onChangeConnection={() => void handleOpenChangeConnection()}
          onLogout={() => void handleLogout()}
          onBack={() => setView("main")}
        />
      ) : (
        <main>
          {updateInfo && updateState !== "downloading" && (
            <div className="update-banner m-b" role="status">
              <div className="update-banner-text">
                <strong>{t(lang, "update.available", { version: updateInfo.version })}</strong>
                <span>
                  {updateState === "ready"
                    ? t(lang, "update.readyText", { version: updateInfo.version })
                    : t(lang, "update.availableText")}
                </span>
              </div>
              <button
                className="secondary"
                disabled={updateState === "ready"}
                onClick={() => void handleInstallUpdate()}
              >
                {updateState === "ready" ? t(lang, "update.installed") : t(lang, "update.install")}
              </button>
            </div>
          )}
          <EntryForm
            startDate={settings.startDate}
            hourStart={settings.hourStart}
            hourLabel={settings.hourLabel}
            editing={editing}
            initialDate={formDate}
            categories={categories}
            supabaseUrl={settings.supabaseUrl}
            lang={lang}
            onSave={handleSaveEntry}
            onCreateCategory={handleCreateCategory}
            onCancel={() => {
              setEditing(null);
              setFormDate(null);
            }}
          />

          <CalendarView
            entries={entries}
            categories={categories}
            notes={notes}
            startDate={settings.startDate}
            leavingId={leavingId}
            supabaseUrl={settings.supabaseUrl}
            lang={lang}
            hourLabel={settings.hourLabel}
            onSaveNote={(tanggal, isi) => void handleSaveNote(tanggal, isi)}
            onAdd={(date) => {
              setEditing(null);
              setFormDate(date);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            onEdit={(e) => {
              setEditing(e);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            onDelete={(e) => setConfirmDelete(e)}
            onOpenPhoto={(url) => setPreviewPhoto(url)}
          />
          <EntryList
            entries={entries}
            categories={categories}
            leavingId={leavingId}
            supabaseUrl={settings.supabaseUrl}
            lang={lang}
            hourLabel={settings.hourLabel}
            onEdit={(e) => {
              setEditing(e);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            onDelete={(e) => setConfirmDelete(e)}
            onOpenPhoto={(url) => setPreviewPhoto(url)}
          />
        </main>
      )}

      {(confirmDelete || confirmDeleteCategory) && (
        <div className={`overlay${dialogLeaving ? " leaving" : ""}`}>
          <div className={`dialog${dialogLeaving ? " leaving" : ""}`}>
            <p>
              {confirmDeleteCategory
                ? t(lang, "settings.deleteCategoryConfirm")
                : t(lang, "dialog.deleteEntry")}
            </p>
            {confirmDelete && (
              <p className="dialog-sub">{plainTextFromHtml(confirmDelete.kegiatan)}</p>
            )}
            {confirmDeleteCategory && (
              <p className="dialog-sub">
                <span
                  className="cat-chip"
                  style={{ background: confirmDeleteCategory.color, color: "#fff" }}
                >
                  {confirmDeleteCategory.name}
                </span>
              </p>
            )}
            <div className="row actions">
              <button
                className="danger-btn"
                onClick={() =>
                  confirmDeleteCategory
                    ? void handleConfirmDeleteCategory()
                    : void handleConfirmDelete()
                }
              >
                {t(lang, "dialog.delete")}
              </button>
              <button className="secondary" onClick={closeDialog}>
                {t(lang, "dialog.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}

      {previewPhoto && (
        <div className="overlay" onClick={() => setPreviewPhoto(null)}>
          <div className="photo-modal" onClick={(e) => e.stopPropagation()}>
            <img src={previewPhoto} alt="" />
            <button className="secondary" onClick={() => setPreviewPhoto(null)}>
              {t(lang, "photo.close")}
            </button>
          </div>
        </div>
      )}

      {undoEntry && (
        <UndoToast
          lang={lang}
          onUndo={() => void handleUndoDelete()}
          onDismiss={() => {
            if (undoTimer.current) window.clearTimeout(undoTimer.current);
            undoTimer.current = null;
            setUndoEntry(null);
          }}
        />
      )}

      <footer className="app-footer">
        {t(lang, "app.footer", { version: appVersion })}
      </footer>
    </div>
  );
}

const CATEGORY_PALETTE = [
  "#6366f1",
  "#ea580c",
  "#15803d",
  "#dc2626",
  "#0d9488",
  "#b45309",
  "#9333ea",
  "#0369a1",
  "#be123c",
  "#65a30d",
];

function pickCategoryColor(index: number): string {
  return CATEGORY_PALETTE[index % CATEGORY_PALETTE.length];
}
