const MS_PER_DAY = 86_400_000;

import type { Lang } from "./i18n";

const MONTHS_SHORT: Record<Lang, string[]> = {
  id: ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};

const MONTHS_FULL: Record<Lang, string[]> = {
  id: [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ],
  en: [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ],
};

export const WEEKDAYS_SHORT: Record<Lang, string[]> = {
  id: ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
};

export interface MingguInfo {
  minggu: number | null;
  hariKe: number | null;
}

export function toDateOnly(s: string): Date {
  return new Date(s.slice(0, 10) + "T00:00:00");
}

export function daysBetween(fromDate: string, toDate: string): number {
  return Math.round((toDateOnly(toDate).getTime() - toDateOnly(fromDate).getTime()) / MS_PER_DAY);
}

export function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function formatTanggal(s: string, lang: Lang = "id"): string {
  const [y, m, d] = s.slice(0, 10).split("-");
  const month = MONTHS_SHORT[lang][Number(m) - 1] ?? m;
  return `${Number(d)} ${month} ${y}`;
}

export function formatMonthYear(s: string, lang: Lang = "id"): string {
  const [y, m] = s.slice(0, 10).split("-");
  const month = MONTHS_FULL[lang][Number(m) - 1] ?? m;
  return `${month} ${y}`;
}

export interface MonthCell {
  date: string; // YYYY-MM-DD
  inMonth: boolean;
}

/**
 * Grid kalender 6 baris x 7 kolom yang dimulai hari Senin.
 * month adalah 0-based (0 = Januari).
 */
export function getMonthGrid(year: number, month: number): MonthCell[] {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // Senin = 0
  const start = new Date(year, month, 1 - offset);
  const cells: MonthCell[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
    cells.push({ date, inMonth: d.getMonth() === month });
  }
  return cells;
}

export function formatDateTime(s: string | null): string {
  if (!s) return "-";
  const d = new Date(s);
  if (isNaN(d.getTime())) return "-";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${formatTanggal(s)} ${hh}:${mm}`;
}

/**
 * Auto-compute minggu ke-? and hari ke-N from the internship start date.
 * minggu = floor((tanggal - startDate) / 7 days) + 1
 * Returns nulls when no start date is set or the date is before the start.
 */
export function computeMinggu(tanggal: string, startDate: string | null | undefined): MingguInfo {
  if (!startDate) return { minggu: null, hariKe: null };
  const diff = daysBetween(startDate, tanggal);
  if (diff < 0) return { minggu: null, hariKe: null };
  return { minggu: Math.floor(diff / 7) + 1, hariKe: diff + 1 };
}
