import type { Lang } from "./i18n";

export interface LogbookEntry {
  id: string;
  user_id: string;
  kegiatan: string;
  tanggal: string; // YYYY-MM-DD (local date)
  minggu: number;
  hari_ke: number | null;
  jam: number | null;
  category_ids: string[];
  photo_paths: string[];
  created_at: string; // ISO UTC
  updated_at: string; // ISO UTC
  deleted: boolean;
  dirty: boolean;
}

export interface EntryInput {
  kegiatan: string;
  tanggal: string;
  minggu: number;
  hari_ke: number | null;
  jam: number | null;
  category_ids: string[];
  photo_paths: string[];
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
  deleted: boolean;
  dirty: boolean;
}

export interface DailyNote {
  id: string; // `note-<tanggal>` — deterministic agar LWW antar device aman
  user_id: string;
  tanggal: string; // YYYY-MM-DD (local date)
  isi: string; // plain text
  created_at: string; // ISO UTC
  updated_at: string; // ISO UTC
  deleted: boolean;
  dirty: boolean;
}

export interface RemoteDailyNote {
  id: string;
  user_id: string;
  tanggal: string;
  isi: string;
  created_at: string;
  updated_at: string;
  deleted: boolean;
}

/** Baris cloud tabel `app_settings` (satu baris per user). */
export interface RemoteAppSettings {
  user_id: string;
  start_date: string;
  hour_start: string;
  hour_label: string;
  theme: string;
  lang: string;
  created_at: string;
  updated_at: string;
  deleted: boolean;
}

export interface AppSettings {
  supabaseUrl: string;
  supabaseAnonKey: string;
  startDate: string; // YYYY-MM-DD or '' when not set
  lastSyncAt: string | null;
  theme: string;
  lang: Lang;
  hourStart: string; // HH:MM
  hourLabel: string;
  mode: "supabase" | "local";        // default "supabase"
  localUserId?: string;              // UUID dari Supabase (reuse saat switch)
  localPasswordHash?: string;        // hash password local (salt:hash hex)
}

export type SyncState = "online" | "offline" | "syncing" | "error";

export interface SyncStatus {
  state: SyncState;
  lastSyncAt: string | null;
  error?: string;
}

export interface RemoteEntry {
  id: string;
  user_id: string;
  kegiatan: string;
  tanggal: string;
  minggu: number;
  hari_ke: number | null;
  jam: number | null;
  category_ids?: string | string[] | null;
  photo_paths?: string | string[] | null;
  created_at: string;
  updated_at: string;
  deleted: boolean;
}

export interface RemoteCategory {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
  deleted: boolean;
}
