-- ============================================================
-- Online Logbook — Migrasi v0.8.0 (Catatan harian)
-- Jalankan sekali di Supabase Dashboard → SQL Editor
-- ============================================================

-- 1) Tabel catatan harian: satu baris per user per tanggal.
--    id deterministic (`note-<tanggal>`) agar dua perangkat yang membuat
--    catatan tanggal yang sama tidak menghasilkan duplikat (LWW by updated_at).
CREATE TABLE IF NOT EXISTS public.daily_notes (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  tanggal TEXT NOT NULL,
  isi TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted BOOLEAN NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_daily_notes_user_tanggal
  ON public.daily_notes (user_id, tanggal DESC);

-- 2) RLS: hanya pemilik yang bisa membaca/menulis catatannya sendiri
ALTER TABLE public.daily_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_notes_select_own" ON public.daily_notes;
CREATE POLICY "daily_notes_select_own"
  ON public.daily_notes FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "daily_notes_insert_own" ON public.daily_notes;
CREATE POLICY "daily_notes_insert_own"
  ON public.daily_notes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "daily_notes_update_own" ON public.daily_notes;
CREATE POLICY "daily_notes_update_own"
  ON public.daily_notes FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "daily_notes_delete_own" ON public.daily_notes;
CREATE POLICY "daily_notes_delete_own"
  ON public.daily_notes FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());