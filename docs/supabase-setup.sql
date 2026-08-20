  -- ============================================================
  -- Online Logbook — SETUP LENGKAP SUPABASE (satu file)
  -- ============================================================
  -- Jalankan SEKALI di Supabase Dashboard → SQL Editor.
  -- Idempotent: aman dijalankan ulang (semua IF NOT EXISTS / DROP POLICY IF EXISTS).
  -- Setelah menjalankan, muat ulang schema cache:
  --   NOTIFY pgrst, 'reload schema';
  -- ============================================================
  -- Isi (dari migrasi v0.1–v0.9):
  --   1) Tabel logbook_entries + RLS
  --   2) Tabel categories (kategori/tag) + RLS
  --   3) Foto: bucket storage `entry-files` + RLS storage
  --   4) Tabel daily_notes (catatan harian) + RLS
  --   5) Tabel app_settings (sinkronisasi pengaturan) + RLS
  -- ============================================================

  -- ------------------------------------------------------------
  -- 1) logbook_entries
  -- ------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS public.logbook_entries (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    kegiatan TEXT NOT NULL,
    tanggal TEXT NOT NULL,
    minggu INTEGER,
    hari_ke INTEGER,
    jam INTEGER,
    category_ids TEXT NOT NULL DEFAULT '[]',
    photo_paths TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted BOOLEAN NOT NULL DEFAULT false,
    dirty INTEGER NOT NULL DEFAULT 0
  );

-- Kolom tambahan dari versi baru — aman untuk database lama
ALTER TABLE public.logbook_entries
  ADD COLUMN IF NOT EXISTS category_ids TEXT NOT NULL DEFAULT '[]';
ALTER TABLE public.logbook_entries
  ADD COLUMN IF NOT EXISTS photo_paths TEXT NOT NULL DEFAULT '[]';
ALTER TABLE public.logbook_entries
  ADD COLUMN IF NOT EXISTS jam INTEGER;
ALTER TABLE public.logbook_entries
  ADD COLUMN IF NOT EXISTS hari_ke INTEGER;

-- Normalisasi tipe user_id ke TEXT (database lama yang memakai UUID akan
-- dikonversi otomatis, sehingga policy text = text tidak error).
-- Semua policy yang bergantung pada kolom user_id di-drop dulu (akan dibuat
-- ulang di bawah), karena PostgreSQL menolak mengubah tipe kolom yang dipakai
-- definisi policy.
DO $$
DECLARE
  pol record;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'logbook_entries' AND column_name = 'user_id'
      AND data_type = 'uuid'
  ) THEN
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'logbook_entries'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.logbook_entries', pol.policyname);
    END LOOP;
    ALTER TABLE public.logbook_entries ALTER COLUMN user_id TYPE TEXT USING (user_id::text);
  END IF;
END $$;

  CREATE INDEX IF NOT EXISTS idx_entries_user ON public.logbook_entries (user_id);
  CREATE INDEX IF NOT EXISTS idx_entries_user_tanggal ON public.logbook_entries (user_id, tanggal DESC);

  -- RLS: setiap user hanya melihat entrinya sendiri
  ALTER TABLE public.logbook_entries ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "entries_select_own" ON public.logbook_entries;
  CREATE POLICY "entries_select_own"
    ON public.logbook_entries FOR SELECT
    USING (auth.uid()::text = user_id);

  DROP POLICY IF EXISTS "entries_insert_own" ON public.logbook_entries;
  CREATE POLICY "entries_insert_own"
    ON public.logbook_entries FOR INSERT
    WITH CHECK (auth.uid()::text = user_id);

  DROP POLICY IF EXISTS "entries_update_own" ON public.logbook_entries;
  CREATE POLICY "entries_update_own"
    ON public.logbook_entries FOR UPDATE
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);

  DROP POLICY IF EXISTS "entries_delete_own" ON public.logbook_entries;
  CREATE POLICY "entries_delete_own"
    ON public.logbook_entries FOR DELETE
    USING (auth.uid()::text = user_id);

  -- ------------------------------------------------------------
  -- 2) categories (kategori/tag)
  -- ------------------------------------------------------------
  CREATE TABLE IF NOT EXISTS public.categories (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#6366f1',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted BOOLEAN NOT NULL DEFAULT false,
    dirty INTEGER NOT NULL DEFAULT 0
  );

-- Normalisasi tipe user_id ke TEXT (untuk database lama yang memakai UUID).
DO $$
DECLARE
  pol record;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'categories' AND column_name = 'user_id'
      AND data_type = 'uuid'
  ) THEN
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'categories'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.categories', pol.policyname);
    END LOOP;
    ALTER TABLE public.categories ALTER COLUMN user_id TYPE TEXT USING (user_id::text);
  END IF;
