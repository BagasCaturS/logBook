export type Lang = "id" | "en";

export const LANGS: { id: Lang; name: string }[] = [
  { id: "id", name: "Bahasa Indonesia" },
  { id: "en", name: "English" },
];

export function isValidLang(v: unknown): v is Lang {
  return v === "id" || v === "en";
}

type Vars = Record<string, string | number>;

const dict: Record<string, { id: string; en: string }> = {
  // app / header
  "app.title": { id: "Online Logbook", en: "Online Logbook" },
  "app.tagline": { id: "Jurnal kegiatan magang", en: "Internship activity journal" },
  "app.loading": { id: "Memuat...", en: "Loading..." },
  "app.footer": {
    id: "Online Logbook v{version} · Dibuat oleh Sapporo",
    en: "Online Logbook v{version} · Made by Sapporo",
  },
  "sync.syncing": { id: "menyinkronkan...", en: "syncing..." },
  "sync.online": { id: "tersinkron {time}", en: "synced {time}" },
  "sync.error": { id: "sinkron gagal (offline?)", en: "sync failed (offline?)" },
  "sync.offline": { id: "offline", en: "offline" },
  "sync.now": { id: "Sinkron Sekarang", en: "Sync Now" },
  "settings.button": { id: "Pengaturan", en: "Settings" },

  // update
  "update.available": { id: "Update v{version} tersedia", en: "Update v{version} available" },
  "update.readyText": {
    id: "Update terpasang — buka ulang aplikasi untuk memakai v{version}.",
    en: "Update installed — restart the app to use v{version}.",
  },
  "update.availableText": {
    id: "Unduh dan pasang versi terbaru dari tombol di samping.",
    en: "Download and install the latest version from the button beside.",
  },
  "update.install": { id: "Pasang Sekarang", en: "Install Now" },
  "update.installed": { id: "Terpasang", en: "Installed" },

  // form
  "form.addTitle": { id: "Tambah Kegiatan", en: "Add Activity" },
  "form.editTitle": { id: "Edit Kegiatan", en: "Edit Activity" },
  "form.kegiatan": { id: "Kegiatan", en: "Activity" },
  "form.kegiatanPlaceholder": {
    id: "Contoh: Belajar Laravel, ikut standup meeting, dll.",
    en: "E.g. Learning Laravel, attending standup meeting, etc.",
  },
  "form.tanggal": { id: "Tanggal", en: "Date" },
  "form.minggu": { id: "Minggu ke-?", en: "Week #" },
  "form.auto": { id: "Auto: Minggu {minggu} · Hari ke-{hari}", en: "Auto: Week {minggu} · Day {hari}" },
  "form.beforeStart": {
    id: "Tanggal ini sebelum tanggal mulai magang — isi minggu manual.",
    en: "This date is before the internship start date — fill the week manually.",
  },
  "form.noStartDate": {
    id: "Atur tanggal mulai magang di Pengaturan untuk auto-hitung minggu.",
    en: "Set the internship start date in Settings to auto-calculate the week.",
  },
  "form.errKegiatan": { id: "Kegiatan tidak boleh kosong.", en: "Activity cannot be empty." },
  "form.errTanggal": { id: "Pilih tanggal.", en: "Pick a date." },
  "form.errMinggu": { id: "Minggu ke-? harus angka ≥ 1.", en: "Week # must be a number ≥ 1." },
  "form.saving": { id: "Menyimpan...", en: "Saving..." },
  "form.saveChanges": { id: "Simpan Perubahan", en: "Save Changes" },
  "form.add": { id: "Tambah", en: "Add" },
  "form.cancel": { id: "Batal", en: "Cancel" },
  "form.saved": { id: "Tersimpan", en: "Saved" },
  "form.kategori": { id: "Kategori", en: "Categories" },
  "form.newCategory": { id: "+ Kategori baru", en: "+ New category" },
  "form.categoryPlaceholder": { id: "Nama kategori (mis. Belajar, Meeting)", en: "Category name (e.g. Learning, Meeting)" },
  "form.errCategory": { id: "Nama kategori tidak boleh kosong.", en: "Category name cannot be empty." },

  // rich text editor
  "editor.bold": { id: "Tebal", en: "Bold" },
  "editor.italic": { id: "Miring", en: "Italic" },
  "editor.underline": { id: "Garis bawah", en: "Underline" },
  "editor.strike": { id: "Coret", en: "Strikethrough" },
  "editor.link": { id: "Tautan", en: "Link" },
  "editor.linkText": { id: "Teks tautan", en: "Link text" },
  "editor.linkUrl": { id: "URL tautan", en: "Link URL" },
  "editor.linkApply": { id: "Terapkan", en: "Apply" },
  "editor.linkRemove": { id: "Hapus Tautan", en: "Remove Link" },
  "editor.linkInvalid": { id: "URL tidak valid.", en: "Invalid URL." },
  "editor.linkTextEmpty": {
    id: "Teks tautan tidak boleh kosong.",
    en: "Link text cannot be empty.",
  },

  // list
  "list.search": { id: "Cari kegiatan...", en: "Search activities..." },
  "list.filterMinggu": { id: "Minggu ke-?", en: "Week #" },
  "list.allCategories": { id: "Semua kategori", en: "All categories" },
  "list.noCategories": {
    id: "Belum ada kategori. Buat lewat form di atas.",
    en: "No categories yet. Create one from the form above.",
  },
  "list.empty": {
    id: "Belum ada catatan. Tambahkan kegiatan pertamamu di atas!",
    en: "No entries yet. Add your first activity above!",
  },
  "list.edit": { id: "Edit", en: "Edit" },
  "list.delete": { id: "Hapus", en: "Delete" },
  "list.mingguBadge": { id: "Minggu {minggu}", en: "Week {minggu}" },
  "list.hariBadge": { id: "Hari ke-{hari}", en: "Day {hari}" },
  "list.showing": {
    id: "Menampilkan {visible} dari {total} catatan",
    en: "Showing {visible} of {total} entries",
  },
  "list.showMore": {
    id: "Tampilkan lebih banyak (+{n})",
    en: "Show more (+{n})",
  },
  "list.showAll": { id: "Tampilkan semua ({total})", en: "Show all ({total})" },

  // calendar
  "cal.title": { id: "Kalender Kegiatan", en: "Activity Calendar" },
  "cal.today": { id: "Hari ini", en: "Today" },
  "cal.prev": { id: "Bulan sebelumnya", en: "Previous month" },
  "cal.next": { id: "Bulan berikutnya", en: "Next month" },
  "cal.emptyDay": { id: "Tidak ada kegiatan pada tanggal ini.", en: "No activities on this date." },
  "cal.addActivity": { id: "Tambah Kegiatan", en: "Add Activity" },
  "cal.meta": { id: "Minggu ke-{minggu} · Hari ke-{hari}", en: "Week {minggu} · Day {hari}" },
  "cal.dayAria": { id: "{tanggal}, {count} kegiatan", en: "{tanggal}, {count} activities" },

  // settings
  "settings.title": { id: "Pengaturan", en: "Settings" },
  "settings.theme": { id: "Tema aplikasi", en: "App theme" },
  "settings.lang": { id: "Bahasa", en: "Language" },
  "settings.startDate": {
    id: "Tanggal mulai magang (untuk auto-hitung minggu)",
    en: "Internship start date (for auto week calculation)",
  },
  "settings.startDateHint": {
    id: "Entri baru akan otomatis dihitung minggu ke-? dan hari ke-N dari tanggal ini.",
    en: "New entries will automatically get their week # and day N from this date.",
  },
  "settings.save": { id: "Simpan", en: "Save" },
  "settings.back": { id: "Kembali", en: "Back" },
  "settings.account": { id: "Akun", en: "Account" },
  "settings.syncStatus": { id: "Status sinkron", en: "Sync status" },
  "settings.lastSync": { id: "terakhir {time}", en: "last {time}" },
  "settings.logout": { id: "Logout", en: "Logout" },
  "settings.update": { id: "Pembaruan", en: "Updates" },
  "settings.version": { id: "Versi terpasang", en: "Installed version" },
  "settings.versionAvailable": { id: "Versi tersedia:", en: "Available version:" },
  "settings.newRelease": { id: "Rilis baru tersedia.", en: "A new release is available." },
  "settings.checking": { id: "Memeriksa update...", en: "Checking for updates..." },
  "settings.upToDate": { id: "Sudah versi terbaru", en: "You're up to date" },
  "settings.downloading": { id: "Mengunduh update... {pct}%", en: "Downloading update... {pct}%" },
  "settings.downloadingIndet": { id: "Mengunduh update...", en: "Downloading update..." },
  "settings.ready": {
    id: "Update terpasang — buka ulang aplikasi untuk memakai versi terbaru.",
    en: "Update installed — restart the app to use the latest version.",
  },
  "settings.updateError": { id: "Gagal memasang update: {error}", en: "Failed to install update: {error}" },
  "settings.checkUpdate": { id: "Periksa Update", en: "Check for Updates" },
  "settings.downloadInstall": { id: "Unduh & Pasang", en: "Download & Install" },
  "settings.about": { id: "Tentang", en: "About" },
  "settings.madeBy": { id: "Dibuat oleh", en: "Made by" },
  "settings.aboutLine": {
    id: "Dibuat oleh Sapporo · © 2026 — Online Logbook v{version}",
    en: "Made by Sapporo · © 2026 — Online Logbook v{version}",
  },
  "settings.categoriesTitle": { id: "Kategori", en: "Categories" },
  "settings.categoriesHint": {
    id: "Kategori dipakai di form entri (bisa lebih dari satu per entri). Menghapus kategori akan melepasnya dari semua entri.",
    en: "Categories are used in the entry form (multiple per entry allowed). Deleting a category removes it from all entries.",
  },
  "settings.noCategories": { id: "Belum ada kategori.", en: "No categories yet." },
  "settings.deleteCategoryConfirm": {
    id: "Hapus kategori ini dari semua entri?",
    en: "Remove this category from all entries?",
  },

  // export PDF
  "export.title": { id: "Ekspor PDF", en: "Export PDF" },
  "export.hint": {
    id: "Simpan laporan kegiatan sebagai PDF.",
    en: "Save your activity report as a PDF.",
  },
  "export.rangeLabel": { id: "Rentang", en: "Range" },
  "export.rangeAll": { id: "Semua entri", en: "All entries" },
  "export.rangeWeekOption": { id: "Minggu ke-{minggu}", en: "Week {minggu}" },
  "export.button": { id: "Ekspor PDF", en: "Export PDF" },
  "export.exporting": { id: "Membuat PDF...", en: "Generating PDF..." },
  "export.done": { id: "PDF tersimpan.", en: "PDF saved." },
  "export.error": { id: "Gagal mengekspor PDF: {error}", en: "Failed to export PDF: {error}" },
  "export.empty": { id: "Tidak ada entri pada rentang ini.", en: "No entries in this range." },
  "pdf.title": { id: "Laporan Kegiatan Magang", en: "Internship Activity Report" },
  "pdf.rangeAll": { id: "Semua entri", en: "All entries" },
  "pdf.rangeWeek": { id: "Minggu ke-{minggu}", en: "Week {minggu}" },
  "pdf.exportedAt": { id: "Dibuat", en: "Exported" },
  "pdf.count": { id: "{n} entri", en: "{n} entries" },
  "pdf.colTanggal": { id: "Tanggal", en: "Date" },
  "pdf.colMinggu": { id: "Minggu", en: "Week" },
  "pdf.colHari": { id: "Hari ke-", en: "Day" },
  "pdf.colKegiatan": { id: "Kegiatan", en: "Activity" },
  "pdf.colKategori": { id: "Kategori", en: "Categories" },

  // backup
  "backup.title": { id: "Cadangan (Backup)", en: "Backup" },
  "backup.hint": {
    id: "Simpan seluruh data ke file JSON, atau pulihkan dari cadangan. Pemulihan menggabungkan data (versi terbaru menang).",
    en: "Save all data to a JSON file, or restore from a backup. Restoring merges data (newest version wins).",
  },
  "backup.save": { id: "Simpan Cadangan", en: "Save Backup" },
  "backup.restore": { id: "Pulihkan dari File", en: "Restore from File" },
  "backup.saved": { id: "Cadangan tersimpan.", en: "Backup saved." },
  "backup.saving": { id: "Menyimpan...", en: "Saving..." },
  "backup.restoring": { id: "Memulihkan...", en: "Restoring..." },
  "backup.restored": {
    id: "Cadangan dipulihkan: {entries} entri, {categories} kategori.",
    en: "Backup restored: {entries} entries, {categories} categories.",
  },
  "backup.error": { id: "Gagal: {error}", en: "Failed: {error}" },
  "backup.invalid": {
    id: "File bukan cadangan Online Logbook yang valid.",
    en: "File is not a valid Online Logbook backup.",
  },
  "backup.confirmTitle": { id: "Pulihkan cadangan?", en: "Restore backup?" },
  "backup.confirm": { id: "Pulihkan", en: "Restore" },
  "backup.confirmText": {
    id: "Data lokal akan digabung dengan isi cadangan (versi yang lebih baru menang). Lanjutkan?",
    en: "Local data will be merged with the backup content (newest version wins). Continue?",
  },

  // photos
  "photo.label": { id: "Foto (maks {n})", en: "Photos (max {n})" },
  "photo.add": { id: "Pilih Foto", en: "Choose Photos" },
  "photo.uploading": { id: "Mengunggah foto...", en: "Uploading photos..." },
  "photo.bigFile": { id: "File besar dikompres otomatis.", en: "Large files are compressed automatically." },
  "photo.maxReached": { id: "Maksimal {n} foto per entri.", en: "Maximum {n} photos per entry." },
  "photo.uploadError": { id: "Gagal mengunggah foto: {error}", en: "Failed to upload photo: {error}" },
  "photo.remove": { id: "Hapus", en: "Remove" },
  "photo.close": { id: "Tutup", en: "Close" },

  // login
  "login.title": { id: "Login", en: "Login" },
  "login.signupTitle": { id: "Daftar Akun", en: "Sign Up" },
  "login.email": { id: "Email", en: "Email" },
  "login.password": { id: "Password", en: "Password" },
  "login.errEmpty": { id: "Isi email dan password dulu.", en: "Fill in email and password first." },
  "login.errInvalid": { id: "Email atau password salah.", en: "Invalid email or password." },
  "login.infoSignup": {
    id: "Akun dibuat! Cek email kamu untuk konfirmasi, lalu login.",
    en: "Account created! Check your email to confirm, then log in.",
  },
  "login.processing": { id: "Memproses...", en: "Processing..." },
  "login.signup": { id: "Daftar", en: "Sign Up" },
  "login.switchSignup": { id: "Belum punya akun? Daftar", en: "Don't have an account? Sign up" },
  "login.switchLogin": { id: "Sudah punya akun? Login", en: "Already have an account? Log in" },
  "login.credit": { id: "Dibuat oleh Sapporo", en: "Made by Sapporo" },

  // setup
  "setup.title": { id: "Konfigurasi Supabase", en: "Supabase Configuration" },
  "setup.desc": {
    id: "Isi Project URL dan anon/public key dari project Supabase kamu (Dashboard → Project Settings → API).",
    en: "Fill in the Project URL and anon/public key from your Supabase project (Dashboard → Project Settings → API).",
  },
  "setup.projectUrl": { id: "Project URL", en: "Project URL" },
  "setup.anonKey": { id: "Anon Key", en: "Anon Key" },
  "setup.save": { id: "Simpan & Lanjutkan", en: "Save & Continue" },

  // dialog
  "dialog.deleteEntry": { id: "Hapus catatan ini?", en: "Delete this entry?" },
  "dialog.delete": { id: "Hapus", en: "Delete" },
  "dialog.cancel": { id: "Batal", en: "Cancel" },
};

export function t(lang: Lang, key: string, vars?: Vars): string {
  const entry = dict[key];
  const template = entry ? entry[lang] : key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}
