import DOMPurify from "dompurify";

// Tag yang bisa muncul dari editor TipTap (StarterKit + underline + link).
const HTML_TAG_RE = /<(p|div|br|strong|b|em|i|u|s|a|ul|ol|li|h[1-6]|blockquote|pre|code|del|strike)[\s/>]/i;

// Entri lama (sebelum fitur rich text) menyimpan teks polos; entri baru menyimpan HTML.
// Heuristik ini membedakan keduanya agar keduanya tampil benar.
export function looksLikeHtml(s: string): boolean {
  return HTML_TAG_RE.test(s);
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const ALLOWED_TAGS = [
  "p", "br", "strong", "b", "em", "i", "u", "s", "del", "strike",
  "a", "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5", "h6",
  "blockquote", "pre", "code",
];

// Konten bersumber dari perangkat lain melalui sinkronisasi — di-sanitasi keras.
export function sanitizeHtml(s: string): string {
  return DOMPurify.sanitize(s, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ["href"],
    ALLOW_DATA_ATTR: false,
    ALLOWED_URI_REGEXP: /^(?:https?:\/\/|mailto:|tel:)/i,
  });
}

// Teks yang aman dirender (React dangerouslySetInnerHTML).
export function renderEntryText(s: string): string {
  if (!s) return "";
  if (looksLikeHtml(s)) return sanitizeHtml(s);
  return `<p>${escapeHtml(s)}</p>`;
}

export interface TextRange {
  from: number;
  to: number;
}

const WORD_LEAD_PUNCT = /^[([{“"‘]+/;
const WORD_TRAIL_PUNCT = /[)\]}"'”….,;:!?]+$/;

// Batas kata (blok non-spasi) di sekitar posisi caret, dengan tanda baca di tepi
// kata dibuang. Mengembalikan null bila caret tidak berada pada kata apa pun.
export function wordBoundariesAt(text: string, offset: number): TextRange | null {
  if (offset < 0 || offset > text.length) return null;
  const leftMatch = text.slice(0, offset).match(/(\S+)$/);
  const rightMatch = text.slice(offset).match(/^(\S+)/);
  if (!leftMatch && !rightMatch) return null;
  let from = leftMatch ? offset - leftMatch[0].length : offset;
  let to = rightMatch ? offset + rightMatch[0].length : offset;
  const word = text.slice(from, to);
  const leadTrim = word.length - word.replace(WORD_LEAD_PUNCT, "").length;
  const trailTrim = word.length - word.replace(WORD_TRAIL_PUNCT, "").length;
  if (from + leadTrim < to - trailTrim) {
    return { from: from + leadTrim, to: to - trailTrim };
  }
  return { from, to };
}

// Ekstraksi teks polos untuk pencarian, aria-label, validasi, dan sel PDF.
export function plainTextFromHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|ul|ol|tr|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}