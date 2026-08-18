import type { SupabaseClient } from "@supabase/supabase-js";
import { nowIso } from "./dates";
import {
  getCategory,
  getDailyNote,
  getDirtyCategories,
  getDirtyEntries,
  getDirtyNotes,
  getEntry,
  listEntries,
  markCategoryClean,
  markClean,
  markNoteClean,
  upsertCategoryLocal,
  upsertLocal,
  upsertNoteLocal,
} from "./db";
import { cleanupOrphanPhotos, deletePhotos } from "./photos";
import { saveSettings } from "./settings";
import { localNewerThan, parseTs } from "./syncLogic";
import type {
  AppSettings,
  Category,
  DailyNote,
  LogbookEntry,
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
  return {
    id: r.id,
    user_id: userId,
    tanggal: (r.tanggal ?? "").slice(0, 10),
    isi: r.isi ?? "",
    created_at: r.created_at,
    updated_at: r.updated_at,
    deleted: !!r.deleted,
    dirty: false,
  };
}

interface TableAdapter<TLocal> {
  selectColumns: string;
  getLocal: (id: string, userId: string) => Promise<TLocal | null>;
  upsertLocal: (row: TLocal) => Promise<void>;
  markClean: (id: string) => Promise<void>;
  payload: (row: TLocal) => Record<string, unknown>;
  /** remote row -> local row (only called for rows newer than local) */
  fromRemote: (r: Record<string, unknown>, userId: string) => TLocal;
  touchedAt: (row: TLocal) => string;
  idOf: (row: TLocal) => string;
  /** dipanggil sebelum baris lokal dihapus karena remote berstatus deleted (soft delete) */
  onRemoteDelete?: (row: TLocal, client: SupabaseClient) => Promise<void>;
  /**
   * true = pull TANPA watermark (ambil semua baris user). Dipakai untuk tabel
   * kecil (categories) agar baris yang `updated_at`-nya lebih tua dari
   * watermark perangkat tetap terambil — menutup celah "baris terlewat
   * selamanya" saat fitur baru diperkenalkan.
   */
  fullPull?: boolean;
}

/**
 * One push+pull cycle for a table, sharing the sync watermark.
 * Returns the newest updated_at seen remotely (0 if nothing pulled).
 */
