import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { save, type DialogFilter } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import type { Category, LogbookEntry } from "./types";
import type { Lang } from "./i18n";
import { t } from "./i18n";
import { formatTanggal } from "./dates";

export interface ExportRange {
  kind: "all" | "week";
  minggu?: number;
}

export function buildPdf(
  entries: LogbookEntry[],
  categories: Category[],
  lang: Lang,
  range: ExportRange
): Uint8Array {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const catName = new Map(categories.map((c) => [c.id, c.name]));

  const rangeLabel =
    range.kind === "week"
      ? t(lang, "pdf.rangeWeek", { minggu: range.minggu ?? "-" })
      : t(lang, "pdf.rangeAll");

  doc.setFontSize(16);
  doc.text(t(lang, "pdf.title"), 14, 16);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(rangeLabel, 14, 23);
  doc.text(
    `${t(lang, "pdf.exportedAt")}: ${formatTanggal(new Date().toISOString().slice(0, 10), lang)} · ${t(
      lang,
      "pdf.count",
      { n: entries.length }
    )}`,
    14,
    28
  );
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 33,
    head: [[t(lang, "pdf.colTanggal"), t(lang, "pdf.colMinggu"), t(lang, "pdf.colHari"), t(lang, "pdf.colKegiatan"), t(lang, "pdf.colKategori")]],
    body: entries.map((e) => [
      formatTanggal(e.tanggal, lang),
      String(e.minggu),
      e.hari_ke !== null ? String(e.hari_ke) : "-",
      e.kegiatan,
      (e.category_ids ?? [])
        .map((id) => catName.get(id))
        .filter((n): n is string => !!n)
        .join(", "),
    ]),
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 245, 250] },
    columnStyles: {
      0: { cellWidth: 28 },
      1: { cellWidth: 18 },
      2: { cellWidth: 18 },
      3: { cellWidth: "auto" },
      4: { cellWidth: 40 },
    },
  });

  const buffer = doc.output("arraybuffer");
  return new Uint8Array(buffer);
}

const pdfFilter: DialogFilter = { name: "PDF", extensions: ["pdf"] };

export async function savePdf(
  data: Uint8Array,
  suggestedName: string
): Promise<string | null> {
  const path = await save({ defaultPath: suggestedName, filters: [pdfFilter] });
  if (!path) return null;
  await writeFile(path, data);
  return path;
}
