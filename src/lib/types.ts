export interface LogbookEntry {
  id: string;
  user_id: string;
  kegiatan: string;
  tanggal: string; // YYYY-MM-DD (local date)
  minggu: number;
  hari_ke: number | null;
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
}

export interface AppSettings {
  supabaseUrl: string;
  supabaseAnonKey: string;
  startDate: string; // YYYY-MM-DD or '' when not set
  lastSyncAt: string | null;
  theme: string;
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
  created_at: string;
  updated_at: string;
  deleted: boolean;
}
