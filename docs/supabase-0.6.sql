-- ============================================================
-- Online Logbook — Migrasi v0.6.0 (PDF, backup, foto)
-- Jalankan sekali di Supabase Dashboard → SQL Editor
-- ============================================================

-- 1) Kolom photo_paths pada logbook_entries (JSON array path foto storage)
ALTER TABLE logbook_entries
  ADD COLUMN IF NOT EXISTS photo_paths TEXT NOT NULL DEFAULT '[]';

-- 2) Bucket storage PUBLIK untuk foto (URL langsung bisa ditampilkan tanpa token)
INSERT INTO storage.buckets (id, name, public)
VALUES ('entry-files', 'entry-files', true)
ON CONFLICT (id) DO NOTHING;

-- 3) RLS storage: hanya pemilik (folder = user_id) yang bisa upload/hapus.
--    Baca publik berkat `public = true` di bucket; SELECT policy untuk
--    listing (dipakai pembersihan foto yatim oleh aplikasi).

DROP POLICY IF EXISTS "entry_files_select_own" ON storage.objects;
CREATE POLICY "entry_files_select_own"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'entry-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "entry_files_insert_own" ON storage.objects;
CREATE POLICY "entry_files_insert_own"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'entry-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "entry_files_update_own" ON storage.objects;
CREATE POLICY "entry_files_update_own"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'entry-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "entry_files_delete_own" ON storage.objects;
CREATE POLICY "entry_files_delete_own"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'entry-files'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
