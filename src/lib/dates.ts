const MS_PER_DAY = 86_400_000;

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

export function formatTanggal(s: string): string {
  const [y, m, d] = s.slice(0, 10).split("-");
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const month = months[Number(m) - 1] ?? m;
  return `${Number(d)} ${month} ${y}`;
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
