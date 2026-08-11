import { useEffect, useMemo, useState } from "react";
import type { EntryInput, LogbookEntry } from "../lib/types";
import { computeMinggu, todayIso } from "../lib/dates";

interface Props {
  startDate: string;
  editing: LogbookEntry | null;
  initialDate?: string | null;
  onSave: (input: EntryInput, id: string | null) => Promise<void>;
  onCancel: () => void;
}

export default function EntryForm({ startDate, editing, initialDate, onSave, onCancel }: Props) {
  const [kegiatan, setKegiatan] = useState("");
  const [tanggal, setTanggal] = useState(todayIso());
  const [minggu, setMinggu] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedPhase, setSavedPhase] = useState<"show" | "leave" | null>(null);

  useEffect(() => {
    if (editing) {
      setKegiatan(editing.kegiatan);
      setTanggal(editing.tanggal);
      setMinggu(String(editing.minggu));
    } else {
      setKegiatan("");
      const t = initialDate ?? todayIso();
      setTanggal(t);
      const a = computeMinggu(t, startDate);
      setMinggu(a.minggu !== null ? String(a.minggu) : "");
    }
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

  async function submit() {
    if (!kegiatan.trim()) {
      setError("Kegiatan tidak boleh kosong.");
      return;
    }
    if (!tanggal) {
      setError("Pilih tanggal.");
      return;
    }
    const m = Number(minggu);
    if (!Number.isInteger(m) || m < 1) {
      setError("Minggu ke-? harus angka ≥ 1.");
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
      <h3>{editing ? "Edit Kegiatan" : "Tambah Kegiatan"}</h3>
      <label>
        Kegiatan
        <textarea
          rows={3}
          value={kegiatan}
          onChange={(e) => setKegiatan(e.target.value)}
          placeholder="Contoh: Belajar Laravel, ikut standup meeting, dll."
        />
      </label>
      <div className="row">
        <label>
          Tanggal
          <input
            type="date"
            value={tanggal}
            onChange={(e) => handleTanggalChange(e.target.value)}
          />
        </label>
        <label>
          Minggu ke-?
          <input
            type="number"
            min={1}
            value={minggu}
            onChange={(e) => setMinggu(e.target.value)}
          />
        </label>
      </div>
      {startDate && auto.minggu !== null ? (
        <p className="hint">
          Auto: Minggu {auto.minggu} · Hari ke-{auto.hariKe}
        </p>
      ) : startDate ? (
        <p className="hint">Tanggal ini sebelum tanggal mulai magang — isi minggu manual.</p>
      ) : (
        <p className="hint">Atur tanggal mulai magang di Pengaturan untuk auto-hitung minggu.</p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="row actions">
        <button disabled={busy} onClick={submit}>
          {busy ? "Menyimpan..." : editing ? "Simpan Perubahan" : "Tambah"}
        </button>
        <button className="secondary" onClick={onCancel}>
          Batal
        </button>
      </div>
      {savedPhase && (
        <p
          className={`info saved-toast${savedPhase === "leave" ? " leaving" : ""}`}
          role="status"
        >
          Tersimpan
        </p>
      )}
    </div>
  );
}
