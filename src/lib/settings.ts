import type { AppSettings } from "./types";
import { DEFAULT_THEME, isValidTheme } from "./themes";
import { isValidLang } from "./i18n";

const KEY = "logbook.settings.v1";

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

export const DEFAULT_HOUR_START = "11:00";
export const DEFAULT_HOUR_LABEL = "hour";

export const DEFAULT_SETTINGS: AppSettings = {
  supabaseUrl: "https://uuvdyzfokdbnfevknawa.supabase.co",
  supabaseAnonKey: "sb_publishable_F7mvG100KvD3VspxQL9CBw_MPBYKd7X",
  startDate: "",
  lastSyncAt: null,
  theme: DEFAULT_THEME,
  lang: "id",
  hourStart: DEFAULT_HOUR_START,
  hourLabel: DEFAULT_HOUR_LABEL,
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const stored = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      // never allow empty creds to clobber the baked-in defaults
      supabaseUrl: stored.supabaseUrl || DEFAULT_SETTINGS.supabaseUrl,
      supabaseAnonKey: stored.supabaseAnonKey || DEFAULT_SETTINGS.supabaseAnonKey,
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
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: AppSettings): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}