END $$;

-- Perbaikan untuk database yang sudah menjalankan versi lama script ini
-- (deleted awalnya INTEGER, sekarang BOOLEAN agar cocok dengan aplikasi).
  DO $$
  BEGIN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'categories' AND column_name = 'deleted'
        AND data_type = 'integer'
    ) THEN
      ALTER TABLE public.categories ALTER COLUMN deleted DROP DEFAULT;
      ALTER TABLE public.categories
        ALTER COLUMN deleted TYPE BOOLEAN USING (deleted = 1);
      ALTER TABLE public.categories ALTER COLUMN deleted SET DEFAULT false;
    END IF;
  END $$;

  CREATE INDEX IF NOT EXISTS idx_categories_user ON public.categories (user_id);

  ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "categories_select_own" ON public.categories;
  CREATE POLICY "categories_select_own"
    ON public.categories FOR SELECT
    USING (auth.uid()::text = user_id);

  DROP POLICY IF EXISTS "categories_insert_own" ON public.categories;
  CREATE POLICY "categories_insert_own"
    ON public.categories FOR INSERT
    WITH CHECK (auth.uid()::text = user_id);

  DROP POLICY IF EXISTS "categories_update_own" ON public.categories;
  CREATE POLICY "categories_update_own"
    ON public.categories FOR UPDATE
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);

  DROP POLICY IF EXISTS "categories_delete_own" ON public.categories;
  CREATE POLICY "categories_delete_own"
    ON public.categories FOR DELETE
    USING (auth.uid()::text = user_id);

  -- ------------------------------------------------------------
  -- 3) Foto: bucket storage `entry-files` + RLS
  -- ------------------------------------------------------------
  -- Bucket PUBLIK: URL langsung bisa ditampilkan tanpa token
  INSERT INTO storage.buckets (id, name, public)
  VALUES ('entry-files', 'entry-files', true)
  ON CONFLICT (id) DO NOTHING;

  -- RLS storage: hanya pemilik (folder = user_id) yang bisa upload/hapus.
  -- Baca publik berkat `public = true` di bucket; SELECT policy untuk
  -- listing (dipakai pembersihan foto yatim oleh aplikasi).

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

  -- ------------------------------------------------------------
  -- 4) daily_notes (catatan harian)
  -- ------------------------------------------------------------
  -- Satu baris per user per tanggal. id deterministic (`note-<tanggal>`)
  -- agar dua perangkat yang membuat catatan tanggal yang sama tidak
  -- menghasilkan duplikat (LWW by updated_at).
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

  -- ------------------------------------------------------------
  -- 5) app_settings (sinkronisasi pengaturan)
  -- ------------------------------------------------------------
  -- SATU baris per user (user_id sebagai primary key).
  -- Menyimpan pengaturan yang disinkronkan lintas device.
  CREATE TABLE IF NOT EXISTS public.app_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
    start_date TEXT NOT NULL DEFAULT '',
    hour_start TEXT NOT NULL DEFAULT '11:00',
    hour_label TEXT NOT NULL DEFAULT 'hour',
    theme TEXT NOT NULL DEFAULT 'jurnal',
    lang TEXT NOT NULL DEFAULT 'id',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted BOOLEAN NOT NULL DEFAULT false
  );

  ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "app_settings_select_own" ON public.app_settings;
  CREATE POLICY "app_settings_select_own"
    ON public.app_settings FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

  DROP POLICY IF EXISTS "app_settings_insert_own" ON public.app_settings;
  CREATE POLICY "app_settings_insert_own"
    ON public.app_settings FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

  DROP POLICY IF EXISTS "app_settings_update_own" ON public.app_settings;
  CREATE POLICY "app_settings_update_own"
    ON public.app_settings FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS "app_settings_delete_own" ON public.app_settings;
CREATE POLICY "app_settings_delete_own"
  ON public.app_settings FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ------------------------------------------------------------
-- 6) Helper: cek apakah email sudah terdaftar (halaman login/signup)
-- ------------------------------------------------------------
-- Dipanggil dari mode signup untuk memberi tahu pengguna apakah emailnya
-- sudah punya akun. SECURITY DEFINER agar bisa membaca auth.users;
-- hanya mengembalikan boolean, tidak membocorkan data lain.
CREATE OR REPLACE FUNCTION public.check_email_registered(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users WHERE lower(email) = lower(p_email)
  );
$$;

REVOKE ALL ON FUNCTION public.check_email_registered(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_email_registered(TEXT) TO anon, authenticated;