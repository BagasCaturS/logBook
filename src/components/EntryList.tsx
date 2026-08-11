import { useEffect, useMemo, useState } from "react";
import type { Category, LogbookEntry } from "../lib/types";
import { formatTanggal } from "../lib/dates";
import { t, type Lang } from "../lib/i18n";
import { IconPencil, IconSearch, IconTrash } from "./icons";
import PhotoThumbs from "./PhotoThumbs";

interface Props {
  entries: LogbookEntry[];
  categories: Category[];
  leavingId?: string | null;
  supabaseUrl: string;
  lang: Lang;
  onEdit: (e: LogbookEntry) => void;
  onDelete: (e: LogbookEntry) => void;
  onOpenPhoto: (url: string) => void;
}

const PAGE_SIZE = 20;

export default function EntryList({ entries, categories, leavingId, supabaseUrl, lang, onEdit, onDelete, onOpenPhoto }: Props) {
  const [filter, setFilter] = useState("");
  const [mingguFilter, setMingguFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const catById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return entries.filter((e) => {
      if (mingguFilter && e.minggu !== Number(mingguFilter)) return false;
      if (categoryFilter && !(e.category_ids ?? []).includes(categoryFilter)) return false;
      if (q && !e.kegiatan.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entries, filter, mingguFilter, categoryFilter]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filter, mingguFilter, categoryFilter]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;
  const allShown = filtered.length <= PAGE_SIZE;

  return (
    <div className="list-wrap">
      <div className="filters">
        <div className="filter-field">
          <IconSearch size={16} />
          <input
            placeholder={t(lang, "list.search")}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label={t(lang, "list.search")}
          />
        </div>
        <input
          type="number"
          min={1}
          placeholder={t(lang, "list.filterMinggu")}
          value={mingguFilter}
          onChange={(e) => setMingguFilter(e.target.value)}
          aria-label={t(lang, "list.filterMinggu")}
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label={t(lang, "list.allCategories")}
        >
          <option value="">{t(lang, "list.allCategories")}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      {filtered.length === 0 ? (
        <p className="empty">{t(lang, "list.empty")}</p>
      ) : (
        <>
          <ul className="list">
            {visible.map((e) => (
              <li key={e.id} className={leavingId === e.id ? "removing" : ""}>
                <div className="entry-collapse">
                  <div className="entry-card">
                    <div className="entry-head">
                      <span className="badge">{t(lang, "list.mingguBadge", { minggu: e.minggu })}</span>
                      {e.hari_ke !== null && (
                        <span className="badge violet">{t(lang, "list.hariBadge", { hari: e.hari_ke })}</span>
                      )}
                      <span className="date">{formatTanggal(e.tanggal, lang)}</span>
                      <span className="spacer" />
                      <button className="link" onClick={() => onEdit(e)} aria-label={`${t(lang, "list.edit")}: ${e.kegiatan.slice(0, 40)}`}>
                        <IconPencil size={13} />
                        {t(lang, "list.edit")}
                      </button>
                      <button className="link danger" onClick={() => onDelete(e)} aria-label={`${t(lang, "list.delete")}: ${e.kegiatan.slice(0, 40)}`}>
                        <IconTrash size={13} />
                        {t(lang, "list.delete")}
                      </button>
                    </div>
                    <div className="kegiatan">{e.kegiatan}</div>
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
          {!allShown && (
            <div className="list-more">
              <p>
                {t(lang, "list.showing", { visible: visible.length, total: filtered.length })}
              </p>
              <div className="list-more-actions">
                {hasMore && (
                  <button onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}>
                    {t(lang, "list.showMore", {
                      n: Math.min(PAGE_SIZE, filtered.length - visibleCount),
                    })}
                  </button>
                )}
                <button className="link" onClick={() => setVisibleCount(filtered.length)}>
                  {t(lang, "list.showAll", { total: filtered.length })}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
