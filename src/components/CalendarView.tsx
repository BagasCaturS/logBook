import { useMemo, useState } from "react";
import type { Category, DailyNote, LogbookEntry } from "../lib/types";
import {
  computeMinggu,
  formatMonthYear,
  formatTanggal,
  getMonthGrid,
  todayIso,
  WEEKDAYS_SHORT,
} from "../lib/dates";
import { t, type Lang } from "../lib/i18n";
import { plainTextFromHtml, renderEntryText } from "../lib/richtext";
import { openUrl } from "@tauri-apps/plugin-opener";
import { IconChevronLeft, IconChevronRight, IconPencil, IconPlus, IconTrash } from "./icons";
import NoteEditor from "./NoteEditor";
import PhotoThumbs from "./PhotoThumbs";

function handleContentClick(e: React.MouseEvent<HTMLDivElement>) {
  const a = (e.target as HTMLElement).closest("a[href]");
  if (!a) return;
  const href = a.getAttribute("href");
  if (!href) return;
  e.preventDefault();
  void openUrl(href).catch(() => window.open(href, "_blank"));
}

interface Props {
  entries: LogbookEntry[];
  categories: Category[];
  notes: DailyNote[];
  startDate: string;
  leavingId?: string | null;
  supabaseUrl: string;
  lang: Lang;
  hourLabel: string;
  onAdd: (date: string) => void;
  onEdit: (e: LogbookEntry) => void;
  onDelete: (e: LogbookEntry) => void;
  onOpenPhoto: (url: string) => void;
  onSaveNote: (tanggal: string, isi: string) => void;
}

