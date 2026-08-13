import type { jsPDF } from "jspdf";
import { sanitizeHtml } from "./richtext";

export interface RichSegment {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  link?: string;
}

export interface RichLine {
  segments: RichSegment[];
}

interface Block {
  segments: RichSegment[];
}

interface StyleCtx {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strike: boolean;
  link?: string;
}

const NORMAL_CTX: StyleCtx = { bold: false, italic: false, underline: false, strike: false };

// Parse HTML (hasil sanitasi DOMPurify) menjadi blok-blok segmen ber-style.
function parseBlocks(html: string): Block[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const blocks: Block[] = [];
  let cur: Block | null = null;

  const close = () => {
    if (cur && cur.segments.some((s) => s.text.trim() !== "")) blocks.push(cur);
    cur = null;
  };

  function walk(nodes: NodeListOf<ChildNode>, ctx: StyleCtx) {
    nodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent ?? "";
        if (!text) return;
        if (!cur) cur = { segments: [] };
        cur.segments.push({ text, ...ctx });
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();
      switch (tag) {
        case "br":
          if (!cur) cur = { segments: [] };
          cur.segments.push({ text: "\n", ...NORMAL_CTX });
          return;
        case "p":
        case "div":
        case "blockquote":
        case "pre":
          close();
          walk(el.childNodes, ctx);
          close();
          return;
        case "ul":
        case "ol": {
          const isOl = tag === "ol";
          let idx = 0;
          for (const li of el.querySelectorAll(":scope > li")) {
            idx++;
            if (!cur) cur = { segments: [] };
            cur.segments.push({
              text: isOl ? `${idx}. ` : "\u2022 ",
              ...NORMAL_CTX,
            });
            walk(li.childNodes, ctx);
            close();
          }
          return;
        }
        case "li":
          close();
          walk(el.childNodes, ctx);
          close();
          return;
        case "h1":
        case "h2":
        case "h3":
        case "h4":
        case "h5":
        case "h6":
          close();
          walk(el.childNodes, { ...ctx, bold: true });
          close();
          return;
        case "strong":
        case "b":
          walk(el.childNodes, { ...ctx, bold: true });
          return;
        case "em":
        case "i":
          walk(el.childNodes, { ...ctx, italic: true });
          return;
        case "u":
          walk(el.childNodes, { ...ctx, underline: true });
          return;
        case "s":
        case "strike":
        case "del":
          walk(el.childNodes, { ...ctx, strike: true });
          return;
        case "a": {
          const href = el.getAttribute("href") ?? "";
          if (href && !/^(?:https?:\/\/|mailto:|tel:)/i.test(href)) return;
          walk(el.childNodes, { ...ctx, link: href || undefined });
          return;
        }
        default:
          walk(el.childNodes, ctx);
      }
    });
  }

  walk(doc.body.childNodes, NORMAL_CTX);
  close();
  return blocks;
}

export function styleOf(s: RichSegment): string {
  if (s.bold && s.italic) return "bolditalic";
  if (s.bold) return "bold";
  if (s.italic) return "italic";
  return "normal";
}

const FONT = "helvetica";

// Susun segmen menjadi baris-baris dengan wrap manual, memakai getTextWidth agar
// konsisten dengan pengukuran jsPDF. Lebar baris dihitung dengan ukuran font
// yang sama seperti yang dipakai autotable untuk sel terkait.
export function layoutRich(
  pdf: jsPDF,
  html: string,
  maxWidth: number,
  fontSize: number
): RichLine[] {
  const blocks = parseBlocks(sanitizeHtml(html));
  const lines: RichLine[] = [];
  let line: RichSegment[] = [];
  let lineWidth = 0;

  const pushLine = () => {
    if (line.length > 0) {
      lines.push({ segments: line });
      line = [];
      lineWidth = 0;
    }
  };

  const addToken = (seg: RichSegment, w: number) => {
    line.push({ ...seg });
    lineWidth += w;
  };

  const nonEmpty = blocks.filter((b) => b.segments.some((s) => s.text.trim() !== ""));

  nonEmpty.forEach((block, bi) => {
    if (bi > 0 && lines.length > 0) lines.push({ segments: [] });
    for (const seg of block.segments) {
      const parts = seg.text.split("\n");
      parts.forEach((part, pi) => {
        if (pi > 0) pushLine();
        if (!part) return;
        const tokens = part.split(/(\s+)/).filter((t) => t.length > 0);
        for (const token of tokens) {
          pdf.setFont(FONT, styleOf(seg));
          pdf.setFontSize(fontSize);
          const w = pdf.getTextWidth(token);
          const isSpace = token.trim() === "";
          if (!isSpace && line.length > 0 && lineWidth + w > maxWidth) {
            pushLine();
          }
          if (isSpace && line.length === 0) continue;
          if (w > maxWidth) {
            for (const ch of token) {
              pdf.setFont(FONT, styleOf(seg));
              pdf.setFontSize(fontSize);
              const cw = pdf.getTextWidth(ch);
              if (line.length > 0 && lineWidth + cw > maxWidth) pushLine();
              addToken({ ...seg, text: ch }, cw);
            }
          } else {
            addToken({ ...seg, text: token }, w);
          }
        }
      });
    }
    pushLine();
  });

  return lines;
}

