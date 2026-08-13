import { useEffect, useMemo, useRef, useState } from "react";
import type { Category, EntryInput, LogbookEntry } from "../lib/types";
import { computeMinggu, todayIso } from "../lib/dates";
import { t, type Lang } from "../lib/i18n";
import { MAX_PHOTOS, isBigFile, photoUrl, type PhotoOps } from "../lib/photos";
import { errMessage } from "../lib/sync";
import { plainTextFromHtml, sanitizeHtml } from "../lib/richtext";
import RichEditor from "./RichEditor";

interface Props {
  startDate: string;
  editing: LogbookEntry | null;
  initialDate?: string | null;
  categories: Category[];
  supabaseUrl: string;
  lang: Lang;
  onSave: (input: EntryInput, id: string | null, photoOps: PhotoOps) => Promise<void>;
  onCreateCategory: (name: string) => Promise<Category | undefined>;
  onCancel: () => void;
}

export default function EntryForm({
  startDate,
  editing,
  initialDate,
  categories,
  supabaseUrl,
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
  const [keptPaths, setKeptPaths] = useState<string[]>([]);
  const [removedPaths, setRemovedPaths] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [bigFileNote, setBigFileNote] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing) {
      setKegiatan(editing.kegiatan);
      setTanggal(editing.tanggal);
      setMinggu(String(editing.minggu));
      setSelectedCategories(editing.category_ids ?? []);
      setKeptPaths(editing.photo_paths ?? []);
    } else {
      setKegiatan("");
      const d = initialDate ?? todayIso();
      setTanggal(d);
      const a = computeMinggu(d, startDate);
      setMinggu(a.minggu !== null ? String(a.minggu) : "");
      setSelectedCategories([]);
      setKeptPaths([]);
    }
    setShowNewCategory(false);
    setNewCategoryName("");
    setRemovedPaths([]);
    setNewFiles([]);
    setBigFileNote(false);
    setError(null);
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

  function handlePickFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const imgs = Array.from(list).filter((f) => f.type.startsWith("image/"));
    if (imgs.length === 0) return;
    const total = keptPaths.length + newFiles.length;
    const room = MAX_PHOTOS - total;
    if (room <= 0) {
      setError(t(lang, "photo.maxReached", { n: MAX_PHOTOS }));
      return;
    }
    const accept = imgs.slice(0, room);
    if (accept.length < imgs.length) {
      setError(t(lang, "photo.maxReached", { n: MAX_PHOTOS }));
    }
    setBigFileNote((prev) => prev || accept.some(isBigFile));
    setNewFiles((prev) => [...prev, ...accept]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeKept(path: string) {
    setKeptPaths((prev) => prev.filter((p) => p !== path));
    setRemovedPaths((prev) => [...prev, path]);
  }

  function removeNew(file: File) {
    setNewFiles((prev) => prev.filter((f) => f !== file));
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
    if (!plainTextFromHtml(kegiatan).trim()) {
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
          kegiatan: sanitizeHtml(kegiatan.trim()),
          tanggal,
          minggu: m,
          hari_ke: auto.hariKe ?? null,
          category_ids: selectedCategories,
          photo_paths: keptPaths,
        },
        editing?.id ?? null,
        { added: newFiles, removed: removedPaths }
      );
      setSavedPhase("show");
    } catch (e) {
      setError(t(lang, "photo.uploadError", { error: errMessage(e) }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`form${editing ? " editing" : ""}`}>
      <h3>{editing ? t(lang, "form.editTitle") : t(lang, "form.addTitle")}</h3>
      <div className="form-field">
        <span>{t(lang, "form.kegiatan")}</span>
        <RichEditor
          value={kegiatan}
          placeholder={t(lang, "form.kegiatanPlaceholder")}
          lang={lang}
          onChange={setKegiatan}
        />
      </div>
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
      <div className="photo-picker">
        <span className="cat-label">{t(lang, "photo.label", { n: MAX_PHOTOS })}</span>
        <div className="row actions">
          <button
            type="button"
            className="secondary"
            disabled={busy || keptPaths.length + newFiles.length >= MAX_PHOTOS}
            onClick={() => fileInputRef.current?.click()}
          >
            {t(lang, "photo.add")}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => handlePickFiles(e.target.files)}
          />
        </div>
        {bigFileNote && <p className="hint">{t(lang, "photo.bigFile")}</p>}
        {keptPaths.length + newFiles.length > 0 && (
          <div className="photo-grid form-photos">
            {keptPaths.map((p) => (
              <div key={p} className="photo-item">
                <img src={photoUrl(supabaseUrl, p)} alt="" loading="lazy" />
                <button
                  type="button"
                  className="photo-x"
                  onClick={() => removeKept(p)}
                  aria-label={t(lang, "photo.remove")}
                >
                  ×
                </button>
              </div>
            ))}
            {newFiles.map((f) => (
              <div key={f.name + f.lastModified} className="photo-item">
                <img src={URL.createObjectURL(f)} alt="" />
                <button
                  type="button"
                  className="photo-x"
                  onClick={() => removeNew(f)}
                  aria-label={t(lang, "photo.remove")}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
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
