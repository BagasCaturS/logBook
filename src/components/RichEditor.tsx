import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import type { Lang } from "../lib/i18n";
import { t } from "../lib/i18n";
import { wordBoundariesAt, type TextRange } from "../lib/richtext";
import {
  IconBold,
  IconItalic,
  IconLink,
  IconStrike,
  IconUnderline,
} from "./icons";

interface Props {
  value: string;
  placeholder: string;
  lang: Lang;
  onChange: (html: string) => void;
}

function normalizeUrl(raw: string): string | null {
  let url = raw.trim();
  if (!url) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(url)) url = `https://${url}`;
  try {
    const u = new URL(url);
    if (u.protocol === "http:" || u.protocol === "https:") return u.href;
    return null;
  } catch {
    return null;
  }
}

const EMPTY_ACTIVE = {
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  link: false,
};

function ToolButton({
  title,
  active,
  onClick,
  onPress,
  children,
}: {
  title: string;
  active: boolean;
  onClick: () => void;
  onPress?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`editor-btn${active ? " active" : ""}`}
      title={title}
      aria-label={title}
      aria-pressed={active}
      onMouseDown={(e) => {
        e.preventDefault();
        onPress?.();
      }}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default function RichEditor({ value, placeholder, lang, onChange }: Props) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkText, setLinkText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const [isEmpty, setIsEmpty] = useState(true);
  const initialValueRef = useRef<string>(value);
  const savedSelectionRef = useRef<TextRange | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false, autolink: false }),
    ],
    content: initialValueRef.current,
    editorProps: {
      attributes: {
        class: "editor-prose",
        "aria-label": t(lang, "form.kegiatan"),
        spellcheck: "true",
      },
    },
    onUpdate: ({ editor: ed }) => {
      setIsEmpty(ed.isEmpty);
      onChange(ed.getHTML());
    },
  });

  // State aktif toolbar mengikuti setiap transaksi editor (termasuk saat caret
  // tanpa seleksi) sehingga tombol langsung berubah setelah diklik.
  const active =
    useEditorState({
      editor,
      selector: ({ editor: ed }) => ({
        bold: !!ed?.isActive("bold"),
        italic: !!ed?.isActive("italic"),
        underline: !!ed?.isActive("underline"),
        strike: !!ed?.isActive("strike"),
        link: !!ed?.isActive("link"),
      }),
    }) ?? EMPTY_ACTIVE;

  // Sinkronkan konten saat nilai berubah dari luar (ganti entri yang diedit,
  // reset form). Jangan menimpa saat pengguna sedang mengetik atau sedang
  // mengisi linkbar.
  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() === value) {
      setIsEmpty(editor.isEmpty);
      return;
    }
    if (editor.isFocused || linkOpen) return;
    editor.commands.setContent(value, { emitUpdate: false });
    setIsEmpty(editor.isEmpty);
  }, [value, editor, linkOpen]);

  // Saat linkbar terbuka, ikuti perubahan selection dari klik di dalam editor.
  useEffect(() => {
    if (!editor || !linkOpen) return;
    const sync = () => {
      savedSelectionRef.current = {
        from: editor.state.selection.from,
        to: editor.state.selection.to,
      };
    };
    editor.on("selectionUpdate", sync);
    return () => {
      editor.off("selectionUpdate", sync);
    };
  }, [editor, linkOpen]);

  // Perbarui atribut placeholder saat bahasa berganti.
  useEffect(() => {
    editor?.view.dom.setAttribute("data-placeholder", placeholder);
    editor?.view.dom.setAttribute("aria-label", t(lang, "form.kegiatan"));
  }, [placeholder, lang, editor]);

  if (!editor) {
    return <div className="editor-frame editor-empty" />;
  }

  // Simpan selection sebelum fokus berpindah (klik tombol / buka linkbar) dan
  // pastikan editor tetap fokus sehingga selection-nya dipertahankan.
  function preserveSelection() {
    const { from, to } = editor.state.selection;
    savedSelectionRef.current = { from, to };
    if (!editor.isFocused) editor.view.dom.focus({ preventScroll: true });
  }

  // Jalankan perintah format pada selection yang dijamin utuh. Setiap format
  // independen sehingga bisa saling timpa-tindih (bold + italic + strike + u).
  function runToggle(mark: "bold" | "italic" | "underline" | "strike") {
    const sel = savedSelectionRef.current;
    savedSelectionRef.current = null;
    let chain = editor.chain().focus();
    if (sel) {
      const size = editor.state.doc.content.size;
      const from = Math.max(0, Math.min(sel.from, size));
      const to = Math.max(0, Math.min(sel.to, size));
      chain = chain.setTextSelection({ from, to });
    }
    chain.toggleMark(mark).run();
  }

  // Range target link: selection tersimpan bila non-kosong; bila caret kosong,
  // perluas ke kata penuh di sekitar caret (bukan huruf pertama).
  function linkRange(): TextRange {
    const sel = savedSelectionRef.current;
    const size = editor.state.doc.content.size;
    const from = sel ? Math.max(0, Math.min(sel.from, size)) : editor.state.selection.from;
    const to = sel ? Math.max(0, Math.min(sel.to, size)) : editor.state.selection.to;
    if (from !== to) return { from, to };
    return expandWordRange(editor, Math.min(from, size));
  }

  function openLinkBar() {
    const range = linkRange();
    const prev = editor.getAttributes("link").href as string | undefined;
    setLinkText(editor.state.doc.textBetween(range.from, range.to));
    setLinkUrl(prev ?? "");
    setLinkError(null);
    savedSelectionRef.current = range;
    setLinkOpen(true);
  }

  function applyLink() {
    const text = linkText.trim();
    if (!text) {
      setLinkError(t(lang, "editor.linkTextEmpty"));
      return;
    }
    const url = normalizeUrl(linkUrl);
    if (!url) {
      setLinkError(t(lang, "editor.linkInvalid"));
      return;
    }
    const range = savedSelectionRef.current ?? linkRange();
    savedSelectionRef.current = null;
    editor
      .chain()
      .focus()
      .setTextSelection(range)
      .insertContent({
        type: "text",
        text,
        marks: [{ type: "link", attrs: { href: url } }],
      })
      .run();
    setLinkOpen(false);
  }

  function removeLink() {
    const range = linkRange();
    savedSelectionRef.current = null;
    editor.chain().focus().setTextSelection(range).extendMarkRange("link").unsetLink().run();
    setLinkOpen(false);
  }

  function linkKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") applyLink();
    if (e.key === "Escape") setLinkOpen(false);
  }

  const hasLink = active.link;

  return (
    <div className={`editor-shell${isEmpty ? " ph-empty" : ""}`}>
      <div className="editor-toolbar" role="toolbar" aria-label={t(lang, "form.kegiatan")}>
        <ToolButton
          title={t(lang, "editor.bold")}
          active={active.bold}
          onPress={preserveSelection}
          onClick={() => runToggle("bold")}
        >
          <IconBold size={15} />
        </ToolButton>
        <ToolButton
          title={t(lang, "editor.italic")}
          active={active.italic}
          onPress={preserveSelection}
          onClick={() => runToggle("italic")}
        >
          <IconItalic size={15} />
        </ToolButton>
        <ToolButton
          title={t(lang, "editor.underline")}
          active={active.underline}
          onPress={preserveSelection}
          onClick={() => runToggle("underline")}
        >
          <IconUnderline size={15} />
        </ToolButton>
        <ToolButton
          title={t(lang, "editor.strike")}
          active={active.strike}
          onPress={preserveSelection}
          onClick={() => runToggle("strike")}
        >
          <IconStrike size={15} />
        </ToolButton>
        <ToolButton
          title={t(lang, "editor.link")}
          active={hasLink}
          onPress={preserveSelection}
          onClick={openLinkBar}
        >
          <IconLink size={15} />
        </ToolButton>
      </div>
      {linkOpen && (
        <div className="editor-linkbar" role="group" aria-label={t(lang, "editor.link")}>
          <input
            autoFocus
            value={linkText}
            placeholder={t(lang, "editor.linkText")}
            aria-label={t(lang, "editor.linkText")}
            onChange={(e) => {
              setLinkText(e.target.value);
              if (linkError) setLinkError(null);
            }}
            onKeyDown={linkKeyDown}
          />
          <input
            value={linkUrl}
            placeholder={t(lang, "editor.linkUrl")}
            aria-label={t(lang, "editor.linkUrl")}
            onChange={(e) => {
              setLinkUrl(e.target.value);
              if (linkError) setLinkError(null);
            }}
            onKeyDown={linkKeyDown}
          />
          <button type="button" onClick={applyLink}>
            {t(lang, "editor.linkApply")}
          </button>
          {hasLink && (
            <button type="button" className="secondary" onClick={removeLink}>
              {t(lang, "editor.linkRemove")}
            </button>
          )}
          <button
            type="button"
            className="secondary"
            onClick={() => setLinkOpen(false)}
          >
            {t(lang, "form.cancel")}
          </button>
          {linkError && <span className="error editor-link-error">{linkError}</span>}
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}

// Perluas posisi caret (selection kosong) menjadi rentang kata penuh di dalam
// paragraf yang berisi caret. Posisi paragraf = start() + offset relatif teks.
function expandWordRange(editor: Editor, pos: number): TextRange {
  const $pos = editor.state.doc.resolve(pos);
  const parent = $pos.parent;
  if (!parent.isTextblock || parent.content.size === 0) {
    return { from: pos, to: pos };
  }
  // Leaf node (mis. hardBreak) ikut dihitung sebagai satu karakter agar offset
  // teks sejajar dengan offset dokumen.
  const text = parent.textBetween(0, parent.content.size, undefined, () => " ");
  const rel = wordBoundariesAt(text, $pos.parentOffset);
  if (!rel) return { from: pos, to: pos };
  return { from: $pos.start() + rel.from, to: $pos.start() + rel.to };
}
