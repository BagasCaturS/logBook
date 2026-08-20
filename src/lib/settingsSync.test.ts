import { describe, expect, it } from "vitest";
import { applyRemoteSettings, DEFAULT_SETTINGS, normalizeSettings, normalizeUrl } from "./settings";
import type { AppSettings } from "./types";

const local: AppSettings = {
  ...DEFAULT_SETTINGS,
  supabaseUrl: "https://abc.supabase.co",
  supabaseAnonKey: "sb_publishable_test",
  startDate: "2026-01-01",
  hourStart: "08:00",
  hourLabel: "jam",
  theme: "ocean",
  lang: "id",
  lastSyncAt: "2026-08-18T10:00:00.000Z",
};

const remote = {
  startDate: "2026-02-01",
  hourStart: "09:30",
  hourLabel: "hour",
  theme: "mint",
  lang: "en",
};

describe("normalizeSettings credentials", () => {
  it("keeps stored credentials as-is", () => {
    const r = normalizeSettings({ supabaseUrl: "https://mine.supabase.co/", supabaseAnonKey: "  sb_key  " });
    expect(r.supabaseUrl).toBe("https://mine.supabase.co");
    expect(r.supabaseAnonKey).toBe("sb_key");
  });

  it("allows empty credentials (no baked-in fallback)", () => {
    const r = normalizeSettings({ supabaseUrl: "", supabaseAnonKey: "" });
    expect(r.supabaseUrl).toBe("");
    expect(r.supabaseAnonKey).toBe("");
  });

  it("normalizes URL by stripping trailing slashes", () => {
    expect(normalizeUrl("https://a.supabase.co///")).toBe("https://a.supabase.co");
    expect(normalizeUrl("  https://b.supabase.co  ")).toBe("https://b.supabase.co");
    expect(normalizeUrl("")).toBe("");
  });
});

describe("applyRemoteSettings", () => {
  it("takes all syncable fields from the remote row", () => {
    const r = applyRemoteSettings(local, remote);
    expect(r.startDate).toBe("2026-02-01");
    expect(r.hourStart).toBe("09:30");
    expect(r.hourLabel).toBe("hour");
    expect(r.theme).toBe("mint");
    expect(r.lang).toBe("en");
  });

  it("keeps credentials and lastSyncAt from local settings", () => {
    const r = applyRemoteSettings(local, remote);
    expect(r.supabaseUrl).toBe(local.supabaseUrl);
    expect(r.supabaseAnonKey).toBe(local.supabaseAnonKey);
    expect(r.lastSyncAt).toBe(local.lastSyncAt);
  });

  it("falls back to defaults for invalid remote values, keeping other fields", () => {
    const r = applyRemoteSettings(local, {
      ...remote,
      hourStart: "25:99",
      hourLabel: "   ",
      theme: "nonexistent",
      lang: "fr",
    });
    expect(r.hourStart).toBe(DEFAULT_SETTINGS.hourStart);
    expect(r.hourLabel).toBe(DEFAULT_SETTINGS.hourLabel);
    expect(r.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(r.lang).toBe("id");
    expect(r.startDate).toBe("2026-02-01");
  });

  it("normalizes the start date to YYYY-MM-DD", () => {
    const r = applyRemoteSettings(local, { ...remote, startDate: "2026-02-01T00:00:00.000Z" });
    expect(r.startDate).toBe("2026-02-01");
  });
});
