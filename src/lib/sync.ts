import type { SupabaseClient } from "@supabase/supabase-js";
import { nowIso } from "./dates";
import { syncTable, type TableAdapter } from "./syncTable";
import {
  getCategory,
  getDailyNote,
  getDirtyCategories,
  getDirtyEntries,
  getDirtyNotes,
  getDirtySettingsRows,
  getEntry,
  getSettingsRow,
  listDeletedEntriesSince,
  listEntries,
  listEntriesWithLocalPhotos,
  markCategoryClean,
  markClean,
  markNoteClean,
  markSettingsClean,
  purgeTombstones,
  updateEntry,
  upsertCategoryLocal,
  upsertLocal,
  upsertNoteLocal,
  upsertSettingsLocal,
  type SettingsSyncRow,
} from "./db";
import { noteIdFor } from "./notes";
import { cleanupOrphanPhotos, deletePhotos, uploadLocalPhoto } from "./photos";
import { isLocalPhoto, localPhotoId, localPhotoKind, photoKey } from "./photoPaths";
import { applyRemoteSettings, saveSettings } from "./settings";
import { PHOTO_DELETE_GRACE_MS, shouldDeletePhotos } from "./syncLogic";
import type {
  AppSettings,
  Category,
  DailyNote,
  LogbookEntry,
  RemoteAppSettings,
  RemoteCategory,
  RemoteDailyNote,
  RemoteEntry,
  SyncStatus,
} from "./types";

function parseIds(raw: string | string[] | null | undefined): string[] {
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === "string");
  if (typeof raw === "string" && raw.trim().startsWith("[")) {
    try {
      const v = JSON.parse(raw);
      return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  }
  return [];
}

function toLocal(r: RemoteEntry, userId: string): LogbookEntry {
  return {
    id: r.id,
    user_id: userId,
    kegiatan: r.kegiatan,
    tanggal: (r.tanggal ?? "").slice(0, 10),
    minggu: r.minggu,
    hari_ke: r.hari_ke ?? null,
    jam: typeof r.jam === "number" ? r.jam : null,
    category_ids: parseIds(r.category_ids),
    photo_paths: parseIds(r.photo_paths),
    created_at: r.created_at,
    updated_at: r.updated_at,
    deleted: !!r.deleted,
    dirty: false,
  };
}

function toLocalCategory(r: RemoteCategory, userId: string): Category {
  return {
    id: r.id,
    user_id: userId,
    name: r.name,
    color: r.color,
    created_at: r.created_at,
    updated_at: r.updated_at,
    deleted: !!r.deleted,
    dirty: false,
  };
}

function toLocalNote(r: RemoteDailyNote, userId: string): DailyNote {
  const legacyId = `note-${r.tanggal}`;
  return {
    id: r.id === legacyId ? noteIdFor(userId, r.tanggal) : r.id,
    user_id: userId,
    tanggal: (r.tanggal ?? "").slice(0, 10),
    isi: r.isi ?? "",
    created_at: r.created_at,
    updated_at: r.updated_at,
    deleted: !!r.deleted,
    dirty: false,
  };
}

const entryAdapter: TableAdapter<LogbookEntry> = {
  selectColumns: "*",
  getLocal: (id, userId) => getEntry(id, userId),
  upsertLocal,
  markClean,
  payload: (e) => ({
    id: e.id,
    user_id: e.user_id,
    kegiatan: e.kegiatan,
    tanggal: e.tanggal,
    minggu: e.minggu,
    hari_ke: e.hari_ke,
    jam: e.jam ?? null,
    category_ids: JSON.stringify(e.category_ids ?? []),
    photo_paths: JSON.stringify((e.photo_paths ?? []).filter((p) => !isLocalPhoto(p))),
    created_at: e.created_at,
    updated_at: e.updated_at,
    // 1/0 works for both BOOLEAN and INTEGER columns in PostgreSQL
    deleted: e.deleted ? 1 : 0,
  }),
  fromRemote: (r, userId) => toLocal(r as unknown as RemoteEntry, userId),
  touchedAt: (e) => e.updated_at,
  idOf: (e) => e.id,
  onRemoteDelete: async (e, client) => {
    if (!shouldDeletePhotos(e.updated_at)) return;
    const paths = (e.photo_paths ?? []).filter((p) => !isLocalPhoto(p));
    if (paths.length > 0) await deletePhotos(client, paths);
  },
};

