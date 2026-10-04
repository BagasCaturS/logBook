# Online Logbook

> **Bahasa Indonesia** — versi bahasa Inggris di bawah. / **English version below.**

Aplikasi logbook harian (tugas praktik / kegiatan harian) berbasis **Tauri + React + TypeScript**. Desktop-first, dengan sinkronisasi cloud via **Supabase** (auth email, database, dan penyimpanan foto). Mendukung dua bahasa (Indonesia/Inggris), tema warna, ekspor PDF, dan backup.

## Fitur

- **Entri harian** — kegiatan, minggu, hari ke-, jam mulai, kategori, dan foto (dikompresi otomatis saat upload).
- **Kategori** — atur warna dan nama kategori; filter entri per kategori.
- **Catatan harian** — satu catatan per tanggal, privat per akun (tidak ikut ekspor PDF).
- **Kalender** — ringkasan bulanan dengan penanda hari yang punya catatan.
- **Sinkronisasi lintas perangkat** — pengaturan (tanggal mulai, jam mulai, label jam, tema, bahasa), entri, kategori, dan catatan; konflik diselesaikan last-write-wins. Soft delete menyebar dua arah.
- **Undo hapus entri** — toast 10 detik untuk membatalkan penghapusan.
- **Backup & restore** — ekspor JSON seluruh data lokal, impor kembali.
- **Ekspor PDF** — rekap per periode dengan header (nama, jurusan, instansi).
- **Gelap/terang otomatis** dan 4 tema warna; UI dalam bahasa Indonesia dan Inggris.
- **Mode Lokal Saja (Offline)** — jalankan penuh tanpa Supabase:
  - Autentikasi password lokal (PBKDF2-SHA256, 100k iterasi via Web Crypto)
  - Data 100% di SQLite lokal (termasuk foto sebagai Base64)
  - Tanpa internet, tanpa project Supabase
  - Switch mode di Settings: Supabase ↔ Lokal Saja
- **Halaman Login Modern** — UI redesign:
  - Toggle mode Supabase ↔ Lokal di halaman login
  - Show/hide password
  - Validasi email inline (checking/available/taken)
  - Hint kekuatan password (min 6 karakter)
  - Animasi halus, loading spinner, focus states
  - Aksesibilitas: ARIA labels, keyboard navigation
- **Manajemen Password Lokal** — ubah password lokal, status password di Settings

## Teknologi

