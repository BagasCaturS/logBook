import { describe, expect, it } from "vitest";
import { getLocalPhotoBase64, getPhotoUrl, isLocalPhoto, photoUrl } from "./photos";

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
