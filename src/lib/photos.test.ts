import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  cleanupOrphanPhotos,
  getLocalPhotoBase64,
  getPhotoUrl,
  isLocalPhoto,
  photoUrl,
} from "./photos";
import { PHOTO_CLEANUP_GRACE_MS } from "./syncLogic";

const localSettings = { mode: "local" as const, supabaseUrl: "" };
const cloudSettings = { mode: "supabase" as const, supabaseUrl: "https://abc.supabase.co" };

describe("local photo paths", () => {
  it("renders new Base64 paths as data URLs", () => {
    const path = "local:YWJj";
    expect(isLocalPhoto(path)).toBe(true);
    expect(getLocalPhotoBase64(path)).toBe("YWJj");
    expect(getPhotoUrl(localSettings, path)).toBe("data:image/jpeg;base64,YWJj");
  });

  it("supports the legacy uuid prefix", () => {
    const path = "local:123e4567-e89b-12d3-a456-426614174000:YWJj";
    expect(getLocalPhotoBase64(path)).toBe("YWJj");
    expect(getPhotoUrl(cloudSettings, path)).toBe("data:image/jpeg;base64,YWJj");
  });

  it("keeps cloud paths as storage URLs", () => {
    expect(getPhotoUrl(cloudSettings, "user/photo.jpg")).toBe(
      "https://abc.supabase.co/storage/v1/object/public/entry-files/user/photo.jpg"
    );
    expect(getPhotoUrl(localSettings, "user/photo.jpg")).toBe("");
    expect(photoUrl("https://abc.supabase.co/", "user/photo.jpg")).toContain("/entry-files/user/photo.jpg");
  });
});

describe("cleanupOrphanPhotos", () => {
  function storageClient(files: { name: string; created_at: string }[]) {
    const removed: string[][] = [];
    const client = {
      storage: {
        from: () => ({
          list: async () => ({ data: files, error: null }),
          remove: async (paths: string[]) => {
            removed.push(paths);
            return { error: null };
          },
        }),
      },
    } as unknown as SupabaseClient;
    return { client, removed };
  }

  const now = Date.now();
  const old = new Date(now - PHOTO_CLEANUP_GRACE_MS - 1000).toISOString();
  const fresh = new Date(now).toISOString();

  it("removes only old, unreferenced files", async () => {
    const { client, removed } = storageClient([
      { name: "old-orphan.jpg", created_at: old },
      { name: "fresh-orphan.jpg", created_at: fresh },
      { name: "kept.jpg", created_at: old },
    ]);

    await cleanupOrphanPhotos(client, "u", new Set(["u/kept.jpg"]));

    expect(removed).toEqual([["u/old-orphan.jpg"]]);
  });

  it("does not delete anything when every orphan is fresh", async () => {
    const { client, removed } = storageClient([
      { name: "fresh-orphan.jpg", created_at: fresh },
    ]);

    await cleanupOrphanPhotos(client, "u", new Set());

    expect(removed).toHaveLength(0);
  });
});
