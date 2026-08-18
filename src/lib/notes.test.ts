import { describe, expect, it } from "vitest";
import { noteIdFor } from "./notes";

describe("noteIdFor", () => {
  it("prefixes the date deterministically", () => {
    expect(noteIdFor("2026-08-18")).toBe("note-2026-08-18");
  });

  it("is stable across calls (same id for the same date)", () => {
    expect(noteIdFor("2026-01-01")).toBe(noteIdFor("2026-01-01"));
  });

  it("distinguishes different dates", () => {
    expect(noteIdFor("2026-08-18")).not.toBe(noteIdFor("2026-08-19"));
  });
});
