import { useEffect, useState } from "react";
import type { DailyNote } from "../lib/types";
import { t, type Lang } from "../lib/i18n";

interface Props {
  tanggal: string;
  note: DailyNote | null;
  lang: Lang;
  onSave: (tanggal: string, isi: string) => void;
}

export default function NoteEditor({ tanggal, note, lang, onSave }: Props) {
  const [text, setText] = useState(note?.isi ?? "");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setText(note?.isi ?? "");
    setSaved(false);
  }, [tanggal, note?.isi]);

  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(false), 2500);
    return () => window.clearTimeout(timer);
  }, [saved]);

  return (
    <section className="card note-editor">
      <div className="note-head">
        <h3>{t(lang, "note.title")}</h3>
        {saved && <span className="note-saved">{t(lang, "note.saved")}</span>}
      </div>
      <textarea
        className="note-input"
        value={text}
        placeholder={t(lang, "note.placeholder")}
        onChange={(e) => setText(e.target.value)}
        aria-label={t(lang, "note.title")}
        rows={3}
      />
      <div className="row">
        <button
          className="secondary"
          disabled={text.trim() === (note?.isi ?? "")}
          onClick={() => {
            onSave(tanggal, text);
            setSaved(true);
          }}
        >
          {t(lang, "note.save")}
        </button>
      </div>
    </section>
  );
}