- [Tauri](https://tauri.app/) v2 + Rust (backend)
- React 19 + TypeScript + Vite
- SQLite lokal (via `@tauri-apps/plugin-sql`)
- [Supabase](https://supabase.com/) — auth, Postgres, Storage (foto), sync
- `jspdf` untuk ekspor PDF, `lucide-react` untuk ikon

## Pengembangan

Prasyarat: Node.js, Rust, dan toolchain Tauri ([dokumentasi](https://tauri.app/start/prerequisites/)).

```bash
npm install
npm run dev        # mode pengembangan (Vite)
npm run tauri dev  # jalankan aplikasi desktop
npm run build      # build frontend
npm test           # unit test (Vitest)
npm run tauri build
```

> Catatan: aplikasi bersifat *bring-your-own-Supabase* — setiap pengguna memakai proyek Supabase miliknya sendiri (Project URL + anon key diisi lewat menu Pengaturan saat pertama kali menjalankan aplikasi; tersimpan lokal per perangkat).

### Skema database (Supabase)

Jalankan **satu file** di **Supabase Dashboard → SQL Editor** (idempotent, aman dijalankan ulang):

- `docs/supabase-setup.sql` — semua tabel (`logbook_entries`, `categories`, `daily_notes`, `app_settings`), bucket storage foto, dan RLS

Setelah menjalankan DDL baru, muat ulang schema cache: `NOTIFY pgrst, 'reload schema';`

### Memakai proyek Supabase sendiri (BYO-Supabase)

1. Buat project di [supabase.com](https://supabase.com) (bisa pakai paket gratis).
2. Jalankan `docs/supabase-setup.sql` di **SQL Editor** project tersebut.
3. Aktifkan **Email Auth** (Authentication → Providers → Email) dan nonaktifkan *Confirm email* bila ingin langsung masuk.
4. Salin **Project URL** dan **anon/public key** (Project Settings → API).
5. Jalankan aplikasi → isi kredensial di layar konfigurasi → klik **Uji Koneksi** → **Simpan & Lanjutkan**.

Kredensial tidak disinkronkan antar perangkat dan tersimpan hanya di perangkat masing-masing. Untuk berpindah ke proyek lain: **Pengaturan → Akun → Ubah Koneksi** (data lokal lama tetap tersimpan di perangkat).

## Rilis

Tag `v*` memicu GitHub Actions (`.github/workflows/release.yml`) untuk membangun installer Windows. Lihat riwayat fitur di `CHANGELOG.md`.

## Disclaimer

Program ini dikembangkan dengan bantuan **AI (kecerdasan buatan)** sebagai asisten pemrograman — sebagian besar kode ditulis, direview, dan diperbaiki dengan bantuan model AI (mis. OpenCode/Claude), di bawah arahan dan verifikasi pengembang manusia. Gunakan dengan bijak; laporkan bug atau perilaku yang tidak diinginkan melalui issue repository.

## Lisensi

Privasi & penggunaan pribadi. Data tetap milik pengguna; penyimpanan cloud (Supabase) diatur oleh pengguna sendiri.

---

# Online Logbook (English)

A daily logbook app (internship / daily activities) built with **Tauri + React + TypeScript**. Desktop-first, with cloud sync via **Supabase** (email auth, database, and photo storage). Supports two languages (Indonesian/English), color themes, PDF export, and backup.

## Features

- **Daily entries** — activity, week, day number, start hour, categories, and photos (auto-compressed on upload).
- **Categories** — custom names and colors; filter entries by category.
- **Daily notes** — one private note per date, scoped to your account (not included in PDF export).
- **Calendar** — monthly overview with markers on days that have notes.
- **Cross-device sync** — settings (start date, start hour, hour label, theme, language), entries, categories, and notes; conflicts resolved last-write-wins. Soft deletes propagate both ways.
- **Undo entry deletion** — 10-second toast to cancel a deletion.
- **Backup & restore** — export all local data as JSON, import it back.
- **PDF export** — period recap with header (name, major, institution).
- **Auto light/dark mode** and 4 color themes; UI in Indonesian and English.
- **Local-Only Mode (Offline)** — run fully without Supabase:
  - Local password auth (PBKDF2-SHA256, 100k iterations via Web Crypto)
  - 100% local SQLite storage (including photos as Base64)
  - No internet, no Supabase project required
  - Switch modes in Settings: Supabase ↔ Local Only
- **Modern Login Page** — redesigned UI:
  - Supabase ↔ Local toggle on login screen
  - Show/hide password
  - Inline email validation (checking/available/taken)
  - Password strength hint (min 6 chars)
  - Smooth animations, loading spinner, focus states
  - Accessibility: ARIA labels, keyboard navigation
- **Local Password Management** — change local password, view password status in Settings

## Tech Stack

- [Tauri](https://tauri.app/) v2 + Rust (backend)
- React 19 + TypeScript + Vite
- Local SQLite (via `@tauri-apps/plugin-sql`)
- [Supabase](https://supabase.com/) — auth, Postgres, Storage (photos), sync
- `jspdf` for PDF export, `lucide-react` for icons

## Development

Prerequisites: Node.js, Rust, and the Tauri toolchain ([docs](https://tauri.app/start/prerequisites/)).

```bash
npm install
npm run dev        # dev mode (Vite)
npm run tauri dev  # run the desktop app
npm run build      # build frontend
npm test           # unit tests (Vitest)
npm run tauri build
```

> Note: the app is *bring-your-own-Supabase* — every user runs their own Supabase project (Project URL + anon key entered via Settings on first launch; stored locally per device).

### Supabase database schema

Run **one file** in **Supabase Dashboard → SQL Editor** (idempotent, safe to re-run):

- `docs/supabase-setup.sql` — all tables (`logbook_entries`, `categories`, `daily_notes`, `app_settings`), the photo storage bucket, and RLS

After running new DDL, reload the schema cache: `NOTIFY pgrst, 'reload schema';`

### Use your own Supabase project (BYO-Supabase)

1. Create a project at [supabase.com](https://supabase.com) (free tier works).
2. Run `docs/supabase-setup.sql` in that project's **SQL Editor**.
3. Enable **Email Auth** (Authentication → Providers → Email) and disable *Confirm email* if you want to sign in immediately.
4. Copy the **Project URL** and **anon/public key** (Project Settings → API).
5. Launch the app → enter the credentials on the configuration screen → click **Test Connection** → **Save & Continue**.

Credentials are not synced across devices and are stored only on each device. To switch to another project: **Settings → Account → Change Connection** (old local data stays on the device).

## Releases

A `v*` tag triggers GitHub Actions (`.github/workflows/release.yml`) to build the Windows installer. See feature history in `CHANGELOG.md`.

## Disclaimer

This program was developed with the help of **AI (artificial intelligence)** as a programming assistant — most of the code was written, reviewed, and fixed with the assistance of AI models (e.g. OpenCode/Claude), under the direction and verification of a human developer. Use responsibly; report bugs or unexpected behavior through the repository's issues.

## License

Personal & private use. Data belongs to the user; cloud storage (Supabase) is managed by the user.