import { describe, expect, it } from "vitest";
import { localNewerThan, parseTs, PHOTO_DELETE_GRACE_MS, shouldDeletePhotos } from "./syncLogic";

describe("parseTs", () => {
  it("parses valid ISO timestamps", () => {
    expect(parseTs("2026-08-18T10:00:00.000Z")).toBe(Date.parse("2026-08-18T10:00:00.000Z"));
  });

  it("returns 0 for null/undefined/empty", () => {
    expect(parseTs(null)).toBe(0);
    expect(parseTs(undefined)).toBe(0);
    expect(parseTs("")).toBe(0);
  });

  it("returns 0 for invalid strings", () => {
    expect(parseTs("not-a-date")).toBe(0);
  });
});

describe("localNewerThan (LWW pull guard)", () => {
  it("same timestamp -> false (re-pull row written by an old client version)", () => {
    expect(localNewerThan("2026-08-18T10:00:00.000Z", "2026-08-18T10:00:00.000Z")).toBe(false);
  });

  it("local strictly newer -> true (skip, keep local edit)", () => {
    expect(localNewerThan("2026-08-18T12:00:00.000Z", "2026-08-18T10:00:00.000Z")).toBe(true);
  });

  it("local older -> false (apply remote)", () => {
    expect(localNewerThan("2026-08-18T10:00:00.000Z", "2026-08-18T12:00:00.000Z")).toBe(false);
  });

  it("invalid local timestamp -> false (never blocks remote)", () => {
    expect(localNewerThan("garbage", "2026-08-18T12:00:00.000Z")).toBe(false);
    expect(localNewerThan(null, "2026-08-18T12:00:00.000Z")).toBe(false);
  });

  it("invalid remote timestamp -> false unless local is a valid newer date", () => {
    expect(localNewerThan("2026-08-18T12:00:00.000Z", "garbage")).toBe(true);
  });
});

describe("shouldDeletePhotos (undo grace)", () => {
  const now = Date.parse("2026-08-18T10:00:00.000Z");

  it("keeps photos inside the undo window", () => {
    expect(shouldDeletePhotos("2026-08-18T09:59:55.000Z", now)).toBe(false);
  });

  it("deletes photos after the grace period", () => {
    const old = new Date(now - PHOTO_DELETE_GRACE_MS - 1).toISOString();
    expect(shouldDeletePhotos(old, now)).toBe(true);
  });

  it("keeps photos when the timestamp is invalid or in the future", () => {
    expect(shouldDeletePhotos("garbage", now)).toBe(false);
    expect(shouldDeletePhotos("2026-08-18T10:00:01.000Z", now)).toBe(false);
  });
});