const categoryAdapter: TableAdapter<Category> = {
  selectColumns: "*",
  getLocal: (id, userId) => getCategory(id, userId),
  upsertLocal: upsertCategoryLocal,
  markClean: markCategoryClean,
  payload: (c) => ({
    id: c.id,
    user_id: c.user_id,
    name: c.name,
    color: c.color,
    created_at: c.created_at,
    updated_at: c.updated_at,
    // 1/0 works for both BOOLEAN and INTEGER columns in PostgreSQL
    deleted: c.deleted ? 1 : 0,
  }),
  fromRemote: (r, userId) => toLocalCategory(r as unknown as RemoteCategory, userId),
  touchedAt: (c) => c.updated_at,
  idOf: (c) => c.id,
  // tabel kecil: pull penuh tiap sync agar baris lama yang terlewat
  // watermark tetap terambil (mis. kategori dibuat sebelum perangkat
  // mengenal fitur kategori).
  fullPull: true,
};

const dailyNoteAdapter: TableAdapter<DailyNote> = {
  selectColumns: "*",
  getLocal: (id, userId) => getDailyNote(id, userId),
  upsertLocal: upsertNoteLocal,
  markClean: markNoteClean,
  payload: (n) => ({
    id: n.id,
    user_id: n.user_id,
    tanggal: n.tanggal,
    isi: n.isi,
    created_at: n.created_at,
    updated_at: n.updated_at,
    // 1/0 works for both BOOLEAN and INTEGER columns in PostgreSQL
    deleted: n.deleted ? 1 : 0,
  }),
  fromRemote: (r, userId) => toLocalNote(r as unknown as RemoteDailyNote, userId),
  touchedAt: (n) => n.updated_at,
  idOf: (n) => n.id,
};

const settingsAdapter: TableAdapter<SettingsSyncRow> = {
  selectColumns: "*",
  getLocal: (userId) => getSettingsRow(userId),
  upsertLocal: upsertSettingsLocal,
  markClean: markSettingsClean,
  payload: (s) => ({
    user_id: s.userId,
    start_date: s.startDate,
    hour_start: s.hourStart,
    hour_label: s.hourLabel,
    theme: s.theme,
    lang: s.lang,
    created_at: s.created_at,
    updated_at: s.updated_at,
    // 1/0 works for both BOOLEAN and INTEGER columns in PostgreSQL
    deleted: s.deleted ? 1 : 0,
  }),
  fromRemote: (r, userId) => {
    const rv = r as unknown as RemoteAppSettings;
    return {
      userId,
      startDate: rv.start_date ?? "",
      hourStart: rv.hour_start ?? "11:00",
      hourLabel: rv.hour_label ?? "hour",
      theme: rv.theme ?? "jurnal",
      lang: rv.lang ?? "id",
      created_at: rv.created_at ?? "",
      updated_at: rv.updated_at ?? "",
      deleted: !!rv.deleted,
      dirty: false,
    };
  },
  touchedAt: (s) => s.updated_at,
  idOf: (s) => s.userId,
  // satu baris per user: konflik diupsert on user_id
  onConflictColumn: "user_id",
  remoteKeyColumn: "user_id",
  // pull penuh: perubahan pengaturan di perangkat lain selalu terambil
  fullPull: true,
};

async function migrateLocalPhotos(client: SupabaseClient, userId: string): Promise<void> {
  let failed: unknown;
  for (const entry of await listEntriesWithLocalPhotos(userId)) {
    try {
      const current = entry.photo_paths ?? [];
      const cloudKeys = new Set(current.filter((p) => !isLocalPhoto(p)).map(photoKey));
      const paths: string[] = [];
      for (const path of current) {
        if (!isLocalPhoto(path)) {
          paths.push(path);
          continue;
        }
        const kind = localPhotoKind(path);
        // Foto "lokal saja" tidak pernah diunggah.
        if (kind === "only") {
          paths.push(path);
          continue;
        }
        // Cache "keduanya" sudah punya pasangan cloud.
        if (kind === "both" && cloudKeys.has(photoKey(path))) {
          paths.push(path);
          continue;
        }
        const cloud = await uploadLocalPhoto(
          client,
          userId,
          path,
          kind === "both" ? localPhotoId(path) ?? undefined : undefined
        );
        if (kind === "both") paths.push(cloud, path);
        else paths.push(cloud);
      }
      if (paths.length !== current.length || paths.some((p, i) => p !== current[i])) {
        await updateEntry(entry.id, userId, { photo_paths: paths });
      }
    } catch (e) {
      failed = e;
    }
  }
  if (failed) throw failed;
}