// Gambar baris-baris rich text mulai dari (x, y) = pojok kiri-atas area konten sel.
// Matematika vertikal disamakan dengan autotable (autoTableText) agar posisi dan
// tinggi baris identik: fontSize dibagi internal.scaleFactor (pt → satuan dokumen).
export function drawRichLines(
  pdf: jsPDF,
  lines: RichLine[],
  x: number,
  y: number,
  fontSize: number
): void {
  const k = pdf.internal.scaleFactor;
  const fSize = fontSize / k;
  const lineHeightFactor =
    typeof pdf.getLineHeightFactor === "function" ? pdf.getLineHeightFactor() : 1.15;
  const lineHeight = fSize * lineHeightFactor;
  const firstBaselineOffset = fSize * 0.85;
  pdf.setFontSize(fontSize);
  const LINK_COLOR: [number, number, number] = [37, 99, 235];

  lines.forEach((l, i) => {
    if (l.segments.length === 0) return;
    let cx = x;
    const baseline = y + firstBaselineOffset + i * lineHeight;
    for (const seg of l.segments) {
      if (!seg.text) continue;
      pdf.setFont(FONT, styleOf(seg));
      if (seg.link) pdf.setTextColor(...LINK_COLOR);
      else pdf.setTextColor(0);
      const w = pdf.getTextWidth(seg.text);
      if (seg.link) {
        try {
          pdf.textWithLink(seg.text, cx, baseline, { url: seg.link });
        } catch {
          pdf.text(seg.text, cx, baseline);
        }
      } else {
        pdf.text(seg.text, cx, baseline);
      }
      if (seg.underline || seg.link) {
        pdf.setLineWidth(0.15);
        pdf.setDrawColor(seg.link ? LINK_COLOR[0] : 0, seg.link ? LINK_COLOR[1] : 0, seg.link ? LINK_COLOR[2] : 0);
        pdf.line(cx, baseline + 0.3, cx + w, baseline + 0.3);
      }
      if (seg.strike) {
        pdf.setLineWidth(0.15);
        pdf.setDrawColor(0);
        pdf.line(cx, baseline - fSize * 0.32, cx + w, baseline - fSize * 0.32);
      }
      cx += w;
    }
  });
}

// Pilih irisan baris yang dimiliki sel tertentu (menangani sel sisa saat baris
// terbelah antar halaman oleh autotable).
export function layoutForCell(layout: RichLine[], cellText: string[]): RichLine[] {
  if (cellText.length === 0) return [];
  const lineText = (l: RichLine) => l.segments.map((s) => s.text).join("");
  if (layout.length <= cellText.length) return layout;
  const first = lineText(layout[0]);
  if (cellText[0] !== first || !layout.every((l, i) => lineText(l) === cellText[i])) {
    const start = layout.findIndex((l) => lineText(l) === cellText[0]);
    if (
      start >= 0 &&
      start + cellText.length <= layout.length &&
      layout.slice(start, start + cellText.length).every((l, i) => lineText(l) === cellText[i])
    ) {
      return layout.slice(start, start + cellText.length);
    }
  }
  return layout.slice(0, cellText.length);
}