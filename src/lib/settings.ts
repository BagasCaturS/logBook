import type { AppSettings } from "./types";
import { DEFAULT_THEME, isValidTheme } from "./themes";

const KEY = "logbook.settings.v1";

export const DEFAULT_SETTINGS: AppSettings = {
  supabaseUrl: "https://uuvdyzfokdbnfevknawa.supabase.co",
  supabaseAnonKey: "sb_publishable_F7mvG100KvD3VspxQL9CBw_MPBYKd7X",
  startDate: "",
  lastSyncAt: null,
  theme: DEFAULT_THEME,
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
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: AppSettings): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}
