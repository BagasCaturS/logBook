// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  looksLikeHtml,
  plainTextFromHtml,
  renderEntryText,
  sanitizeHtml,
  wordBoundariesAt,
} from "./richtext";

describe("looksLikeHtml", () => {
  it("mengenali HTML dari editor", () => {
    expect(looksLikeHtml("<p>Belajar Laravel</p>")).toBe(true);
    expect(looksLikeHtml('<p>Lihat <a href="https://x.com">link</a></p>')).toBe(true);
    expect(looksLikeHtml("<ul><li>item</li></ul>")).toBe(true);
  });

  it("menolak teks polos dan string kosong", () => {
    expect(looksLikeHtml("Belajar Laravel, ikut standup")).toBe(false);
    expect(looksLikeHtml("")).toBe(false);
    expect(looksLikeHtml("a < b && c > d")).toBe(false);
  });
});

describe("plainTextFromHtml", () => {
  it("menghapus tag dan mempertahankan isi", () => {
    expect(plainTextFromHtml("<p>Hello <strong>world</strong></p>")).toBe("Hello world");
  });

  it("menjadikan blok sebagai baris baru", () => {
    expect(plainTextFromHtml("<p>Baris satu</p><p>Baris dua</p>")).toBe("Baris satu\nBaris dua");
    expect(plainTextFromHtml("A<br>B")).toBe("A\nB");
    expect(plainTextFromHtml("<ul><li>satu</li><li>dua</li></ul>")).toBe("satu\ndua");
  });

  it("mendekode entity HTML", () => {
    expect(plainTextFromHtml("<p>AT&amp;T &lt;tag&gt; &quot;quote&quot; &apos;apos&apos;</p>")).toBe(
      "AT&T <tag> \"quote\" 'apos'"
    );
    expect(plainTextFromHtml("<p>spasi&nbsp;nbsp</p>")).toBe("spasi nbsp");
  });

  it("menangani teks polos dan kosong", () => {
    expect(plainTextFromHtml("teks polos")).toBe("teks polos");
    expect(plainTextFromHtml("")).toBe("");
    expect(plainTextFromHtml("<p>   </p>")).toBe("");
  });

  it("merapikan baris kosong berlebih", () => {
    expect(plainTextFromHtml("<p>a</p><p></p><p></p><p>b</p>")).toBe("a\n\nb");
  });
});

describe("sanitizeHtml", () => {
  it("membuang script dan style", () => {
    expect(sanitizeHtml("<p>ok</p><script>alert(1)</script><style>x{}</style>")).toBe("<p>ok</p>");
  });

  it("mempertahankan tag dan href yang diizinkan", () => {
    const out = sanitizeHtml('<p><strong>tebal</strong> <a href="https://x.com">link</a></p>');
    expect(out).toContain("<strong>tebal</strong>");
    expect(out).toContain('href="https://x.com"');
  });

  it("membuang href berbahaya dan atribut lain", () => {
    const out = sanitizeHtml('<p><a href="javascript:alert(1)" onclick="x()" data-x="1">j</a></p>');
    expect(out).not.toContain("javascript:");
    expect(out).not.toContain("onclick");
    expect(out).not.toContain("data-x");
  });
});

describe("renderEntryText", () => {
  it("merender HTML ter-sanitasi", () => {
    expect(renderEntryText("<p>halo</p>")).toBe("<p>halo</p>");
    expect(renderEntryText("<p>halo</p><script>x()</script>")).toBe("<p>halo</p>");
  });

  it("membungkus teks polos lama dalam <p>", () => {
    expect(renderEntryText("Belajar Laravel")).toBe("<p>Belajar Laravel</p>");
    expect(renderEntryText("")).toBe("");
  });

  it("escape konten polos", () => {
    expect(renderEntryText("a < b & c")).toBe("<p>a &lt; b &amp; c</p>");
  });
});

describe("escapeHtml", () => {
  it("escape karakter khusus", () => {
    expect(escapeHtml(`<a href="x">&`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;");
  });
});

describe("wordBoundariesAt", () => {
  it("caret di dalam kata memberi batas kata utuh", () => {
    expect(wordBoundariesAt("klik link di sini", 6)).toEqual({ from: 5, to: 9 });
  });

  it("caret di awal dan akhir kata", () => {
    expect(wordBoundariesAt("klik link di sini", 5)).toEqual({ from: 5, to: 9 });
    expect(wordBoundariesAt("klik link di sini", 9)).toEqual({ from: 5, to: 9 });
  });

  it("satu kata di awal dan akhir dokumen", () => {
    expect(wordBoundariesAt("link", 0)).toEqual({ from: 0, to: 4 });
    expect(wordBoundariesAt("link", 4)).toEqual({ from: 0, to: 4 });
  });

  it("menggabungkan bagian kiri dan kanan caret", () => {
    expect(wordBoundariesAt("satu link dua", 7)).toEqual({ from: 5, to: 9 });
  });

  it("mengembalikan null bila caret tidak pada kata", () => {
    expect(wordBoundariesAt("a  b", 2)).toBeNull();
    expect(wordBoundariesAt("", 0)).toBeNull();
  });

  it("membuang tanda baca dari tepi kata", () => {
    expect(wordBoundariesAt("halo, dunia", 5)).toEqual({ from: 0, to: 4 });
    expect(wordBoundariesAt("(halo) dunia", 5)).toEqual({ from: 1, to: 5 });
    expect(wordBoundariesAt("kalimat ...", 7)).toEqual({ from: 0, to: 7 });
  });
});