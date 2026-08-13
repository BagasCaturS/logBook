// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";
import { drawRichLines, layoutForCell, layoutRich } from "./pdfRich";

function makeDoc() {
  return new jsPDF({ unit: "mm", format: "a4" });
}

describe("layoutRich", () => {
  it("satu paragraf pendek menjadi satu baris", () => {
    const doc = makeDoc();
    const lines = layoutRich(doc, "<p>Halo</p>", 74, 9);
    expect(lines.length).toBe(1);
    expect(lines[0].segments.map((s) => s.text).join("")).toBe("Halo");
  });

  it("wrap pada maxWidth sempit", () => {
    const doc = makeDoc();
    const lines = layoutRich(
      doc,
      "<p>Belajar Laravel dan React hari ini</p>",
      30,
      9
    );
    expect(lines.length).toBeGreaterThan(1);
    const plain = lines.map((l) => l.segments.map((s) => s.text).join("")).join("");
    expect(plain.replace(/ /g, "")).toBe("BelajarLaraveldanReacthariini");
    expect(plain.includes("Belajar Laravel")).toBe(true);
  });

  it("memisahkan paragraf dengan baris kosong", () => {
    const doc = makeDoc();
    const lines = layoutRich(doc, "<p>Satu</p><p>Dua</p>", 74, 9);
    expect(lines.length).toBe(3); // 2 baris teks + 1 pemisah
    expect(lines[1].segments.length).toBe(0);
  });

  it("mendukung bold, italic, link", () => {
    const doc = makeDoc();
    const lines = layoutRich(
      doc,
      '<p><strong>Bold</strong> dan <a href="https://x.com">link</a></p>',
      74,
      9
    );
    const segs = lines[0].segments;
    expect(segs.find((s) => s.text === "Bold")?.bold).toBe(true);
    expect(segs.find((s) => s.text === "link")?.link).toBe("https://x.com");
  });

  it("menolak link berbahaya saat layout", () => {
    const doc = makeDoc();
    const lines = layoutRich(doc, '<p><a href="javascript:alert(1)">x</a></p>', 74, 9);
    expect(lines[0].segments.find((s) => s.text === "x")?.link).toBeUndefined();
  });
});

describe("drawRichLines", () => {
  it("tidak melempar untuk konten campuran", () => {
    const doc = makeDoc();
    const lines = layoutRich(
      doc,
      '<p><strong>Bold</strong> <em>italic</em> <u>garis</u> <s>coret</s> <a href="https://x.com">link</a></p><p>Baris kedua</p>',
      74,
      9
    );
    expect(() => drawRichLines(doc, lines, 14, 40, 9)).not.toThrow();
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it("gambar baris kosong (pemisah) tanpa kesalahan", () => {
    const doc = makeDoc();
    drawRichLines(doc, [{ segments: [] }], 14, 40, 9);
    expect(doc.getNumberOfPages()).toBe(1);
  });
});

describe("layoutForCell", () => {
  const L0 = { segments: [{ text: "a", bold: false, italic: false, underline: false, strike: false }] };
  const L1 = { segments: [{ text: "b", bold: false, italic: false, underline: false, strike: false }] };
  const L2 = { segments: [{ text: "c", bold: false, italic: false, underline: false, strike: false }] };
  const layout = [L0, L1, L2];

  it("sel utuh mengambil semua baris", () => {
    expect(layoutForCell(layout, ["a", "b", "c"])).toEqual(layout);
  });

  it("sel asli hasil terbelah mengambil awalan", () => {
    expect(layoutForCell(layout, ["a", "b"])).toEqual([L0, L1]);
  });

  it("sel sisa hasil terbelah mengambil akhiran", () => {
    expect(layoutForCell(layout, ["c"])).toEqual([L2]);
  });

  it("teks kosong mengembalikan baris kosong", () => {
    expect(layoutForCell(layout, [])).toEqual([]);
  });
});