import { open, save, type DialogFilter } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import type { BackupData } from "./db";
import type { Category, DailyNote, LogbookEntry } from "./types";

const jsonFilter: DialogFilter = { name: "JSON", extensions: ["json"] };

export function buildBackupJson(
  entries: LogbookEntry[],
  categories: Category[],
  notes: DailyNote[],
  appVersion: string
): string {
  const data: BackupData = {
    appVersion,
    exportedAt: new Date().toISOString(),
    entries,
    categories,
    notes,
  };
  return JSON.stringify(data, null, 2);
}

export async function saveBackupFile(json: string, suggestedName: string): Promise<string | null> {
  const path = await save({ defaultPath: suggestedName, filters: [jsonFilter] });
  if (!path) return null;
  await writeTextFile(path, json);
  return path;
}

export interface PickResult {
  cancelled: boolean;
  data: BackupData | null;
}

export async function pickBackupFile(): Promise<PickResult> {
  const result = await open({
    multiple: false,
    directory: false,
    filters: [jsonFilter],
  });
  // Beberapa versi plugin-dialog mengembalikan array meski multiple:false.
  const path = Array.isArray(result) ? (result[0] ?? null) : result;
  if (typeof path !== "string" || !path) return { cancelled: true, data: null };
  try {
    const raw = await readTextFile(path);
    const parsed: unknown = JSON.parse(raw);
    const data = validateBackup(parsed);
    return { cancelled: false, data };
  } catch (err) {
    // JSON rusak / file tak terbaca / struktur salah — laporkan sebagai data null
    console.error("pickBackupFile failed:", err);
    return { cancelled: false, data: null };
  }
}

function validateBackup(v: unknown): BackupData | null {
  if (typeof v !== "object" || v === null) return null;
  const obj = v as Record<string, unknown>;
  if (!Array.isArray(obj.entries)) return null;
  if (!Array.isArray(obj.categories)) return null;
  return {
    appVersion: typeof obj.appVersion === "string" ? obj.appVersion : undefined,
    exportedAt: typeof obj.exportedAt === "string" ? obj.exportedAt : undefined,
    entries: obj.entries.filter(isEntry),
    categories: obj.categories.filter(isCategory),
    notes: Array.isArray(obj.notes) ? obj.notes.filter(isNote) : undefined,
  };
}

function isEntry(v: unknown): v is LogbookEntry {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.id === "string" &&
    typeof e.kegiatan === "string" &&
    typeof e.tanggal === "string"
  );
}

function isNote(v: unknown): v is DailyNote {
  if (typeof v !== "object" || v === null) return false;
  const n = v as Record<string, unknown>;
  return typeof n.id === "string" && typeof n.tanggal === "string" && typeof n.isi === "string";
}

function isCategory(v: unknown): v is Category {
  if (typeof v !== "object" || v === null) return false;
  const c = v as Record<string, unknown>;
  return typeof c.id === "string" && typeof c.name === "string";
}