/**
 * One sync cycle: push local dirty rows, then pull remote changes since the
 * last watermark (full table for fullPull adapters). Last-write-wins on
 * updated_at. Soft deletes propagate both ways. Covers logbook_entries and
 * categories with a shared watermark.
 */
export async function syncNow(
  client: SupabaseClient | null,
  userId: string | null,
  settings: AppSettings,
  onStatus: (s: SyncStatus) => void
): Promise<SyncStatus> {
  if (!client || !userId || settings.mode !== "supabase") {
    const status: SyncStatus = { state: "offline", lastSyncAt: settings.lastSyncAt };
    onStatus(status);
    return status;
  }

  onStatus({ state: "syncing", lastSyncAt: settings.lastSyncAt });

  try {
    await migrateLocalPhotos(client, userId);
    const watermark = settings.syncWatermark ?? "1970-01-01T00:00:00.000Z";
    const results = await Promise.all([
      syncTable(client, "logbook_entries", userId, watermark, getDirtyEntries, entryAdapter),
      syncTable(client, "categories", userId, watermark, getDirtyCategories, categoryAdapter),
      syncTable(client, "daily_notes", userId, watermark, getDirtyNotes, dailyNoteAdapter),
      syncTable(client, "app_settings", userId, watermark, getDirtySettingsRows, settingsAdapter),
    ]);

    const blocked = results.some((r) => r.blocked);
    const maxRemoteTs = Math.max(...results.map((r) => r.maxTs));
    const newWatermark = blocked
      ? settings.syncWatermark ?? watermark
      : maxRemoteTs > 0
        ? new Date(maxRemoteTs).toISOString()
        : settings.syncWatermark;
    const completedAt = nowIso();
    const nextSettings: AppSettings = {
      ...settings,
      lastSyncAt: completedAt,
      syncWatermark: newWatermark,
    };
    saveSettings(nextSettings);

    // Terapkan pengaturan cloud ke localStorage bila baris staging bersih
    // (artinya tidak ada edit lokal yang belum ter-push — konflik menang LWW).
    const settingsRow = await getSettingsRow(userId);
    if (settingsRow && !settingsRow.dirty) {
      saveSettings(applyRemoteSettings(nextSettings, settingsRow));
    }

    // Bersihkan foto yatim di bucket: hapus file yang tidak dirujuk entri hidup.
    // Kegagalan di sini tidak menggagalkan sinkronisasi.
    try {
      const live = await listEntries(userId);
      const recent = await listDeletedEntriesSince(
        userId,
        new Date(Date.now() - PHOTO_DELETE_GRACE_MS).toISOString()
      );
      const referenced = new Set(
        [...live, ...recent].flatMap((e) => e.photo_paths ?? [])
      );
      await cleanupOrphanPhotos(client, userId, referenced);
    } catch {
      // abaikan
    }

    await purgeTombstones(userId, new Date(Date.now() - 30 * 86_400_000).toISOString());

    const status: SyncStatus = {
      state: "online",
      lastSyncAt: completedAt,
    };
    onStatus(status);
    return status;
  } catch (err) {
    const status: SyncStatus = {
      state: "error",
      lastSyncAt: settings.lastSyncAt,
      error: errMessage(err),
    };
    onStatus(status);
    return status;
  }
}

export function errMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "object" && err !== null) {
    const e = err as Record<string, unknown>;
    const msg = typeof e.message === "string" ? e.message : "";
    if (typeof e.code === "string") {
      return e.code ? `${e.code}: ${msg}` : msg;
    }
    if (msg) return msg;
    try {
      return JSON.stringify(e);
    } catch {
      return String(err);
    }
  }
  return String(err);
}
