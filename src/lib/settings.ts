import type { AppSettings } from "./types";
import { DEFAULT_THEME, isValidTheme } from "./themes";
import { isValidLang, type Lang } from "./i18n";

const KEY = "logbook.settings.v1";

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const DEFAULT_HOUR_START = "11:00";
export const DEFAULT_HOUR_LABEL = "hour";

export const DEFAULT_SETTINGS: AppSettings = {
  // Kredensial Supabase diisi sendiri oleh setiap pengguna (BYO-Supabase)
  // melalui layar Setup — tidak ada proyek bawaan.
  supabaseUrl: "",
  supabaseAnonKey: "",
  startDate: "",
  lastSyncAt: null,
  theme: DEFAULT_THEME,
  lang: "id",
  hourStart: DEFAULT_HOUR_START,
  hourLabel: DEFAULT_HOUR_LABEL,
  mode: "supabase",          // "supabase" | "local"
  localUserId: undefined,
  localPasswordHash: undefined,
};

export function normalizeUrl(url: string): string {
  const u = url.trim();
  if (!u) return "";
  return u.replace(/\/+$/, "");
}

export function normalizeSettings(stored: Partial<AppSettings>): AppSettings {
  const base = {
    ...DEFAULT_SETTINGS,
    ...stored,
    // kredensial disimpan apa adanya (boleh kosong) — setiap user punya proyek sendiri
    supabaseUrl: normalizeUrl(stored.supabaseUrl ?? ""),
    supabaseAnonKey: (stored.supabaseAnonKey ?? "").trim(),
    // unknown/stale theme ids fall back to the default
    theme: isValidTheme(stored.theme) ? stored.theme : DEFAULT_THEME,
    // unknown language falls back to Indonesian
    lang: isValidLang(stored.lang) ? stored.lang : DEFAULT_SETTINGS.lang,
    // invalid hour settings fall back to defaults
    hourStart: (() => {
      const hs = stored.hourStart;
      return hs !== undefined && HH_MM.test(hs) ? hs : DEFAULT_HOUR_START;
    })(),
    hourLabel:
      typeof stored.hourLabel === "string" && stored.hourLabel.trim()
        ? stored.hourLabel.trim()
        : DEFAULT_HOUR_LABEL,
    // mode lokal: default "supabase" untuk backward compat
    mode: stored.mode === "local" ? "local" : "supabase",
    localUserId: stored.localUserId ?? undefined,
    localPasswordHash: stored.localPasswordHash ?? undefined,
  };
  return base as AppSettings;
}

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return normalizeSettings(JSON.parse(raw) as Partial<AppSettings>);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: AppSettings): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

/**
 * Gabungkan pengaturan lokal dengan baris cloud (pengaturan yang disinkronkan).
 * Hanya field sync yang diambil dari remote; kredensial & lastSyncAt tetap lokal.
 * Nilai remote dinormalisasi (tema/lang/format jam yang tidak dikenal → fallback).
 */
export function applyRemoteSettings(
  local: AppSettings,
  remote: { startDate: string; hourStart: string; hourLabel: string; theme: string; lang: string }
): AppSettings {
  const normalized = normalizeSettings({
    ...local,
    startDate: remote.startDate,
    hourStart: remote.hourStart,
    hourLabel: remote.hourLabel,
    theme: remote.theme,
    lang: remote.lang as Lang,
  });
  // normalizeSettings menormalisasi startDate juga? tidak — startDate bebas string
  normalized.startDate = typeof remote.startDate === "string" ? remote.startDate.slice(0, 10) : local.startDate;
  return normalized;
}
