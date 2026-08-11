import Database from "@tauri-apps/plugin-sql";
import type { Category, EntryInput, LogbookEntry } from "./types";
import { nowIso } from "./dates";

interface Row {
  id: string;
  user_id: string;
  kegiatan: string;
  tanggal: string;
  minggu: number;
  hari_ke: number | null;
  category_ids: string;
  created_at: string;
  updated_at: string;
  deleted: number;
  dirty: number;
}

interface CategoryRow {
  id: string;
  user_id: string;
  name: string;
  color: string;
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
  // migration: category_ids column (added in 0.5.0)
  const cols = await db.select<{ name: string }[]>("PRAGMA table_info(logbook_entries)");
  if (!cols.some((c) => c.name === "category_ids")) {
    await db.execute(
      "ALTER TABLE logbook_entries ADD COLUMN category_ids TEXT NOT NULL DEFAULT '[]'"
    );
  }
  await db.execute("CREATE INDEX IF NOT EXISTS idx_entries_user_tanggal ON logbook_entries (user_id, tanggal DESC)");
  await db.execute(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#6366f1',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0,
      dirty INTEGER NOT NULL DEFAULT 0
    )
  `);
  await db.execute("CREATE INDEX IF NOT EXISTS idx_categories_user ON categories (user_id)");
  return db;
}

function parseIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function mapRow(r: Row): LogbookEntry {
  return {
    id: r.id,
    user_id: r.user_id,
    kegiatan: r.kegiatan,
    tanggal: r.tanggal.slice(0, 10),
    minggu: r.minggu,
    hari_ke: r.hari_ke ?? null,
    category_ids: parseIds(r.category_ids),
    created_at: r.created_at,
    updated_at: r.updated_at,
    deleted: r.deleted === 1,
    dirty: r.dirty === 1,
  };
}

function mapCategory(r: CategoryRow): Category {
  return {
    id: r.id,
    user_id: r.user_id,
    name: r.name,
    color: r.color,
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
    category_ids: input.category_ids ?? [],
    created_at: nowIso(),
    updated_at: nowIso(),
    deleted: false,
    dirty: true,
  };
  await d.execute(
    `INSERT INTO logbook_entries (id, user_id, kegiatan, tanggal, minggu, hari_ke, category_ids, created_at, updated_at, deleted, dirty)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, 1)`,
    [
      entry.id,
      entry.user_id,
      entry.kegiatan,
      entry.tanggal,
      entry.minggu,
      entry.hari_ke,
      JSON.stringify(entry.category_ids),
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
  const category_ids = patch.category_ids ?? existing.category_ids;
  const updated_at = nowIso();

  await d.execute(
    `UPDATE logbook_entries
     SET kegiatan = $1, tanggal = $2, minggu = $3, hari_ke = $4, category_ids = $5, updated_at = $6, dirty = 1
     WHERE id = $7 AND user_id = $8`,
    [kegiatan, tanggal, minggu, hari_ke, JSON.stringify(category_ids), updated_at, id, userId]
  );

  return { ...existing, kegiatan, tanggal, minggu, hari_ke, category_ids, updated_at, dirty: true };
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
    `INSERT INTO logbook_entries (id, user_id, kegiatan, tanggal, minggu, hari_ke, category_ids, created_at, updated_at, deleted, dirty)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, 0)
     ON CONFLICT (id) DO UPDATE SET
       kegiatan = excluded.kegiatan,
       tanggal = excluded.tanggal,
       minggu = excluded.minggu,
       hari_ke = excluded.hari_ke,
       category_ids = excluded.category_ids,
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
      JSON.stringify(entry.category_ids ?? []),
      entry.created_at,
      entry.updated_at,
    ]
  );
}

// ---------- Categories ----------

export async function listCategories(userId: string): Promise<Category[]> {
  const d = await ensureDb();
  const rows = await d.select<CategoryRow[]>(
    `SELECT * FROM categories WHERE user_id = $1 AND deleted = 0
     ORDER BY created_at ASC`,
    [userId]
  );
  return rows.map(mapCategory);
}

export async function addCategory(userId: string, name: string, color: string): Promise<Category> {
  const d = await ensureDb();
  const cat: Category = {
    id: crypto.randomUUID(),
    user_id: userId,
    name: name.trim(),
    color,
    created_at: nowIso(),
    updated_at: nowIso(),
    deleted: false,
    dirty: true,
  };
  await d.execute(
    `INSERT INTO categories (id, user_id, name, color, created_at, updated_at, deleted, dirty)
     VALUES ($1, $2, $3, $4, $5, $6, 0, 1)`,
    [cat.id, cat.user_id, cat.name, cat.color, cat.created_at, cat.updated_at]
  );
  return cat;
}

export async function deleteCategory(id: string, userId: string): Promise<void> {
  const d = await ensureDb();
  const now = nowIso();
  await d.execute(
    "UPDATE categories SET deleted = 1, dirty = 1, updated_at = $1 WHERE id = $2 AND user_id = $3",
    [now, id, userId]
  );
  // detach from all local entries (they become dirty and sync the change)
  const rows = await d.select<Row[]>(
    "SELECT * FROM logbook_entries WHERE user_id = $1 AND deleted = 0",
    [userId]
  );
  for (const r of rows) {
    const ids = parseIds(r.category_ids);
    if (ids.includes(id)) {
      const next = ids.filter((x) => x !== id);
      await d.execute(
        "UPDATE logbook_entries SET category_ids = $1, dirty = 1, updated_at = $2 WHERE id = $3 AND user_id = $4",
        [JSON.stringify(next), now, r.id, userId]
      );
    }
  }
}

export async function getDirtyCategories(userId: string): Promise<Category[]> {
  const d = await ensureDb();
  const rows = await d.select<CategoryRow[]>(
    `SELECT * FROM categories WHERE user_id = $1 AND dirty = 1`,
    [userId]
  );
  return rows.map(mapCategory);
}

export async function markCategoryClean(id: string): Promise<void> {
  const d = await ensureDb();
  await d.execute("UPDATE categories SET dirty = 0 WHERE id = $1", [id]);
}

export async function upsertCategoryLocal(cat: Category): Promise<void> {
  const d = await ensureDb();
  if (cat.deleted) {
    await d.execute("DELETE FROM categories WHERE id = $1 AND user_id = $2", [cat.id, cat.user_id]);
    return;
  }
  await d.execute(
    `INSERT INTO categories (id, user_id, name, color, created_at, updated_at, deleted, dirty)
     VALUES ($1, $2, $3, $4, $5, $6, 0, 0)
     ON CONFLICT (id) DO UPDATE SET
       name = excluded.name,
       color = excluded.color,
       created_at = excluded.created_at,
       updated_at = excluded.updated_at,
       deleted = 0,
       dirty = 0`,
    [cat.id, cat.user_id, cat.name, cat.color, cat.created_at, cat.updated_at]
  );
}