async function syncTable<TLocal>(
  client: SupabaseClient,
  table: string,
  userId: string,
  watermark: string,
  getDirty: (userId: string) => Promise<TLocal[]>,
  adapter: TableAdapter<TLocal>
): Promise<number> {
  // ---- PUSH local dirty rows ----
  const dirty = await getDirty(userId);
  if (dirty.length > 0) {
    const ids = dirty.map(adapter.idOf);
    const existing: { id: string; updated_at: string }[] = [];
    for (let i = 0; i < ids.length; i += 40) {
      const chunk = ids.slice(i, i + 40);
      const { data, error } = await client
        .from(table)
        .select("id, updated_at")
        .in("id", chunk);
      if (error) throw error;
      existing.push(...((data as { id: string; updated_at: string }[]) ?? []));
    }

    const remoteTs = new Map<string, number>(existing.map((r) => [r.id, parseTs(r.updated_at)]));
    const toPush = dirty.filter((e) => {
      const rt = remoteTs.get(adapter.idOf(e)) ?? 0;
      return rt <= parseTs(adapter.touchedAt(e));
    });

    if (toPush.length > 0) {
      const { error: upsertErr } = await client
        .from(table)
        .upsert(toPush.map(adapter.payload), { onConflict: "id" });
      if (upsertErr) throw upsertErr;
      for (const row of toPush) {
        await adapter.markClean(adapter.idOf(row));
      }
    }
  }

  // ---- PULL remote changes (watermark, atau semua baris user jika fullPull) ----
  let query = client
    .from(table)
    .select(adapter.selectColumns)
    .eq("user_id", userId)
    .order("updated_at", { ascending: true })
    .limit(1000);
  if (!adapter.fullPull) {
    query = query.gt("updated_at", watermark);
  }

  let rows: Record<string, unknown>[] = [];
  let stop = false;
  while (!stop) {
    const { data, error } = await query;
    if (error) throw error;
    rows = rows.concat((data as unknown as Record<string, unknown>[]) ?? []);
    stop = !data || data.length < 1000;
    if (!stop && data.length > 0) {
      const last = (data[data.length - 1] as unknown as { updated_at: string }).updated_at;
      query = client
        .from(table)
        .select(adapter.selectColumns)
        .eq("user_id", userId)
        .gt("updated_at", last)
        .order("updated_at", { ascending: true })
        .limit(1000);
    }
  }

  let maxRemoteTs = 0;
  for (const r of rows) {
    const updated = parseTs(String(r.updated_at ?? ""));
    maxRemoteTs = Math.max(maxRemoteTs, updated);
    const id = String(r.id);
    const local = await adapter.getLocal(id, userId);
    // Guard LWW: skip hanya jika lokal benar-benar LEBIH BARU. Baris dengan
    // timestamp sama dengan remote (di-pull oleh versi klien lama yang belum
    // mengenal kolom fitur baru) tetap di-re-pull, sehingga kolom baru
    // (jam, category_ids, photo_paths, ...) ikut terisi setelah update.
    if (local && localNewerThan(adapter.touchedAt(local), String(r.updated_at ?? ""))) continue;
    if (r.deleted && local && adapter.onRemoteDelete) {
      await adapter.onRemoteDelete(local, client);
    }
    await adapter.upsertLocal(adapter.fromRemote(r, userId));
  }
  return maxRemoteTs;
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
    photo_paths: JSON.stringify(e.photo_paths ?? []),
    created_at: e.created_at,
    updated_at: e.updated_at,
    // 1/0 works for both BOOLEAN and INTEGER columns in PostgreSQL
    deleted: e.deleted ? 1 : 0,
  }),
  fromRemote: (r, userId) => toLocal(r as unknown as RemoteEntry, userId),
  touchedAt: (e) => e.updated_at,
  idOf: (e) => e.id,
  onRemoteDelete: async (e, client) => {
    const paths = e.photo_paths ?? [];
    if (paths.length > 0) await deletePhotos(client, paths);
  },
  // pull penuh tiap sync: baris yang `updated_at`-nya lebih tua dari
  // watermark perangkat tetap terambil, termasuk perubahan konten lama
  // (category_ids, photo_paths) yang dibuat saat perangkat masih di versi
  // yang tidak mengenal kolom tersebut. Skala logbook pribadi sangat kecil,
  // LWW mencegah penulisan ulang baris yang identik.
  fullPull: true,
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
  // satu catatan per tanggal (id deterministic): pull penuh agar catatan
  // yang dibuat di perangkat lain selalu terambil, termasuk lintas versi.
  fullPull: true,
};

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
  if (!client || !userId) {
    const status: SyncStatus = { state: "offline", lastSyncAt: settings.lastSyncAt };
    onStatus(status);
    return status;
  }

  onStatus({ state: "syncing", lastSyncAt: settings.lastSyncAt });

  try {
    const watermark = settings.lastSyncAt ?? "1970-01-01T00:00:00.000Z";
    const [entryTs, catTs, noteTs] = await Promise.all([
      syncTable(client, "logbook_entries", userId, watermark, getDirtyEntries, entryAdapter),
      syncTable(client, "categories", userId, watermark, getDirtyCategories, categoryAdapter),
      syncTable(client, "daily_notes", userId, watermark, getDirtyNotes, dailyNoteAdapter),
    ]);

    const maxRemoteTs = Math.max(entryTs, catTs, noteTs);
    const newWatermark = maxRemoteTs > 0 ? new Date(maxRemoteTs).toISOString() : settings.lastSyncAt;
    const nextSettings: AppSettings = { ...settings, lastSyncAt: newWatermark };
    saveSettings(nextSettings);

    // Bersihkan foto yatim di bucket: hapus file yang tidak dirujuk entri hidup.
    // Kegagalan di sini tidak menggagalkan sinkronisasi.
    try {
      const live = await listEntries(userId);
      const referenced = new Set(live.flatMap((e) => e.photo_paths ?? []));
      await cleanupOrphanPhotos(client, userId, referenced);
    } catch {
      // abaikan
    }

    const status: SyncStatus = {
      state: "online",
      lastSyncAt: newWatermark ?? nowIso(),
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

export function isLikelyOfflineError(err: unknown): boolean {
  const m = err instanceof Error ? err.message : String(err);
  return (
    m.includes("fetch") ||
    m.includes("network") ||
    m.includes("Failed to fetch") ||
    m.includes("ECONNREFUSED") ||
    m.includes("timeout")
  );
}
