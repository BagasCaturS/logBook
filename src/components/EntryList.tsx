import { useEffect, useMemo, useState } from "react";
import type { LogbookEntry } from "../lib/types";
import { formatTanggal } from "../lib/dates";
import { IconPencil, IconSearch, IconTrash } from "./icons";

interface Props {
  entries: LogbookEntry[];
  leavingId?: string | null;
  onEdit: (e: LogbookEntry) => void;
  onDelete: (e: LogbookEntry) => void;
}

const PAGE_SIZE = 20;

export default function EntryList({ entries, leavingId, onEdit, onDelete }: Props) {
  const [filter, setFilter] = useState("");
  const [mingguFilter, setMingguFilter] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return entries.filter((e) => {
      if (mingguFilter && e.minggu !== Number(mingguFilter)) return false;
      if (q && !e.kegiatan.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entries, filter, mingguFilter]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filter, mingguFilter]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;
  const allShown = filtered.length <= PAGE_SIZE;

  return (
    <div className="list-wrap">
      <div className="filters">
        <div className="filter-field">
          <IconSearch size={16} />
          <input
            placeholder="Cari kegiatan..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Cari kegiatan"
          />
        </div>
        <input
          type="number"
          min={1}
          placeholder="Minggu ke-?"
          value={mingguFilter}
          onChange={(e) => setMingguFilter(e.target.value)}
          aria-label="Filter minggu ke-"
        />
      </div>
      {filtered.length === 0 ? (
        <p className="empty">Belum ada catatan. Tambahkan kegiatan pertamamu di atas!</p>
      ) : (
        <>
          <ul className="list">
            {visible.map((e) => (
              <li key={e.id} className={leavingId === e.id ? "removing" : ""}>
                <div className="entry-collapse">
                  <div className="entry-card">
                    <div className="entry-head">
                      <span className="badge">Minggu {e.minggu}</span>
                      {e.hari_ke !== null && <span className="badge violet">Hari ke-{e.hari_ke}</span>}
                      <span className="date">{formatTanggal(e.tanggal)}</span>
                      <span className="spacer" />
                      <button className="link" onClick={() => onEdit(e)} aria-label={`Edit: ${e.kegiatan.slice(0, 40)}`}>
                        <IconPencil size={13} />
                        Edit
                      </button>
                      <button className="link danger" onClick={() => onDelete(e)} aria-label={`Hapus: ${e.kegiatan.slice(0, 40)}`}>
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
          {!allShown && (
            <div className="list-more">
              <p>
                Menampilkan {visible.length} dari {filtered.length} catatan
              </p>
              <div className="list-more-actions">
                {hasMore && (
                  <button onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}>
                    Tampilkan lebih banyak (+{Math.min(PAGE_SIZE, filtered.length - visibleCount)})
                  </button>
                )}
                <button className="link" onClick={() => setVisibleCount(filtered.length)}>
                  Tampilkan semua ({filtered.length})
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
