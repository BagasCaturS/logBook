import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { save, type DialogFilter } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import type { Category, LogbookEntry } from "./types";
import type { Lang } from "./i18n";
import { t } from "./i18n";
import { formatTanggal } from "./dates";
import { looksLikeHtml } from "./richtext";
import { drawRichLines, layoutForCell, layoutRich, type RichLine } from "./pdfRich";

export interface ExportRange {
  kind: "all" | "week";
  minggu?: number;
}

// Lebar tetap kolom "Kegiatan" (78mm): total 182mm tersedia dikurangi kolom tetap
// 28+18+18+40 = 104mm. Dengan lebar deterministik, layout rich text (didParseCell)
// dan tinggi baris (autotable) selalu konsisten.
const KEGIATAN_COL = 3;
const KEGIATAN_WIDTH = 78;
const CELL_PADDING_H = 4; // cellPadding default 2 → horizontal 4

interface RichCellMeta {
  lines: RichLine[];
  fontSize: number;
}

function getRichDoc(data: { doc: unknown }): jsPDF {
  const d = data.doc as { getDocument?: () => jsPDF; setFont?: unknown };
  return d && typeof d.getDocument === "function" ? d.getDocument() : (data.doc as jsPDF);
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
      3: { cellWidth: KEGIATAN_WIDTH },
      4: { cellWidth: 40 },
    },
    didParseCell: (data) => {
      const cell = data.cell as unknown as {
        text: string | string[];
        styles: { fontSize?: number };
        _rich?: RichCellMeta;
      };
      if (data.section !== "body" || data.column.index !== KEGIATAN_COL) return;
      const raw = String(Array.isArray(cell.text) ? cell.text[0] ?? "" : cell.text);
      if (!looksLikeHtml(raw)) return;
      const pdf = getRichDoc(data);
      const fontSize = cell.styles.fontSize ?? 9;
      const lines = layoutRich(pdf, raw, KEGIATAN_WIDTH - CELL_PADDING_H, fontSize);
      if (lines.length === 0) return;
      cell.text = lines.map((l) => l.segments.map((s) => s.text).join(""));
      cell._rich = { lines, fontSize };
    },
    didDrawCell: (data) => {
      const cell = data.cell as unknown as {
        x: number;
        y: number;
        width: number;
        height: number;
        text: string[];
        styles: { fillColor?: number[] | string | null };
        padding: (n: "left" | "right" | "top" | "bottom") => number;
        _rich?: RichCellMeta;
      };
      if (data.section !== "body" || data.column.index !== KEGIATAN_COL) return;
      if (!cell._rich) return;
      const pdf = getRichDoc(data);
      const lines = layoutForCell(cell._rich.lines, cell.text);
      if (lines.length === 0) return;
      const padL = cell.padding("left");
      const padT = cell.padding("top");
      const padR = cell.padding("right");
      const padB = cell.padding("bottom");
      // Tutup teks polos bawaan autotable, lalu gambar versi rich text.
      const fill = Array.isArray(cell.styles.fillColor)
        ? (cell.styles.fillColor as number[])
        : [255, 255, 255];
      pdf.setFillColor(fill[0], fill[1], fill[2]);
      pdf.rect(
        cell.x + padL,
        cell.y + padT,
        cell.width - padL - padR,
        cell.height - padT - padB,
        "F"
      );
      drawRichLines(pdf, lines, cell.x + padL, cell.y + padT, cell._rich.fontSize);
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
