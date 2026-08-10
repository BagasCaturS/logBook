import Database from "@tauri-apps/plugin-sql";
import type { EntryInput, LogbookEntry } from "./types";
import { nowIso } from "./dates";

interface Row {
  id: string;
  user_id: string;
  kegiatan: string;
  tanggal: string;
  minggu: number;
  hari_ke: number | null;
  created_at: string;
  updated_at: string;
  deleted: number;
  dirty: number;
}

let db: Database | null = null;

export async function ensureDb(): Promise<Database> {
  if (db) return db;
  db = await Database.load("sqlite:logbook.db");
  await db.execute(`
    CREATE TABLE IF NOT EXISTS logbook_entries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      kegiatan TEXT NOT NULL,
      tanggal TEXT NOT NULL,
      minggu INTEGER NOT NULL,
      hari_ke INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0,
      dirty INTEGER NOT NULL DEFAULT 0
    )
  `);
  await db.execute(
    "CREATE INDEX IF NOT EXISTS idx_entries_user_tanggal ON logbook_entries (user_id, tanggal DESC)"
  );
  return db;
}

function mapRow(r: Row): LogbookEntry {
  return {
    id: r.id,
    user_id: r.user_id,
    kegiatan: r.kegiatan,
    tanggal: r.tanggal.slice(0, 10),
    minggu: r.minggu,
    hari_ke: r.hari_ke ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
    deleted: r.deleted === 1,
    dirty: r.dirty === 1,
  };
}

export async function listEntries(userId: string): Promise<LogbookEntry[]> {
  const d = await ensureDb();
  const rows = await d.select<Row[]>(
    `SELECT * FROM logbook_entries WHERE user_id = $1 AND deleted = 0
     ORDER BY tanggal DESC, created_at DESC`,
    [userId]
  );
  return rows.map(mapRow);
}

export async function getEntry(id: string, userId: string): Promise<LogbookEntry | null> {
  const d = await ensureDb();
  const rows = await d.select<Row[]>(
    "SELECT * FROM logbook_entries WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
  return rows.length ? mapRow(rows[0]) : null;
}

export async function addEntry(userId: string, input: EntryInput): Promise<LogbookEntry> {
  const d = await ensureDb();
  const entry: LogbookEntry = {
    id: crypto.randomUUID(),
    user_id: userId,
    kegiatan: input.kegiatan.trim(),
    tanggal: input.tanggal,
    minggu: input.minggu,
    hari_ke: input.hari_ke,
    created_at: nowIso(),
    updated_at: nowIso(),
    deleted: false,
    dirty: true,
  };
  await d.execute(
    `INSERT INTO logbook_entries (id, user_id, kegiatan, tanggal, minggu, hari_ke, created_at, updated_at, deleted, dirty)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, 1)`,
    [
      entry.id,
      entry.user_id,
      entry.kegiatan,
      entry.tanggal,
      entry.minggu,
      entry.hari_ke,
      entry.created_at,
      entry.updated_at,
    ]
  );
  return entry;
}

export async function updateEntry(
  id: string,
  userId: string,
  patch: Partial<EntryInput>
): Promise<LogbookEntry | null> {
  const d = await ensureDb();
  const existing = await getEntry(id, userId);
  if (!existing) return null;

  const kegiatan = patch.kegiatan !== undefined ? patch.kegiatan.trim() : existing.kegiatan;
  const tanggal = patch.tanggal ?? existing.tanggal;
  const minggu = patch.minggu ?? existing.minggu;
  const hari_ke = patch.hari_ke !== undefined ? patch.hari_ke : existing.hari_ke;
  const updated_at = nowIso();

  await d.execute(
    `UPDATE logbook_entries
     SET kegiatan = $1, tanggal = $2, minggu = $3, hari_ke = $4, updated_at = $5, dirty = 1
     WHERE id = $6 AND user_id = $7`,
    [kegiatan, tanggal, minggu, hari_ke, updated_at, id, userId]
  );

  return { ...existing, kegiatan, tanggal, minggu, hari_ke, updated_at, dirty: true };
}

export async function deleteEntry(id: string, userId: string): Promise<void> {
  const d = await ensureDb();
  await d.execute(
    `UPDATE logbook_entries SET deleted = 1, dirty = 1, updated_at = $1 WHERE id = $2 AND user_id = $3`,
    [nowIso(), id, userId]
  );
}

export async function getDirtyEntries(userId: string): Promise<LogbookEntry[]> {
  const d = await ensureDb();
  const rows = await d.select<Row[]>(
    `SELECT * FROM logbook_entries WHERE user_id = $1 AND dirty = 1`,
    [userId]
  );
  return rows.map(mapRow);
}

export async function markClean(id: string): Promise<void> {
  const d = await ensureDb();
  await d.execute("UPDATE logbook_entries SET dirty = 0 WHERE id = $1", [id]);
}

export async function upsertLocal(entry: LogbookEntry): Promise<void> {
  const d = await ensureDb();
  if (entry.deleted) {
    await d.execute(
      "DELETE FROM logbook_entries WHERE id = $1 AND user_id = $2",
      [entry.id, entry.user_id]
    );
    return;
  }
  await d.execute(
    `INSERT INTO logbook_entries (id, user_id, kegiatan, tanggal, minggu, hari_ke, created_at, updated_at, deleted, dirty)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, 0)
     ON CONFLICT (id) DO UPDATE SET
       kegiatan = excluded.kegiatan,
       tanggal = excluded.tanggal,
       minggu = excluded.minggu,
       hari_ke = excluded.hari_ke,
       created_at = excluded.created_at,
       updated_at = excluded.updated_at,
       deleted = 0,
       dirty = 0`,
    [
      entry.id,
      entry.user_id,
      entry.kegiatan,
      entry.tanggal,
      entry.minggu,
      entry.hari_ke,
      entry.created_at,
      entry.updated_at,
    ]
  );
}
