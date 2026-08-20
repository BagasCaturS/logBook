# Changelog

Semua perubahan penting pada Online Logbook dicatat di sini.
Format mengikuti pola `[Versi] - Tanggal`; setiap entri mencatat tambahan (Added), perbaikan (Fixed), dan catatan migrasi (Migration).

## [0.9.0] - 2026-08-20

### Added
- **Bring-Your-Own-Supabase (BYO)** — aplikasi tidak lagi menyertakan kredensial bawaan:
  - Layar Setup pada pertama kali dijalankan (URL project + anon key)
  - Tombol "Uji Koneksi" (validasi URL, key, dan kesiapan setup SQL)
  - Ganti koneksi kapan saja: panel "Ubah Koneksi" di halaman login & tombol di Settings
- **Sinkronisasi pengaturan lintas perangkat** melalui tabel `app_settings` (tema, bahasa, periode & jam mulai) — konflik diselesaikan LWW by `updated_at`
- **Undo hapus entri** — notifikasi pulihkan dalam 10 detik setelah penghapusan (foto ikut dipulihkan)
- **Pengecekan email terdaftar** saat signup (RPC `check_email_registered`)
- **Satu file setup SQL idempotent** `docs/supabase-setup.sql` menggantikan `supabase-0.5/0.6/0.8.sql`
- README bilingual (Bahasa Indonesia / English) dengan langkah setup BYO

### Fixed
- **Login "tidak terjadi apa-apa" setelah ganti koneksi** — sesi kini di-set eksplisit setelah sign in, dan listener auth mengikuti koneksi aktif (sebelumnya listener terikat client lama, sehingga login sebenarnya berhasil tapi UI tetap di halaman login; sesi baru baru tampil setelah app dibuka ulang)
- **Uji koneksi false-negative** — query REST nyata diuji lebih dulu (PostgREST selalu mengirim header CORS); endpoint `auth/v1/health` hanya menjadi fallback diagnosis; deteksi project yang dipause (respons HTML)
- **Restore backup tidak melakukan apa-apa** — hasil `open()` dialog yang berupa array kini ditangani dengan benar
- **Error SQL "cannot alter type of a column used in a policy definition"** — policy di-drop sebelum normalisasi tipe `user_id` ke TEXT, lalu dibuat ulang

### Migration
- Jalankan ulang `docs/supabase-setup.sql` di Supabase Dashboard → SQL Editor (menambahkan RPC `check_email_registered`, normalisasi `user_id` ke TEXT untuk database lama), lalu jalankan `NOTIFY pgrst, 'reload schema';`
- Tanpa menjalankan ulang setup SQL, fungsi pengecekan email tidak tersedia (aplikasi tetap berfungsi normal)

## [0.8.0] - 2026-08-18

### Added
- **Catatan harian (daily notes)** — satu catatan per tanggal, plain text, sifat pribadi (tidak ikut export PDF):
  - Panel catatan di CalendarView pada tanggal terpilih + dot penanda di sel kalender
  - Sinkronisasi lintas device melalui tabel `daily_notes` (id deterministic `note-<tanggal>` agar tanpa duplikat, konflik diselesaikan LWW by `updated_at`)
  - Termasuk dalam backup/restore
  - i18n id/en
- `CHANGELOG.md` — riwayat perubahan semua versi

### Migration
- Jalankan `docs/supabase-0.8.sql` di Supabase Dashboard → SQL Editor (tabel `daily_notes` + index + RLS). File per versi telah digabung ke `docs/supabase-setup.sql` sejak v0.9.0.

## [0.7.3] - 2026-08-18

### Fixed
- **Sync lintas versi**: baris dengan timestamp sama dengan remote kini di-re-pull, sehingga kolom fitur baru (`jam`, `category_ids`, `photo_paths`) ikut terisi di perangkat yang baru di-update dari versi lama. Edit lokal yang lebih baru tetap dilindungi (LWW).

## [0.7.2]

### Added
- Fitur **jam**: menghitung jam bekerja sejak jam mulai (`hourStart`) per entri
- Redesain halaman Settings (5 bagian: Tampilan, Periode & jam, Kategori, Data & cadangan, Akun, Aplikasi)

## [0.7.0]

### Changed
- Perombakan editor teks kaya (toolbar)

> **Catatan:** rilis 0.7.0 ditandai UNSTABLE — ada bug toolbar editor yang masih mungkin muncul.

## [0.6.2]

### Fixed
- Perbaikan bug kategori pada entri

## [0.6.1]

### Fixed
- Perbaikan bug penghapusan kategori (kategori tidak terlepas dari entri)

## [0.6.0]

### Added
- **Foto sebagai dokumentasi** per entri (storage `entry-files`, bucket publik, RLS per pemilik)
- **Export PDF** laporan kegiatan (semua entri / per minggu)
- **Backup & restore** lokal (JSON)

### Migration
- `docs/supabase-0.6.sql`: kolom `photo_paths` + bucket storage + policy RLS

## [0.5.0]

### Added
- **Kategori** untuk entri (warna + nama)
- **Pilihan bahasa** (Bahasa Indonesia / English)
- **Window-state**: mengingat ukuran & posisi jendela

### Migration
- `docs/supabase-0.5.sql`: tabel `categories` + RLS

## [0.4.x]

### Added
- v0.4.4: ikon aplikasi baru
- v0.4.3: QOL improvements
- v0.4.2: kredit aplikasi + pagination jika entri banyak (+20) + layout daftar entri lebih kompak
- v0.4.0: **Calendar view** — memilih tanggal dan menautkan tugas ke tanggal terpilih

## [0.3.x]

### Added
- v0.3.1: perbaikan margin
- v0.3.0: perbaikan proses rilis (pesan commit sebagai body release)

## [0.2.0]

### Added
- **Updater otomatis** via GitHub Releases (tauri-plugin-updater + CI)
- Animasi untuk semua aksi UI
- Unit test untuk utilitas tanggal