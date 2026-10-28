import { useEffect, useMemo, useRef, useState } from "react";
import type { Category, EntryInput, LogbookEntry } from "../lib/types";
import { computeMinggu, hoursElapsed, todayIso } from "../lib/dates";
import { t, type Lang } from "../lib/i18n";
import { MAX_PHOTOS, isBigFile, type PhotoOps } from "../lib/photos";
import { groupPhotos, photoStorageOf, type PhotoStorage } from "../lib/photoPaths";
import { errMessage } from "../lib/sync";
import { plainTextFromHtml, sanitizeHtml } from "../lib/richtext";
import RichEditor from "./RichEditor";

interface Props {
  startDate: string;
  hourStart: string;
  hourLabel: string;
  editing: LogbookEntry | null;
  initialDate?: string | null;
  categories: Category[];
  resolvePhoto: (path: string) => string;
  lang: Lang;
  localMode: boolean;
  photoStorage: PhotoStorage;
  onPhotoStorageChange: (storage: PhotoStorage) => void;
  onSave: (input: EntryInput, id: string | null, photoOps: PhotoOps) => Promise<void>;
  onCreateCategory: (name: string) => Promise<Category | undefined>;
  onCancel: () => void;
}

export default function EntryForm({
  startDate,
  hourStart,
  hourLabel,
  editing,
  initialDate,
  categories,
  resolvePhoto,
  lang,
  localMode,
  photoStorage,
  onPhotoStorageChange,
  onSave,
  onCreateCategory,
  onCancel,
}: Props) {
  const [kegiatan, setKegiatan] = useState("");
  const [tanggal, setTanggal] = useState(todayIso());
  const [minggu, setMinggu] = useState("");
  const [jam, setJam] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedPhase, setSavedPhase] = useState<"show" | "leave" | null>(null);
  const [keptPaths, setKeptPaths] = useState<string[]>([]);
  const [newFiles, setNewFiles] = useState<{ file: File; storage: PhotoStorage }[]>([]);
  const [conversions, setConversions] = useState<{ key: string; to: PhotoStorage }[]>([]);
  const [bigFileNote, setBigFileNote] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing) {
      setKegiatan(editing.kegiatan);
      setTanggal(editing.tanggal);
      setMinggu(String(editing.minggu));
      setJam(editing.jam !== null ? String(editing.jam) : "");
      setSelectedCategories(editing.category_ids ?? []);
      setKeptPaths(editing.photo_paths ?? []);
    } else {
      setKegiatan("");
      const d = initialDate ?? todayIso();
      setTanggal(d);
      const a = computeMinggu(d, startDate);
      setMinggu(a.minggu !== null ? String(a.minggu) : "");
      setJam(d === todayIso() ? String(hoursElapsed(new Date(), hourStart) ?? "") : "");
      setSelectedCategories([]);
      setKeptPaths([]);
    }
    setShowNewCategory(false);
    setNewCategoryName("");
    setConversions([]);
    setNewFiles([]);
    setBigFileNote(false);
    setError(null);
  }, [editing, initialDate, startDate, hourStart]);

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
  const keptGroups = useMemo(() => groupPhotos(keptPaths), [keptPaths]);
  const chosenStorage: PhotoStorage = localMode ? "local" : photoStorage;

  function handleTanggalChange(v: string) {
    setTanggal(v);
    const a = computeMinggu(v, startDate);
    if (a.minggu !== null) setMinggu(String(a.minggu));
    if (v === todayIso()) setJam(String(hoursElapsed(new Date(), hourStart) ?? ""));
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
    const total = keptGroups.length + newFiles.length;
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
    setNewFiles((prev) => [
      ...prev,
      ...accept.map((file) => ({ file, storage: chosenStorage })),
    ]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeKept(groupKey: string) {
    const group = keptGroups.find((g) => g.key === groupKey);
    if (!group) return;
    setKeptPaths((prev) => prev.filter((p) => !group.paths.includes(p)));
    setConversions((prev) => prev.filter((c) => c.key !== groupKey));
  }

  function removeNew(index: number) {
    setNewFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function changeStorage(groupKey: string, to: PhotoStorage) {
    const group = keptGroups.find((g) => g.key === groupKey);
    setConversions((prev) => {
      const rest = prev.filter((c) => c.key !== groupKey);
      return group && to !== photoStorageOf(group) ? [...rest, { key: groupKey, to }] : rest;
    });
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
    const j = jam.trim() === "" ? null : Number(jam);
    if (j !== null && (!Number.isInteger(j) || j < 0)) {
      setError(t(lang, "form.errJam"));
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
          jam: j,
          category_ids: selectedCategories,
          photo_paths: keptPaths,
        },
        editing?.id ?? null,
        { added: newFiles, conversions }
      );
      setSavedPhase("show");
    } catch (e) {
      setError(t(lang, "photo.saveError", { error: errMessage(e) }));
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
        <label>
          {hourLabel}
          <input
            type="number"
            min={0}
            step={1}
            value={jam}
            onChange={(e) => setJam(e.target.value)}
          />
        </label>
      </div>
      <p className="hint">{t(lang, "form.jamHint")}</p>
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
              className="danger-soft"
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
        {!localMode && (
          <div className="photo-storage" role="group" aria-label={t(lang, "photo.storage")}>
            {(["local", "cloud", "both"] as const).map((s) => (
              <button
                key={s}
                type="button"
                className={`cat-chip storage-chip${photoStorage === s ? " active" : ""}`}
                aria-pressed={photoStorage === s}
                onClick={() => onPhotoStorageChange(s)}
              >
                {t(lang, `photo.${s}`)}
              </button>
            ))}
          </div>
        )}
        {!localMode && photoStorage !== "cloud" && (
          <p className="hint">
            {t(lang, photoStorage === "both" ? "photo.bothHint" : "photo.localOnlyHint")}
          </p>
        )}
        <div className="row actions">
          <button
            type="button"
            className="secondary"
            disabled={busy || keptGroups.length + newFiles.length >= MAX_PHOTOS}
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
        {keptGroups.length + newFiles.length > 0 && (
          <div className="photo-grid form-photos">
            {keptGroups.map((g) => {
              const target = conversions.find((c) => c.key === g.key)?.to ?? photoStorageOf(g);
              const display = g.local ?? g.cloud ?? "";
              return (
                <div key={g.key} className="photo-item">
                  {resolvePhoto(display) && (
                    <img src={resolvePhoto(display)} alt="" loading="lazy" />
                  )}
                  {!localMode && (
                    <select
                      className="photo-convert"
                      value={target}
                      disabled={busy}
                      aria-label={t(lang, "photo.convert")}
                      onChange={(e) => changeStorage(g.key, e.target.value as PhotoStorage)}
                    >
                      <option value="local">{t(lang, "photo.local")}</option>
                      <option value="cloud">{t(lang, "photo.cloud")}</option>
                      <option value="both">{t(lang, "photo.both")}</option>
                    </select>
                  )}
                  {localMode && (
                    <span className="photo-badge">{t(lang, `photo.${photoStorageOf(g)}`)}</span>
                  )}
                  <button
                    type="button"
                    className="photo-x"
                    onClick={() => removeKept(g.key)}
                    aria-label={t(lang, "photo.remove")}
                  >
                    ×
                  </button>
                </div>
              );
            })}
            {newFiles.map((item, i) => (
              <div key={`${item.file.name}-${item.file.lastModified}-${i}`} className="photo-item">
                <img src={URL.createObjectURL(item.file)} alt="" />
                <span className="photo-badge">{t(lang, `photo.${item.storage}`)}</span>
                <button
                  type="button"
                  className="photo-x"
                  onClick={() => removeNew(i)}
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
        <button className="danger-soft" onClick={onCancel}>
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
