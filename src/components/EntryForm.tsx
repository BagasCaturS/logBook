import { useEffect, useMemo, useState } from "react";
import type { Category, EntryInput, LogbookEntry } from "../lib/types";
import { computeMinggu, todayIso } from "../lib/dates";
import { t, type Lang } from "../lib/i18n";

interface Props {
  startDate: string;
  editing: LogbookEntry | null;
  initialDate?: string | null;
  categories: Category[];
  lang: Lang;
  onSave: (input: EntryInput, id: string | null) => Promise<void>;
  onCreateCategory: (name: string) => Promise<Category | undefined>;
  onCancel: () => void;
}

export default function EntryForm({
  startDate,
  editing,
  initialDate,
  categories,
  lang,
  onSave,
  onCreateCategory,
  onCancel,
}: Props) {
  const [kegiatan, setKegiatan] = useState("");
  const [tanggal, setTanggal] = useState(todayIso());
  const [minggu, setMinggu] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedPhase, setSavedPhase] = useState<"show" | "leave" | null>(null);

  useEffect(() => {
    if (editing) {
      setKegiatan(editing.kegiatan);
      setTanggal(editing.tanggal);
      setMinggu(String(editing.minggu));
      setSelectedCategories(editing.category_ids ?? []);
    } else {
      setKegiatan("");
      const d = initialDate ?? todayIso();
      setTanggal(d);
      const a = computeMinggu(d, startDate);
      setMinggu(a.minggu !== null ? String(a.minggu) : "");
      setSelectedCategories([]);
    }
    setShowNewCategory(false);
    setNewCategoryName("");
  }, [editing, initialDate, startDate]);

  useEffect(() => {
    if (savedPhase === "show") {
      const t = window.setTimeout(() => setSavedPhase("leave"), 1600);
      return () => window.clearTimeout(t);
    }
    if (savedPhase === "leave") {
      const t = window.setTimeout(() => setSavedPhase(null), 260);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [savedPhase]);

  const auto = useMemo(() => computeMinggu(tanggal, startDate), [tanggal, startDate]);

  function handleTanggalChange(v: string) {
    setTanggal(v);
    const a = computeMinggu(v, startDate);
    if (a.minggu !== null) setMinggu(String(a.minggu));
  }

  function toggleCategory(id: string) {
    setSelectedCategories((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function createCategory() {
    const name = newCategoryName.trim();
    if (!name) {
      setError(t(lang, "form.errCategory"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const cat = await onCreateCategory(name);
      if (cat) {
        setSelectedCategories((prev) => [...prev, cat.id]);
        setShowNewCategory(false);
        setNewCategoryName("");
      }
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!kegiatan.trim()) {
      setError(t(lang, "form.errKegiatan"));
      return;
    }
    if (!tanggal) {
      setError(t(lang, "form.errTanggal"));
      return;
    }
    const m = Number(minggu);
    if (!Number.isInteger(m) || m < 1) {
      setError(t(lang, "form.errMinggu"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(
        {
          kegiatan: kegiatan.trim(),
          tanggal,
          minggu: m,
          hari_ke: auto.hariKe ?? null,
          category_ids: selectedCategories,
        },
        editing?.id ?? null
      );
      setSavedPhase("show");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`form${editing ? " editing" : ""}`}>
      <h3>{editing ? t(lang, "form.editTitle") : t(lang, "form.addTitle")}</h3>
      <label>
        {t(lang, "form.kegiatan")}
        <textarea
          rows={3}
          value={kegiatan}
          onChange={(e) => setKegiatan(e.target.value)}
          placeholder={t(lang, "form.kegiatanPlaceholder")}
        />
      </label>
      <div className="row">
        <label>
          {t(lang, "form.tanggal")}
          <input
            type="date"
            value={tanggal}
            onChange={(e) => handleTanggalChange(e.target.value)}
          />
        </label>
        <label>
          {t(lang, "form.minggu")}
          <input
            type="number"
            min={1}
            value={minggu}
            onChange={(e) => setMinggu(e.target.value)}
          />
        </label>
      </div>
      <div className="cat-picker">
        <span className="cat-label">{t(lang, "form.kategori")}</span>
        {categories.length === 0 ? (
          <p className="hint">{t(lang, "list.noCategories")}</p>
        ) : (
          <div className="cat-chips">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`cat-chip${selectedCategories.includes(c.id) ? " active" : ""}`}
                style={selectedCategories.includes(c.id) ? { background: c.color } : undefined}
                onClick={() => toggleCategory(c.id)}
                aria-pressed={selectedCategories.includes(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
        {showNewCategory ? (
          <div className="cat-new">
            <input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void createCategory()}
              placeholder={t(lang, "form.categoryPlaceholder")}
              autoFocus
            />
            <button disabled={busy} onClick={() => void createCategory()}>
              {t(lang, "form.add")}
            </button>
            <button
              className="secondary"
              onClick={() => {
                setShowNewCategory(false);
                setNewCategoryName("");
              }}
            >
              {t(lang, "form.cancel")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="link"
            onClick={() => setShowNewCategory(true)}
          >
            {t(lang, "form.newCategory")}
          </button>
        )}
      </div>
      {startDate && auto.minggu !== null ? (
        <p className="hint">
          {t(lang, "form.auto", { minggu: auto.minggu, hari: auto.hariKe ?? "-" })}
        </p>
      ) : startDate ? (
        <p className="hint">{t(lang, "form.beforeStart")}</p>
      ) : (
        <p className="hint">{t(lang, "form.noStartDate")}</p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="row actions">
        <button disabled={busy} onClick={submit}>
          {busy
            ? t(lang, "form.saving")
            : editing
              ? t(lang, "form.saveChanges")
              : t(lang, "form.add")}
        </button>
        <button className="secondary" onClick={onCancel}>
          {t(lang, "form.cancel")}
        </button>
      </div>
      {savedPhase && (
        <p
          className={`info saved-toast${savedPhase === "leave" ? " leaving" : ""}`}
          role="status"
        >
          {t(lang, "form.saved")}
        </p>
      )}
    </div>
  );
}
