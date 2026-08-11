import { useMemo, useState } from "react";
import type { LogbookEntry } from "../lib/types";
import {
  computeMinggu,
  formatMonthYear,
  formatTanggal,
  getMonthGrid,
  todayIso,
} from "../lib/dates";
import { IconChevronLeft, IconChevronRight, IconPencil, IconPlus, IconTrash } from "./icons";

interface Props {
  entries: LogbookEntry[];
  startDate: string;
  leavingId?: string | null;
  onAdd: (date: string) => void;
  onEdit: (e: LogbookEntry) => void;
  onDelete: (e: LogbookEntry) => void;
}

const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

export default function CalendarView({
  entries,
  startDate,
  leavingId,
  onAdd,
  onEdit,
  onDelete,
}: Props) {
  const now = todayIso();
  const [cursor, setCursor] = useState(() => {
    const t = new Date();
    return { year: t.getFullYear(), month: t.getMonth() };
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

  const selectedEntries = byDate.get(selected) ?? [];
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
    const t = new Date();
    setCursor({ year: t.getFullYear(), month: t.getMonth() });
    setSelected(now);
  }

  return (
    <section className="m-t card calendar-section" aria-label="Kalender kegiatan">
      <div className="cal-head">
        <h3>Kalender Kegiatan</h3>
        <div className="cal-nav">
          <button className="icon-btn secondary" onClick={() => goMonth(-1)} aria-label="Bulan sebelumnya">
            <IconChevronLeft size={16} />
          </button>
          <button className="secondary" onClick={goToday}>
            Hari ini
          </button>
          <button className="icon-btn secondary" onClick={() => goMonth(1)} aria-label="Bulan berikutnya">
            <IconChevronRight size={16} />
          </button>
        </div>
      </div>
      <p className="cal-month-title">{formatMonthYear(`${cursor.year}-${cursor.month + 1}-01`)}</p>

      <div className="cal-weekdays">
        {WEEKDAYS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>

      <div className="calendar-grid">
        {cells.map((cell, i) => {
          const dayEntries = byDate.get(cell.date);
          const count = dayEntries?.length ?? 0;
          const classes = ["cal-cell"];
          if (!cell.inMonth) classes.push("outside");
          if (cell.date === now) classes.push("today");
          if (cell.date === selected) classes.push("selected");
          if (count > 0) classes.push("has");
          return (
            <button
              key={cell.date}
              className={classes.join(" ")}
              style={{ animationDelay: `${i * 12}ms` }}
              onClick={() => setSelected(cell.date)}
              aria-label={`${formatTanggal(cell.date)}${count > 0 ? `, ${count} kegiatan` : ""}`}
            >
              <span className="cal-day-num">{Number(cell.date.slice(8, 10))}</span>
              {count > 0 && (
                <span className="cal-count">
                  <span className="cal-dot" />
                  {count > 9 ? "9+" : count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="day-panel" key={selected}>
        <div className="day-panel-head">
          <div>
            <strong>{formatTanggal(selected)}</strong>
            {mingguInfo.minggu !== null && (
              <span className="day-meta">
                Minggu ke-{mingguInfo.minggu} · Hari ke-{mingguInfo.hariKe}
              </span>
            )}
          </div>
          <button className="secondary" onClick={() => onAdd(selected)}>
            <IconPlus size={14} />
            Tambah Kegiatan
          </button>
        </div>
        {selectedEntries.length === 0 ? (
          <p className="empty">Tidak ada kegiatan pada tanggal ini.</p>
        ) : (
          <ul className="list">
            {selectedEntries.map((e) => (
              <li key={e.id} className={leavingId === e.id ? "removing" : ""}>
                <div className="entry-collapse">
                  <div className="entry-card">
                    <div className="entry-head">
                      <span className="badge">Minggu {e.minggu}</span>
                      {e.hari_ke !== null && (
                        <span className="badge violet">Hari ke-{e.hari_ke}</span>
                      )}
                      <span className="spacer" />
                      <button
                        className="link"
                        onClick={() => onEdit(e)}
                        aria-label={`Edit: ${e.kegiatan.slice(0, 40)}`}
                      >
                        <IconPencil size={13} />
                        Edit
                      </button>
                      <button
                        className="link danger"
                        onClick={() => onDelete(e)}
                        aria-label={`Hapus: ${e.kegiatan.slice(0, 40)}`}
                      >
                        <IconTrash size={13} />
                        Hapus
                      </button>
                    </div>
                    <div className="kegiatan">{e.kegiatan}</div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