export default function CalendarView({
  entries,
  categories,
  notes,
  startDate,
  leavingId,
  supabaseUrl,
  lang,
  hourLabel,
  onAdd,
  onEdit,
  onDelete,
  onOpenPhoto,
  onSaveNote,
}: Props) {
  const now = todayIso();
  const [cursor, setCursor] = useState(() => {
    const nowD = new Date();
    return { year: nowD.getFullYear(), month: nowD.getMonth() };
  });
  const [selected, setSelected] = useState(now);

  const cells = useMemo(() => getMonthGrid(cursor.year, cursor.month), [cursor]);

  const byDate = useMemo(() => {
    const map = new Map<string, LogbookEntry[]>();
    for (const e of entries) {
      const arr = map.get(e.tanggal);
      if (arr) arr.push(e);
      else map.set(e.tanggal, [e]);
    }
    return map;
  }, [entries]);

  const catById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  const noteByDate = useMemo(
    () => new Map(notes.map((n) => [n.tanggal, n])),
    [notes]
  );

  const selectedEntries = byDate.get(selected) ?? [];
  const selectedNote = noteByDate.get(selected) ?? null;
  const mingguInfo = useMemo(
    () => computeMinggu(selected, startDate),
    [selected, startDate]
  );

  function goMonth(delta: number) {
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  function goToday() {
    const d = new Date();
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
    setSelected(now);
  }

  return (
    <section className="m-t card calendar-section" aria-label={t(lang, "cal.title")}>
      <div className="cal-head">
        <h3>{t(lang, "cal.title")}</h3>
        <div className="cal-nav">
          <button className="icon-btn secondary" onClick={() => goMonth(-1)} aria-label={t(lang, "cal.prev")}>
            <IconChevronLeft size={16} />
          </button>
          <button className="secondary" onClick={goToday}>
            {t(lang, "cal.today")}
          </button>
          <button className="icon-btn secondary" onClick={() => goMonth(1)} aria-label={t(lang, "cal.next")}>
            <IconChevronRight size={16} />
          </button>
        </div>
      </div>
      <p className="cal-month-title">{formatMonthYear(`${cursor.year}-${cursor.month + 1}-01`, lang)}</p>

      <div className="cal-weekdays">
        {WEEKDAYS_SHORT[lang].map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>

      <div className="calendar-grid">
        {cells.map((cell, i) => {
          const dayEntries = byDate.get(cell.date);
          const count = dayEntries?.length ?? 0;
          const hasNote = noteByDate.has(cell.date);
          const classes = ["cal-cell"];
          if (!cell.inMonth) classes.push("outside");
          if (cell.date === now) classes.push("today");
          if (cell.date === selected) classes.push("selected");
          if (count > 0) classes.push("has");
          if (hasNote) classes.push("has-note");
          return (
            <button
              key={cell.date}
              className={classes.join(" ")}
              style={{ animationDelay: `${i * 12}ms` }}
              onClick={() => setSelected(cell.date)}
              aria-label={
                count > 0
                  ? t(lang, "cal.dayAria", { tanggal: formatTanggal(cell.date, lang), count })
                  : formatTanggal(cell.date, lang)
              }
            >
              <span className="cal-day-num">{Number(cell.date.slice(8, 10))}</span>
              {count > 0 && (
                <span className="cal-count">
                  <span className="cal-dot" />
                  {count > 9 ? "9+" : count}
                </span>
              )}
              {hasNote && <span className="cal-note-dot" />}
            </button>
          );
        })}
      </div>

      <div className="day-panel" key={selected}>
        <div className="day-panel-head">
          <div>
            <strong>{formatTanggal(selected, lang)}</strong>
            {mingguInfo.minggu !== null && (
              <span className="day-meta">
                {t(lang, "cal.meta", { minggu: mingguInfo.minggu, hari: mingguInfo.hariKe ?? "-" })}
              </span>
            )}
          </div>
          <button className="secondary" onClick={() => onAdd(selected)}>
            <IconPlus size={14} />
            {t(lang, "cal.addActivity")}
          </button>
        </div>
        {selectedEntries.length === 0 ? (
          <p className="empty">{t(lang, "cal.emptyDay")}</p>
        ) : (
          <ul className="list">
            {selectedEntries.map((e) => (
              <li key={e.id} className={leavingId === e.id ? "removing" : ""}>
                <div className="entry-collapse">
                  <div className="entry-card">
                    <div className="entry-head">
                      <span className="badge">{t(lang, "list.mingguBadge", { minggu: e.minggu })}</span>
                      {e.hari_ke !== null && (
                        <span className="badge violet">{t(lang, "list.hariBadge", { hari: e.hari_ke })}</span>
                      )}
                      {e.jam !== null && (
                        <span className="badge amber">{hourLabel} - {e.jam}</span>
                      )}
                      <span className="spacer" />
                      <button
                        className="link"
                        onClick={() => onEdit(e)}
                        aria-label={`${t(lang, "list.edit")}: ${plainTextFromHtml(e.kegiatan).slice(0, 40)}`}
                      >
                        <IconPencil size={13} />
                        {t(lang, "list.edit")}
                      </button>
                      <button
                        className="link danger"
                        onClick={() => onDelete(e)}
                        aria-label={`${t(lang, "list.delete")}: ${plainTextFromHtml(e.kegiatan).slice(0, 40)}`}
                      >
                        <IconTrash size={13} />
                        {t(lang, "list.delete")}
                      </button>
                    </div>
                    <div
                      className="kegiatan"
                      onClick={handleContentClick}
                      dangerouslySetInnerHTML={{ __html: renderEntryText(e.kegiatan) }}
                    />
                    {(e.category_ids ?? []).length > 0 && (
                      <div className="cat-chips cat-chips-card">
                        {e.category_ids.map((id) => {
                          const c = catById.get(id);
                          return c ? (
                            <span key={id} className="cat-chip" style={{ background: c.color, color: "#fff" }}>
                              {c.name}
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                    <PhotoThumbs paths={e.photo_paths ?? []} supabaseUrl={supabaseUrl} onOpen={onOpenPhoto} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
        <NoteEditor
          tanggal={selected}
          note={selectedNote}
          lang={lang}
          onSave={onSaveNote}
        />
      </div>
    </section>
  );
}
