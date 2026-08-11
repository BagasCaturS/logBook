import { describe, it, expect } from "vitest";
import {
  computeMinggu,
  daysBetween,
  formatTanggal,
  formatDateTime,
  formatMonthYear,
  getMonthGrid,
} from "./dates";

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

describe("formatMonthYear", () => {
  it("format bulan penuh bahasa Indonesia", () => {
    expect(formatMonthYear("2026-08-11")).toBe("Agustus 2026");
  });

  it("bulan Januari dan Desember", () => {
    expect(formatMonthYear("2026-01-05")).toBe("Januari 2026");
    expect(formatMonthYear("2026-12-31")).toBe("Desember 2026");
  });

  it("format bahasa Inggris", () => {
    expect(formatMonthYear("2026-08-11", "en")).toBe("August 2026");
    expect(formatTanggal("2026-08-11", "en")).toBe("11 Aug 2026");
  });
});

describe("getMonthGrid", () => {
  it("selalu 42 sel (6 baris x 7 kolom)", () => {
    expect(getMonthGrid(2026, 7).length).toBe(42);
  });

  it("Agustus 2026 (Sabtu) dimulai Senin 27 Juli, ada 31 sel dalam bulan", () => {
    const grid = getMonthGrid(2026, 7);
    expect(grid[0]).toEqual({ date: "2026-07-27", inMonth: false });
    expect(grid[5]).toEqual({ date: "2026-08-01", inMonth: true });
    expect(grid[41]).toEqual({ date: "2026-09-06", inMonth: false });
    expect(grid.filter((c) => c.inMonth).length).toBe(31);
  });

  it("Januari 2026 (Kamis) dimulai Senin 29 Des 2025", () => {
    const grid = getMonthGrid(2026, 0);
    expect(grid[0]).toEqual({ date: "2025-12-29", inMonth: false });
    expect(grid[3]).toEqual({ date: "2026-01-01", inMonth: true });
    expect(grid.filter((c) => c.inMonth).length).toBe(31);
  });

  it("bulan yang dimulai hari Senin (Juni 2026) tanpa sel pendahulu", () => {
    const grid = getMonthGrid(2026, 5);
    expect(grid[0]).toEqual({ date: "2026-06-01", inMonth: true });
    expect(grid.filter((c) => c.inMonth).length).toBe(30);
  });

  it("lintas tahun: Des 2026 dimulai Senin 30 Nov 2026", () => {
    const grid = getMonthGrid(2026, 11);
    expect(grid[0]).toEqual({ date: "2026-11-30", inMonth: false });
    expect(grid[1]).toEqual({ date: "2026-12-01", inMonth: true });
  });
});
