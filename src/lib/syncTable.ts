import type { SupabaseClient } from "@supabase/supabase-js";
import { localNewerThan, parseTs, shouldDeletePhotos } from "./syncLogic";

export interface TableAdapter<TLocal> {
  selectColumns: string;
  getLocal: (id: string, userId: string) => Promise<TLocal | null>;
  upsertLocal: (row: TLocal) => Promise<void>;
  markClean: (id: string) => Promise<void>;
  payload: (row: TLocal) => Record<string, unknown>;
  /** remote row -> local row (only called for rows newer than local) */
  fromRemote: (r: Record<string, unknown>, userId: string) => TLocal;
  touchedAt: (row: TLocal) => string;
  idOf: (row: TLocal) => string;
  /** kolom UNIQUE untuk upsert remote (default "id") */
  onConflictColumn?: string;
  /** kolom kunci untuk query push/pull remote (default "id") */
  remoteKeyColumn?: string;
  /** dipanggil sebelum baris lokal dihapus karena remote berstatus deleted (soft delete) */
  onRemoteDelete?: (row: TLocal, client: SupabaseClient) => Promise<void>;
  /** true = pull TANPA watermark (untuk tabel sangat kecil, mis. categories). */
  fullPull?: boolean;
}

export interface SyncTableResult {
  maxTs: number;
  blocked: boolean;
}

const PAGE_SIZE = 1000;

/**
 * One push+pull cycle for a table, sharing the sync watermark.
 * Returns the newest updated_at seen remotely (0 if nothing pulled).
 */
export async function syncTable<TLocal>(
  client: SupabaseClient,
  table: string,
  userId: string,
  watermark: string,
  getDirty: (userId: string) => Promise<TLocal[]>,
  adapter: TableAdapter<TLocal>
): Promise<SyncTableResult> {
  // ---- PUSH local dirty rows ----
  const dirty = await getDirty(userId);
  if (dirty.length > 0) {
    const keyCol = adapter.remoteKeyColumn ?? "id";
    const ids = dirty.map(adapter.idOf);
    const existing: { id: string; updated_at: string }[] = [];
    for (let i = 0; i < ids.length; i += 40) {
      const chunk = ids.slice(i, i + 40);
      const { data, error } = await client
        .from(table)
        .select(`${keyCol}, updated_at` as unknown as string)
        .in(keyCol, chunk);
      if (error) throw error;
      existing.push(
        ...(((data as unknown as { updated_at: string }[] | null) ?? []).map((r) => ({
          id: String((r as Record<string, unknown>)[keyCol]),
          updated_at: r.updated_at,
        })))
      );
    }

    const remoteTs = new Map<string, number>(existing.map((r) => [String(r.id), parseTs(r.updated_at)]));
    const toPush = dirty.filter((e) => {
      const rt = remoteTs.get(adapter.idOf(e)) ?? 0;
      return rt <= parseTs(adapter.touchedAt(e));
    });

    if (toPush.length > 0) {
      const { error: upsertErr } = await client
        .from(table)
        .upsert(toPush.map(adapter.payload), { onConflict: adapter.onConflictColumn ?? "id" });
      if (upsertErr) throw upsertErr;
      for (const row of toPush) {
        await adapter.markClean(adapter.idOf(row));
      }
    }
  }

  // ---- PULL remote changes (watermark, atau semua baris user jika fullPull) ----
  const pullKeyCol = adapter.remoteKeyColumn ?? "id";
  const rows: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = client
      .from(table)
      .select(adapter.selectColumns)
      .eq("user_id", userId)
      .order("updated_at", { ascending: true })
      .order(pullKeyCol, { ascending: true });
    if (!adapter.fullPull) query = query.gt("updated_at", watermark);
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data as unknown as Record<string, unknown>[]) ?? [];
    for (const r of page) {
      const key = String(r[pullKeyCol]);
      if (!seen.has(key)) {
        seen.add(key);
        rows.push(r);
      }
    }
    if (page.length < PAGE_SIZE) break;
  }

  let maxRemoteTs = 0;
  let blocked = false;
  for (const r of rows) {
    const updated = parseTs(String(r.updated_at ?? ""));
    maxRemoteTs = Math.max(maxRemoteTs, updated);
    const id = String(r[pullKeyCol]);
    const local = await adapter.getLocal(id, userId);
    // Guard LWW: skip hanya jika lokal benar-benar LEBIH BARU. Baris dengan
    // timestamp sama dengan remote (di-pull oleh versi klien lama yang belum
    // mengisi kolom baru) tetap diterapkan, sehingga perangkat lama tertarik
    // ke versi terbaru.
    if (local && localNewerThan(adapter.touchedAt(local), String(r.updated_at ?? ""))) continue;
    if (r.deleted && local && adapter.onRemoteDelete) {
      // Jangan majukan watermark melewati tombstone yang masih dalam masa undo,
      // supaya sync berikutnya tetap bisa menerapkannya setelah grace period.
      if (!shouldDeletePhotos(String(r.updated_at ?? ""))) {
        blocked = true;
        continue;
      }
      await adapter.onRemoteDelete(local, client);
    }
    await adapter.upsertLocal(adapter.fromRemote(r, userId));
  }
  return { maxTs: maxRemoteTs, blocked };
}
