import type { SupabaseClient } from "@supabase/supabase-js";
import { nowIso } from "./dates";
import { getDirtyEntries, getEntry, markClean, upsertLocal } from "./db";
import { saveSettings } from "./settings";
import type { AppSettings, LogbookEntry, RemoteEntry, SyncStatus } from "./types";

function ts(s: string): number {
  const t = Date.parse(s);
  return isNaN(t) ? 0 : t;
}

function toLocal(r: RemoteEntry, userId: string): LogbookEntry {
  return {
    id: r.id,
    user_id: userId,
    kegiatan: r.kegiatan,
    tanggal: (r.tanggal ?? "").slice(0, 10),
    minggu: r.minggu,
    hari_ke: r.hari_ke ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
    deleted: !!r.deleted,
    dirty: false,
  };
}

/**
 * One sync cycle: push local dirty rows, then pull remote changes since the
 * last watermark. Last-write-wins on updated_at. Soft deletes propagate both
 * ways.
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
    // ---- PUSH local dirty rows ----
    const dirty = await getDirtyEntries(userId);
    if (dirty.length > 0) {
      const ids = dirty.map((e) => e.id);
      const existing = [];
      // chunk to stay under PostgREST URL length limits
      for (let i = 0; i < ids.length; i += 40) {
        const chunk = ids.slice(i, i + 40);
        const { data, error } = await client
          .from("logbook_entries")
          .select("id, updated_at")
          .in("id", chunk);
        if (error) throw error;
        existing.push(...(data ?? []));
      }

      const remoteTs = new Map<string, number>((existing ?? []).map((r) => [r.id, ts(r.updated_at)]));
      const toPush = dirty.filter((e) => {
        const rt = remoteTs.get(e.id) ?? 0;
        return rt <= ts(e.updated_at);
      });

      if (toPush.length > 0) {
        const payload = toPush.map((e) => ({
          id: e.id,
          user_id: e.user_id,
          kegiatan: e.kegiatan,
          tanggal: e.tanggal,
          minggu: e.minggu,
          hari_ke: e.hari_ke,
          created_at: e.created_at,
          updated_at: e.updated_at,
          deleted: e.deleted,
        }));
        const { error: upsertErr } = await client
          .from("logbook_entries")
          .upsert(payload, { onConflict: "id" });
        if (upsertErr) throw upsertErr;

        for (const e of toPush) {
          // tombstone stays in cloud, gets dropped locally on the next pull
          await markClean(e.id);
        }
      }
    }

    // ---- PULL remote changes since watermark ----
    const watermark = settings.lastSyncAt ?? "1970-01-01T00:00:00.000Z";
    let query = client
      .from("logbook_entries")
      .select("*")
      .gt("updated_at", watermark)
      .order("updated_at", { ascending: true })
      .limit(1000);

    let rows: RemoteEntry[] = [];
    let stop = false;
    while (!stop) {
      const { data, error } = await query;
      if (error) throw error;
      rows = rows.concat(data ?? []);
      stop = !data || data.length < 1000;
      if (!stop && data.length > 0) {
        const last = data[data.length - 1].updated_at;
        query = client
          .from("logbook_entries")
          .select("*")
          .gt("updated_at", last)
          .order("updated_at", { ascending: true })
          .limit(1000);
      }
    }

    let maxRemoteTs = 0;
    for (const r of rows) {
      maxRemoteTs = Math.max(maxRemoteTs, ts(r.updated_at));
      const local = await getEntry(r.id, userId);
      if (local && ts(local.updated_at) >= ts(r.updated_at)) continue;
      await upsertLocal(toLocal(r, userId));
    }

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
      error: err instanceof Error ? err.message : String(err),
    };
    onStatus(status);
    return status;
  }
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
