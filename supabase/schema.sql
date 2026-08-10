-- ============================================================
-- Online Logbook — Supabase schema
-- Jalankan skrip ini di: Supabase Dashboard -> SQL Editor
-- ============================================================

create table if not exists public.logbook_entries (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  kegiatan text not null,
  tanggal date not null,
  minggu integer not null check (minggu >= 1),
  hari_ke integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted boolean not null default false
);

create index if not exists logbook_entries_user_updated_idx
  on public.logbook_entries (user_id, updated_at);

create index if not exists logbook_entries_user_tanggal_idx
  on public.logbook_entries (user_id, tanggal desc);

-- Row Level Security: setiap user hanya bisa melihat datanya sendiri
alter table public.logbook_entries enable row level security;

drop policy if exists "own select" on public.logbook_entries;
create policy "own select" on public.logbook_entries
  for select using (auth.uid() = user_id);

drop policy if exists "own insert" on public.logbook_entries;
create policy "own insert" on public.logbook_entries
  for insert with check (auth.uid() = user_id);

drop policy if exists "own update" on public.logbook_entries;
create policy "own update" on public.logbook_entries
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own delete" on public.logbook_entries;
create policy "own delete" on public.logbook_entries
  for delete using (auth.uid() = user_id);
