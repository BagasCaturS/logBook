-- ============================================================
-- Online Logbook — Migrasi v0.5.0 (kategori/tag)
-- Jalankan sekali di Supabase Dashboard → SQL Editor
-- ============================================================

-- 1) Kolom category_ids pada logbook_entries (JSON array id kategori)
ALTER TABLE logbook_entries
  ADD COLUMN IF NOT EXISTS category_ids TEXT NOT NULL DEFAULT '[]';

-- 2) Tabel categories
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted BOOLEAN NOT NULL DEFAULT false,
  dirty INTEGER NOT NULL DEFAULT 0
);

-- 2b) Perbaikan untuk database yang sudah menjalankan versi lama script ini
--     (deleted awalnya INTEGER, sekarang BOOLEAN agar cocok dengan aplikasi).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'categories' AND column_name = 'deleted'
      AND data_type = 'integer'
  ) THEN
    ALTER TABLE categories ALTER COLUMN deleted DROP DEFAULT;
    ALTER TABLE categories
      ALTER COLUMN deleted TYPE BOOLEAN USING (deleted = 1);
    ALTER TABLE categories ALTER COLUMN deleted SET DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_categories_user ON categories (user_id);

-- 3) Row Level Security (setiap user hanya melihat kategorinya sendiri)
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_select_own" ON categories;
CREATE POLICY "categories_select_own"
  ON categories FOR SELECT
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "categories_insert_own" ON categories;
CREATE POLICY "categories_insert_own"
  ON categories FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "categories_update_own" ON categories;
CREATE POLICY "categories_update_own"
  ON categories FOR UPDATE
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "categories_delete_own" ON categories;
CREATE POLICY "categories_delete_own"
  ON categories FOR DELETE
  USING (auth.uid()::text = user_id);
