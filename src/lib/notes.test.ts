import { describe, expect, it } from "vitest";
import { noteIdFor } from "./notes";

describe("noteIdFor", () => {
  it("scopes the deterministic id to the user", () => {
    expect(noteIdFor("user-a", "2026-08-18")).toBe("note-user-a-2026-08-18");
  });

  it("is stable across calls", () => {
    expect(noteIdFor("user-a", "2026-01-01")).toBe(noteIdFor("user-a", "2026-01-01"));
  });

  it("distinguishes users and dates", () => {
    expect(noteIdFor("user-a", "2026-08-18")).not.toBe(noteIdFor("user-b", "2026-08-18"));
    expect(noteIdFor("user-a", "2026-08-18")).not.toBe(noteIdFor("user-a", "2026-08-19"));
  });
});
