import type { SupabaseClient } from "@supabase/supabase-js";
import { nowIso } from "./dates";
import {
  getDirtyCategories,
  getDirtyEntries,
  getEntry,
  markCategoryClean,
  markClean,
  upsertCategoryLocal,
  upsertLocal,
} from "./db";
import { saveSettings } from "./settings";
import type {
  AppSettings,
  Category,
  LogbookEntry,
  RemoteCategory,
  RemoteEntry,
  SyncStatus,
} from "./types";

function ts(s: string): number {
  const t = Date.parse(s);
  return isNaN(t) ? 0 : t;
}

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
    category_ids: parseIds(r.category_ids),
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

    const remoteTs = new Map<string, number>(existing.map((r) => [r.id, ts(r.updated_at)]));
    const toPush = dirty.filter((e) => {
      const rt = remoteTs.get(adapter.idOf(e)) ?? 0;
      return rt <= ts(adapter.touchedAt(e));
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

  // ---- PULL remote changes since watermark ----
  let query = client
    .from(table)
    .select(adapter.selectColumns)
    .gt("updated_at", watermark)
    .order("updated_at", { ascending: true })
    .limit(1000);

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
        .gt("updated_at", last)
        .order("updated_at", { ascending: true })
        .limit(1000);
    }
  }

  let maxRemoteTs = 0;
  for (const r of rows) {
    const updated = ts(String(r.updated_at ?? ""));
    maxRemoteTs = Math.max(maxRemoteTs, updated);
    const id = String(r.id);
    const local = await adapter.getLocal(id, userId);
    if (local && ts(adapter.touchedAt(local)) >= updated) continue;
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
    category_ids: JSON.stringify(e.category_ids ?? []),
    created_at: e.created_at,
    updated_at: e.updated_at,
    // 1/0 works for both BOOLEAN and INTEGER columns in PostgreSQL
    deleted: e.deleted ? 1 : 0,
  }),
  fromRemote: (r, userId) => toLocal(r as unknown as RemoteEntry, userId),
  touchedAt: (e) => e.updated_at,
  idOf: (e) => e.id,
};

const categoryAdapter: TableAdapter<Category> = {
  selectColumns: "*",
  getLocal: (id, userId) => getCategoryForSync(id, userId),
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
};

async function getCategoryForSync(id: string, userId: string): Promise<Category | null> {
  const all = await getDirtyCategories(userId);
  const dirty = all.find((c) => c.id === id);
  if (dirty) return dirty;
  // categories table has no direct getter; a dirty row is the only local copy
  // that matters for the LWW check — clean rows are always overwritten on pull.
  return null;
}

/**
 * One sync cycle: push local dirty rows, then pull remote changes since the
 * last watermark. Last-write-wins on updated_at. Soft deletes propagate both
 * ways. Covers logbook_entries and categories with a shared watermark.
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
    const [entryTs, catTs] = await Promise.all([
      syncTable(client, "logbook_entries", userId, watermark, getDirtyEntries, entryAdapter),
      syncTable(client, "categories", userId, watermark, getDirtyCategories, categoryAdapter),
    ]);

    const maxRemoteTs = Math.max(entryTs, catTs);
    const newWatermark = maxRemoteTs > 0 ? new Date(maxRemoteTs).toISOString() : settings.lastSyncAt;
    const nextSettings: AppSettings = { ...settings, lastSyncAt: newWatermark };
    saveSettings(nextSettings);

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
