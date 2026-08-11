import { describe, it, expect } from "vitest";
import { computeMinggu, daysBetween, formatTanggal, formatDateTime } from "./dates";

describe("computeMinggu", () => {
  it("hari pertama magang = Minggu 1, Hari ke-1", () => {
    expect(computeMinggu("2026-06-01", "2026-06-01")).toEqual({ minggu: 1, hariKe: 1 });
  });

  it("17 Juli 2026 dari mulai 1 Juni = Minggu 7, Hari ke-47", () => {
    expect(computeMinggu("2026-07-17", "2026-06-01")).toEqual({ minggu: 7, hariKe: 47 });
  });

  it("hari ke-7 (akhir minggu 1) tetap Minggu 1, bukan 2", () => {
    expect(computeMinggu("2026-06-07", "2026-06-01")).toEqual({ minggu: 1, hariKe: 7 });
  });

  it("hari ke-8 = awal Minggu 2", () => {
    expect(computeMinggu("2026-06-08", "2026-06-01")).toEqual({ minggu: 2, hariKe: 8 });
  });

  it("tanggal sebelum mulai magang = null (harus isi manual)", () => {
    expect(computeMinggu("2026-05-30", "2026-06-01")).toEqual({ minggu: null, hariKe: null });
  });

  it("tanpa tanggal mulai = null", () => {
    expect(computeMinggu("2026-06-10", "")).toEqual({ minggu: null, hariKe: null });
  });

  it("tanpa tanggal mulai (undefined) = null", () => {
    expect(computeMinggu("2026-06-10", undefined)).toEqual({ minggu: null, hariKe: null });
  });

  it("lintas tahun (Des → Jan) tidak salah hitung", () => {
    expect(computeMinggu("2027-01-05", "2026-12-01")).toEqual({ minggu: 6, hariKe: 36 });
  });

  it("magang pendek: hari ke-11 = Minggu 2", () => {
    expect(computeMinggu("2026-06-11", "2026-06-01")).toEqual({ minggu: 2, hariKe: 11 });
  });

  it("bulan Februari (28 hari) tidak menggeser minggu", () => {
    // 1 Feb → 28 Feb = 27 hari → floor(27/7)+1 = 4
    expect(computeMinggu("2026-02-28", "2026-02-01")).toEqual({ minggu: 4, hariKe: 28 });
  });
});

describe("daysBetween", () => {
  it("30 hari antara 1 Juni dan 1 Juli", () => {
    expect(daysBetween("2026-06-01", "2026-07-01")).toBe(30);
  });

  it("0 hari antara tanggal yang sama", () => {
    expect(daysBetween("2026-06-01", "2026-06-01")).toBe(0);
  });

  it("negatif jika tanggal tujuan lebih awal", () => {
    expect(daysBetween("2026-06-01", "2026-05-30")).toBe(-2);
  });
});

describe("formatTanggal", () => {
  it("format Indonesia", () => {
    expect(formatTanggal("2026-07-17")).toBe("17 Jul 2026");
  });

  it("bulan dengan 3 huruf", () => {
    expect(formatTanggal("2026-01-05")).toBe("5 Jan 2026");
    expect(formatTanggal("2026-12-31")).toBe("31 Des 2026");
  });
});

describe("formatDateTime", () => {
  it("null ditampilkan sebagai dash", () => {
    expect(formatDateTime(null)).toBe("-");
  });

  it("string tanggal tidak valid ditampilkan sebagai dash", () => {
    expect(formatDateTime("bukan-tanggal")).toBe("-");
  });
});
