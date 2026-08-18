# Changelog

Semua perubahan penting pada Online Logbook dicatat di sini.
Format mengikuti pola `[Versi] - Tanggal`; setiap entri mencatat tambahan (Added), perbaikan (Fixed), dan catatan migrasi (Migration).

## [0.8.0] - 2026-08-18

### Added
- **Catatan harian (daily notes)** — satu catatan per tanggal, plain text, sifat pribadi (tidak ikut export PDF):
  - Panel catatan di CalendarView pada tanggal terpilih + dot penanda di sel kalender
  - Sinkronisasi lintas device melalui tabel `daily_notes` (id deterministic `note-<tanggal>` agar tanpa duplikat, konflik diselesaikan LWW by `updated_at`)
  - Termasuk dalam backup/restore
  - i18n id/en
- `CHANGELOG.md` — riwayat perubahan semua versi

### Migration
- Jalankan `docs/supabase-0.8.sql` di Supabase Dashboard → SQL Editor (tabel `daily_notes` + index + RLS)

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