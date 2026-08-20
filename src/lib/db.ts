import Database from "@tauri-apps/plugin-sql";
import type { Category, DailyNote, EntryInput, LogbookEntry } from "./types";
import { nowIso } from "./dates";
import { noteIdFor } from "./notes";

interface Row {
  id: string;
  user_id: string;
  kegiatan: string;
  tanggal: string;
  minggu: number;
  hari_ke: number | null;
  jam: number | null;
  category_ids: string;
  photo_paths: string;
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

interface NoteRow {
  id: string;
  user_id: string;
  tanggal: string;
  isi: string;
  created_at: string;
  updated_at: string;
  deleted: number;
  dirty: number;
}

interface SettingsRow {
  user_id: string;
  start_date: string;
  hour_start: string;
  hour_label: string;
  theme: string;
  lang: string;
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
  // migration: photo_paths column (added in 0.6.0)
  if (!cols.some((c) => c.name === "photo_paths")) {
    await db.execute(
      "ALTER TABLE logbook_entries ADD COLUMN photo_paths TEXT NOT NULL DEFAULT '[]'"
    );
  }
  // migration: jam column (added in 0.7.0)
  if (!cols.some((c) => c.name === "jam")) {
    await db.execute("ALTER TABLE logbook_entries ADD COLUMN jam INTEGER");
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
  await db.execute(`
    CREATE TABLE IF NOT EXISTS daily_notes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      tanggal TEXT NOT NULL,
      isi TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0,
      dirty INTEGER NOT NULL DEFAULT 0
    )
  `);
  await db.execute("CREATE INDEX IF NOT EXISTS idx_daily_notes_user_tanggal ON daily_notes (user_id, tanggal DESC)");
  await db.execute(`
    CREATE TABLE IF NOT EXISTS app_settings (
      user_id TEXT PRIMARY KEY,
      start_date TEXT NOT NULL DEFAULT '',
      hour_start TEXT NOT NULL DEFAULT '11:00',
      hour_label TEXT NOT NULL DEFAULT 'hour',
      theme TEXT NOT NULL DEFAULT 'jurnal',
      lang TEXT NOT NULL DEFAULT 'id',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0,
      dirty INTEGER NOT NULL DEFAULT 0
    )
  `);
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
    jam: r.jam ?? null,
    category_ids: parseIds(r.category_ids),
    photo_paths: parseIds(r.photo_paths),
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
    jam: input.jam ?? null,
    category_ids: input.category_ids ?? [],
    photo_paths: input.photo_paths ?? [],
    created_at: nowIso(),
    updated_at: nowIso(),
    deleted: false,
    dirty: true,
  };
  await d.execute(
    `INSERT INTO logbook_entries (id, user_id, kegiatan, tanggal, minggu, hari_ke, jam, category_ids, photo_paths, created_at, updated_at, deleted, dirty)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, 1)`,
    [
      entry.id,
      entry.user_id,
      entry.kegiatan,
      entry.tanggal,
      entry.minggu,
      entry.hari_ke,
      entry.jam,
      JSON.stringify(entry.category_ids),
      JSON.stringify(entry.photo_paths),
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
  const jam = patch.jam !== undefined ? patch.jam : existing.jam;
  const category_ids = patch.category_ids ?? existing.category_ids;
  const photo_paths = patch.photo_paths ?? existing.photo_paths;
  const updated_at = nowIso();

  await d.execute(
    `UPDATE logbook_entries
     SET kegiatan = $1, tanggal = $2, minggu = $3, hari_ke = $4, jam = $5, category_ids = $6, photo_paths = $7, updated_at = $8, dirty = 1
     WHERE id = $9 AND user_id = $10`,
    [kegiatan, tanggal, minggu, hari_ke, jam, JSON.stringify(category_ids), JSON.stringify(photo_paths), updated_at, id, userId]
  );

  return { ...existing, kegiatan, tanggal, minggu, hari_ke, jam, category_ids, photo_paths, updated_at, dirty: true };
}

export async function deleteEntry(id: string, userId: string): Promise<void> {
  const d = await ensureDb();
  await d.execute(
    `UPDATE logbook_entries SET deleted = 1, dirty = 1, updated_at = $1 WHERE id = $2 AND user_id = $3`,
    [nowIso(), id, userId]
  );
}

/** Batalkan soft delete (untuk undo hapus). Updated_at baru => menang di LWW. */
export async function restoreEntry(id: string, userId: string): Promise<void> {
  const d = await ensureDb();
  await d.execute(
    `UPDATE logbook_entries SET deleted = 0, dirty = 1, updated_at = $1 WHERE id = $2 AND user_id = $3`,
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
    `INSERT INTO logbook_entries (id, user_id, kegiatan, tanggal, minggu, hari_ke, jam, category_ids, photo_paths, created_at, updated_at, deleted, dirty)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, 0)
     ON CONFLICT (id) DO UPDATE SET
       kegiatan = excluded.kegiatan,
       tanggal = excluded.tanggal,
       minggu = excluded.minggu,
       hari_ke = excluded.hari_ke,
       jam = excluded.jam,
       category_ids = excluded.category_ids,
       photo_paths = excluded.photo_paths,
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
      entry.jam,
      JSON.stringify(entry.category_ids ?? []),
      JSON.stringify(entry.photo_paths ?? []),
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

export async function getCategory(id: string, userId: string): Promise<Category | null> {
  const d = await ensureDb();
  const rows = await d.select<CategoryRow[]>(
    "SELECT * FROM categories WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
  return rows.length ? mapCategory(rows[0]) : null;
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

// ---------- Daily notes ----------

function mapNote(r: NoteRow): DailyNote {
  return {
    id: r.id,
    user_id: r.user_id,
    tanggal: r.tanggal.slice(0, 10),
    isi: r.isi,
    created_at: r.created_at,
    updated_at: r.updated_at,
    deleted: r.deleted === 1,
    dirty: r.dirty === 1,
  };
}

export async function listDailyNotes(userId: string): Promise<DailyNote[]> {
  const d = await ensureDb();
  const rows = await d.select<NoteRow[]>(
    `SELECT * FROM daily_notes WHERE user_id = $1 AND deleted = 0
     ORDER BY tanggal DESC`,
    [userId]
  );
  return rows.map(mapNote);
}

export async function getDailyNote(id: string, userId: string): Promise<DailyNote | null> {
  const d = await ensureDb();
  const rows = await d.select<NoteRow[]>(
    "SELECT * FROM daily_notes WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
  return rows.length ? mapNote(rows[0]) : null;
}

/** Simpan catatan harian; isi kosong = hapus (soft delete agar tersinkron). */
export async function saveDailyNote(
  userId: string,
  tanggal: string,
  isi: string
): Promise<DailyNote | null> {
  const d = await ensureDb();
  const id = noteIdFor(tanggal);
  const text = isi.trim();
  const existing = await getDailyNote(id, userId);
  const now = nowIso();

  if (text === "") {
    if (existing) {
      await d.execute(
        "UPDATE daily_notes SET deleted = 1, dirty = 1, updated_at = $1 WHERE id = $2 AND user_id = $3",
        [now, id, userId]
      );
    }
    return null;
  }

  if (existing) {
    await d.execute(
      "UPDATE daily_notes SET isi = $1, updated_at = $2, dirty = 1, deleted = 0 WHERE id = $3 AND user_id = $4",
      [text, now, id, userId]
    );
    return { ...existing, isi: text, updated_at: now, dirty: true, deleted: false };
  }

  const note: DailyNote = {
    id,
    user_id: userId,
    tanggal,
    isi: text,
    created_at: now,
    updated_at: now,
    deleted: false,
    dirty: true,
  };
  await d.execute(
    `INSERT INTO daily_notes (id, user_id, tanggal, isi, created_at, updated_at, deleted, dirty)
     VALUES ($1, $2, $3, $4, $5, $6, 0, 1)`,
    [note.id, note.user_id, note.tanggal, note.isi, note.created_at, note.updated_at]
  );
  return note;
}

export async function getDirtyNotes(userId: string): Promise<DailyNote[]> {
  const d = await ensureDb();
  const rows = await d.select<NoteRow[]>(
    "SELECT * FROM daily_notes WHERE user_id = $1 AND dirty = 1",
    [userId]
  );
  return rows.map(mapNote);
}

export async function markNoteClean(id: string): Promise<void> {
  const d = await ensureDb();
  await d.execute("UPDATE daily_notes SET dirty = 0 WHERE id = $1", [id]);
}

export async function upsertNoteLocal(note: DailyNote): Promise<void> {
  const d = await ensureDb();
  if (note.deleted) {
    await d.execute("DELETE FROM daily_notes WHERE id = $1 AND user_id = $2", [
      note.id,
      note.user_id,
    ]);
    return;
  }
  await d.execute(
    `INSERT INTO daily_notes (id, user_id, tanggal, isi, created_at, updated_at, deleted, dirty)
     VALUES ($1, $2, $3, $4, $5, $6, 0, 0)
     ON CONFLICT (id) DO UPDATE SET
       isi = excluded.isi,
       created_at = excluded.created_at,
       updated_at = excluded.updated_at,
       deleted = 0,
       dirty = 0`,
    [note.id, note.user_id, note.tanggal, note.isi, note.created_at, note.updated_at]
  );
}

// ---------- App settings (staging sync) ----------

function mapSettingsRow(r: SettingsRow) {
  return {
    userId: r.user_id,
    startDate: r.start_date,
    hourStart: r.hour_start,
    hourLabel: r.hour_label,
    theme: r.theme,
    lang: r.lang,
    created_at: r.created_at,
    updated_at: r.updated_at,
    deleted: r.deleted === 1,
    dirty: r.dirty === 1,
  };
}

export interface SettingsSyncRow {
  userId: string;
  startDate: string;
  hourStart: string;
  hourLabel: string;
  theme: string;
  lang: string;
  created_at: string;
  updated_at: string;
  deleted: boolean;
  dirty: boolean;
}

export async function getSettingsRow(userId: string): Promise<SettingsSyncRow | null> {
  const d = await ensureDb();
  const rows = await d.select<SettingsRow[]>(
    "SELECT * FROM app_settings WHERE user_id = $1",
    [userId]
  );
  return rows.length ? mapSettingsRow(rows[0]) : null;
}

/** Tandai pengaturan berubah (dirty=1) agar ter-push pada sync berikutnya. */
export async function markSettingsChanged(
  userId: string,
  fields: { startDate: string; hourStart: string; hourLabel: string; theme: string; lang: string }
): Promise<void> {
  const d = await ensureDb();
  const now = nowIso();
  const existing = await getSettingsRow(userId);
  if (existing) {
    await d.execute(
      `UPDATE app_settings
       SET start_date = $1, hour_start = $2, hour_label = $3, theme = $4, lang = $5,
           updated_at = $6, dirty = 1, deleted = 0
       WHERE user_id = $7`,
      [fields.startDate, fields.hourStart, fields.hourLabel, fields.theme, fields.lang, now, userId]
    );
    return;
  }
  await d.execute(
    `INSERT INTO app_settings (user_id, start_date, hour_start, hour_label, theme, lang, created_at, updated_at, deleted, dirty)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $7, 0, 1)`,
    [userId, fields.startDate, fields.hourStart, fields.hourLabel, fields.theme, fields.lang, now]
  );
}

export async function getDirtySettingsRows(userId: string): Promise<SettingsSyncRow[]> {
  const d = await ensureDb();
  const rows = await d.select<SettingsRow[]>(
    "SELECT * FROM app_settings WHERE user_id = $1 AND dirty = 1",
    [userId]
  );
  return rows.map(mapSettingsRow);
}

export async function markSettingsClean(userId: string): Promise<void> {
  const d = await ensureDb();
  await d.execute("UPDATE app_settings SET dirty = 0 WHERE user_id = $1", [userId]);
}

export async function upsertSettingsLocal(row: SettingsSyncRow): Promise<void> {
  const d = await ensureDb();
  if (row.deleted) {
    await d.execute("DELETE FROM app_settings WHERE user_id = $1", [row.userId]);
    return;
  }
  await d.execute(
    `INSERT INTO app_settings (user_id, start_date, hour_start, hour_label, theme, lang, created_at, updated_at, deleted, dirty)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, 0)
     ON CONFLICT (user_id) DO UPDATE SET
       start_date = excluded.start_date,
       hour_start = excluded.hour_start,
       hour_label = excluded.hour_label,
       theme = excluded.theme,
       lang = excluded.lang,
       created_at = excluded.created_at,
       updated_at = excluded.updated_at,
       deleted = 0,
       dirty = 0`,
    [row.userId, row.startDate, row.hourStart, row.hourLabel, row.theme, row.lang, row.created_at, row.updated_at]
  );
}

// ---------- Backup / restore ----------

export interface BackupData {
  appVersion?: string;
  exportedAt?: string;
  entries: LogbookEntry[];
  categories: Category[];
  notes?: DailyNote[];
}

/** Import data dari backup (merge by id). Semua di-mark dirty agar disinkronkan ulang. */
export async function importAll(data: BackupData, userId: string): Promise<void> {
  const d = await ensureDb();
  for (const e of data.entries ?? []) {
    if (!e || typeof e.id !== "string") continue;
    await d.execute(
      `INSERT INTO logbook_entries (id, user_id, kegiatan, tanggal, minggu, hari_ke, jam, category_ids, photo_paths, created_at, updated_at, deleted, dirty)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0, 1)
       ON CONFLICT (id) DO UPDATE SET
         kegiatan = excluded.kegiatan,
         tanggal = excluded.tanggal,
         minggu = excluded.minggu,
         hari_ke = excluded.hari_ke,
         jam = excluded.jam,
         category_ids = excluded.category_ids,
         photo_paths = excluded.photo_paths,
         created_at = excluded.created_at,
         updated_at = excluded.updated_at,
         deleted = 0,
         dirty = 1`,
      [
        e.id,
        userId,
        e.kegiatan ?? "",
        e.tanggal ?? "",
        e.minggu ?? 1,
        e.hari_ke ?? null,
        e.jam ?? null,
        JSON.stringify(e.category_ids ?? []),
        JSON.stringify(e.photo_paths ?? []),
        e.created_at ?? nowIso(),
        e.updated_at ?? nowIso(),
      ]
    );
  }
  for (const c of data.categories ?? []) {
    if (!c || typeof c.id !== "string") continue;
    await d.execute(
      `INSERT INTO categories (id, user_id, name, color, created_at, updated_at, deleted, dirty)
       VALUES ($1, $2, $3, $4, $5, $6, 0, 1)
       ON CONFLICT (id) DO UPDATE SET
         name = excluded.name,
         color = excluded.color,
         created_at = excluded.created_at,
         updated_at = excluded.updated_at,
         deleted = 0,
         dirty = 1`,
      [c.id, userId, c.name ?? "", c.color ?? "#6366f1", c.created_at ?? nowIso(), c.updated_at ?? nowIso()]
    );
  }
  for (const n of data.notes ?? []) {
    if (!n || typeof n.id !== "string") continue;
    await d.execute(
      `INSERT INTO daily_notes (id, user_id, tanggal, isi, created_at, updated_at, deleted, dirty)
       VALUES ($1, $2, $3, $4, $5, $6, 0, 1)
       ON CONFLICT (id) DO UPDATE SET
         isi = excluded.isi,
         created_at = excluded.created_at,
         updated_at = excluded.updated_at,
         deleted = 0,
         dirty = 1`,
      [n.id, userId, n.tanggal ?? "", n.isi ?? "", n.created_at ?? nowIso(), n.updated_at ?? nowIso()]
    );
  }
}
