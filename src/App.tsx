import { useCallback, useEffect, useRef, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import EntryForm from "./components/EntryForm";
import EntryList from "./components/EntryList";
import Login from "./components/Login";
import SettingsView from "./components/SettingsView";
import Setup from "./components/Setup";
import CalendarView from "./components/CalendarView";
import { IconBook, IconGear, IconRefresh } from "./components/icons";
import { addEntry, deleteEntry, listEntries, updateEntry } from "./lib/db";
import { formatDateTime } from "./lib/dates";
import { getClient, getCurrentSession, onAuthChange, signIn, signOut, signUp } from "./lib/supabase";
import { loadSettings, saveSettings } from "./lib/settings";
import { syncNow } from "./lib/sync";
import { DEFAULT_THEME } from "./lib/themes";
import { checkForUpdate, downloadAndInstall } from "./lib/update";
import type { AppSettings, EntryInput, LogbookEntry, SyncStatus } from "./lib/types";
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
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    state: "offline",
    lastSyncAt: initialSettings.lastSyncAt,
  });
  const [view, setView] = useState<"main" | "settings">("main");
  const [editing, setEditing] = useState<LogbookEntry | null>(null);
  const [formDate, setFormDate] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<LogbookEntry | null>(null);
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

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const syncTimer = useRef<number | null>(null);
  const syncInFlight = useRef(false);

  const refreshEntries = useCallback(async (userId: string) => {
    setEntries(await listEntries(userId));
  }, []);

  const runSync = useCallback(async () => {
    if (syncInFlight.current) return;
    syncInFlight.current = true;
    try {
      const s = settingsRef.current;
      const client = getClient(s);
      await syncNow(client, session?.userId ?? null, s, setSyncStatus);
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

  // restore session on boot
  useEffect(() => {
    (async () => {
      const s = loadSettings();
      const sess = await getCurrentSession(s);
      setSession(
        sess ? { userId: sess.user.id, email: sess.user.email } : null
      );
      setInitializing(false);
    })();
    const unsub = onAuthChange(loadSettings(), (sess) => {
      setSession(sess ? { userId: sess.user.id, email: sess.user.email } : null);
    });
    return () => {
      unsub();
      if (syncTimer.current) window.clearTimeout(syncTimer.current);
    };
  }, []);

  // load entries + start sync loop when session appears
  useEffect(() => {
    if (!session) {
      setEntries([]);
      return;
    }
    void refreshEntries(session.userId);
    void runSync();
    const interval = window.setInterval(() => void runSync(), SYNC_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [session?.userId, refreshEntries, runSync]);

  async function handleSaveSetup(url: string, key: string) {
    const next: AppSettings = { ...settingsRef.current, supabaseUrl: url, supabaseAnonKey: key };
    saveSettings(next);
    setSettings(next);
  }

  async function handleLogin(email: string, password: string, mode: "login" | "signup") {
    const s = settingsRef.current;
    const res =
      mode === "login" ? await signIn(s, email, password) : await signUp(s, email, password);
    if (res.error) {
      const msg = res.error.message;
      if (msg.toLowerCase().includes("invalid login credentials")) {
        return "Email atau password salah.";
      }
      return msg;
    }
    if (mode === "signup") {
      // session may already exist if email confirmation is disabled
      if (res.data.session) {
        setSession({ userId: res.data.session.user.id, email: res.data.session.user.email });
      }
      return null;
    }
    return null;
  }

  async function handleSaveEntry(input: EntryInput, id: string | null) {
    if (!session) return;
    if (id) {
      await updateEntry(id, session.userId, input);
    } else {
      await addEntry(session.userId, input);
    }
    await refreshEntries(session.userId);
    setEditing(null);
    setFormDate(null);
    queueSync();
  }

  function closeDialog() {
    if (dialogLeaving) return;
    setDialogLeaving(true);
    window.setTimeout(() => {
      setConfirmDelete(null);
      setDialogLeaving(false);
    }, 170);
  }

  async function handleConfirmDelete() {
    if (!session || !confirmDelete || dialogLeaving) return;
    const id = confirmDelete.id;
    setDialogLeaving(true);
    await delay(170);
    setConfirmDelete(null);
    setDialogLeaving(false);
    setLeavingId(id);
    await delay(260);
    await deleteEntry(id, session.userId);
    await refreshEntries(session.userId);
    setLeavingId(null);
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

  if (initializing) return <div className="setup">Memuat...</div>;

  if (!settings.supabaseUrl || !settings.supabaseAnonKey) {
    return (
      <Setup
        initialUrl={settings.supabaseUrl}
        initialKey={settings.supabaseAnonKey}
        onSave={handleSaveSetup}
      />
    );
  }

  if (!session) {
    return <Login onLogin={handleLogin} />;
  }

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
            <h1>Online Logbook</h1>
            <p className="tagline">Jurnal kegiatan magang</p>
          </div>
        </div>
        <div className="sync-info">
          <span className="sync-status">
            <span className={dotClass} title={syncStatus.error ?? syncStatus.state} />
            <span>
              {syncStatus.state === "syncing"
                ? "menyinkronkan..."
                : syncStatus.state === "online"
                  ? `tersinkron ${syncStatus.lastSyncAt ? formatDateTime(syncStatus.lastSyncAt) : ""}`
                  : syncStatus.state === "error"
                    ? "sinkron gagal (offline?)"
                    : "offline"}
            </span>
          </span>
          <button
            className={`secondary${syncStatus.state === "syncing" ? " syncing" : ""}`}
            disabled={syncStatus.state === "syncing"}
            onClick={async () => {
              await runSync();
              if (session) await refreshEntries(session.userId);
            }}
          >
            <IconRefresh size={15} />
            Sinkron Sekarang
          </button>
          <button
            className="secondary"
            onClick={() => {
              setView("settings");
            }}
          >
            <IconGear size={15} />
            Pengaturan
          </button>
        </div>
      </header>

      {view === "settings" ? (
        <SettingsView
          startDate={settings.startDate}
          theme={settings.theme}
          email={session.email}
          lastSyncAt={syncStatus.lastSyncAt}
          syncState={syncStatus.state}
          syncError={syncStatus.error}
          appVersion={appVersion}
          updateInfo={updateInfo}
          updateState={updateState}
          updateError={updateError}
          downloadProgress={downloadProgress}
          onCheckUpdate={() => void handleCheckUpdate()}
          onInstallUpdate={() => void handleInstallUpdate()}
          onSaveStartDate={(d) => {
            const next = { ...settingsRef.current, startDate: d };
            saveSettings(next);
            setSettings(next);
          }}
          onSaveTheme={(id) => {
            const next = { ...settingsRef.current, theme: id };
            saveSettings(next);
            setSettings(next);
          }}
          onLogout={() => void handleLogout()}
          onBack={() => setView("main")}
        />
      ) : (
        <main>
          {updateInfo && updateState !== "downloading" && (
            <div className="update-banner" role="status">
              <div className="update-banner-text">
                <strong>Update v{updateInfo.version} tersedia</strong>
                <span>
                  {updateState === "ready"
                    ? `Update terpasang — buka ulang aplikasi untuk memakai v${updateInfo.version}.`
                    : "Unduh dan pasang versi terbaru dari tombol di samping."}
                </span>
              </div>
              <button
                className="secondary"
                disabled={updateState === "ready"}
                onClick={() => void handleInstallUpdate()}
              >
                {updateState === "ready" ? "Terpasang" : "Pasang Sekarang"}
              </button>
            </div>
          )}
          <EntryForm
            startDate={settings.startDate}
            editing={editing}
            initialDate={formDate}
            onSave={handleSaveEntry}
            onCancel={() => {
              setEditing(null);
              setFormDate(null);
            }}
          />
          
          <CalendarView
            entries={entries}
            startDate={settings.startDate}
            leavingId={leavingId}
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
          />
          <EntryList
            entries={entries}
            leavingId={leavingId}
            onEdit={(e) => {
              setEditing(e);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            onDelete={(e) => setConfirmDelete(e)}
          />
        </main>
      )}

      {confirmDelete && (
        <div className={`overlay${dialogLeaving ? " leaving" : ""}`}>
          <div className={`dialog${dialogLeaving ? " leaving" : ""}`}>
            <p>Hapus catatan ini?</p>
            <p className="dialog-sub">{confirmDelete.kegiatan}</p>
            <div className="row actions">
              <button className="danger-btn" onClick={() => void handleConfirmDelete()}>
                Hapus
              </button>
              <button className="secondary" onClick={closeDialog}>
                Batal
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="app-footer">Online Logbook v{appVersion}</footer>
    </div>
  );
}
