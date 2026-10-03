import type { SupabaseClient } from "@supabase/supabase-js";

export const PHOTO_BUCKET = "entry-files";
export const MAX_PHOTOS = 5;
export const MAX_DIMENSION = 1600;
export const NORMAL_QUALITY = 0.75;
export const AGGRESSIVE_QUALITY = 0.5;
export const BIG_FILE_BYTES = 10 * 1024 * 1024;

export interface PhotoOps {
  added: File[];
  removed: string[];
}

export function photoUrl(supabaseUrl: string, path: string): string {
  return `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${PHOTO_BUCKET}/${path}`;
}

export function isBigFile(file: File): boolean {
  return file.size > BIG_FILE_BYTES;
}

/**
 * Kompresi gambar via canvas: batas dimensi maksimum, output JPEG.
 * Kualitas normal 0.75; file >10MB dikompres agresif (0.5).
 */
export async function compressImage(
  file: File,
  opts: { maxDim?: number; quality?: number } = {}
): Promise<Blob> {
  const maxDim = opts.maxDim ?? MAX_DIMENSION;
  const quality = opts.quality ?? (isBigFile(file) ? AGGRESSIVE_QUALITY : NORMAL_QUALITY);

  const dataUrl = await readAsDataUrl(file);
  const img = await loadImage(dataUrl);
  let { width, height } = img;
  const scale = Math.min(1, maxDim / Math.max(width, height));
  if (scale < 1) {
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas tidak tersedia");
  ctx.drawImage(img, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality)
  );
  if (!blob) throw new Error("Gagal memproses gambar");
  return blob;
}

/** Konversi Blob ke base64 string (tanpa prefix data:) */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Gagal baca base64"));
    reader.readAsDataURL(blob);
  });
}

/** Upload foto ke Supabase Storage (mode supabase) */
export async function uploadPhoto(
  client: SupabaseClient,
  userId: string,
  file: File
): Promise<string> {
  const blob = await compressImage(file);
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await client.storage
    .from(PHOTO_BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw new Error(error.message || "Gagal mengunggah foto");
  return path;
}

/** Simpan foto ke SQLite sebagai base64 (mode lokal) */
export async function savePhotoLocal(file: File): Promise<string> {
  const blob = await compressImage(file);
  const base64 = await blobToBase64(blob);
  const localId = `local:${crypto.randomUUID()}`;
  return `${localId}:${base64}`;
}

/** Hapus foto lokal (base64 di SQLite) — tidak perlu aksi khusus, cukup hapus referensi */
export async function deletePhotosLocal(_paths: string[]): Promise<void> {
  // base64 disimpan di kolom photo_data, dihapus saat entri dihapus/diupdate
  // fungsi ini no-op untuk konsistensi API
  return;
}

/** Dapatkan URL untuk tampilkan foto (mode supabase: URL storage, mode lokal: data URL base64) */
export function getPhotoUrl(settings: { mode: "supabase" | "local"; supabaseUrl: string }, path: string): string {
  if (settings.mode === "local") {
    // path format: "local:<uuid>:<base64>"
    const prefix = "local:";
    if (path.startsWith(prefix)) {
      const base64 = path.slice(prefix.length);
      return `data:image/jpeg;base64,${base64}`;
    }
    // fallback untuk path lama
    return "";
  }
  // supabase mode
  return photoUrl(settings.supabaseUrl, path);
}

/** Ekstrak base64 dari path lokal */
export function getLocalPhotoBase64(path: string): string | null {
  const prefix = "local:";
  if (path.startsWith(prefix)) {
    return path.slice(prefix.length);
  }
  return null;
}

export async function deletePhotos(
  client: SupabaseClient,
  paths: string[]
): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await client.storage.from(PHOTO_BUCKET).remove(paths);
  if (error) {
    console.warn("gagal hapus foto storage:", error.message);
  }
}

/** Daftar semua path foto di folder milik user (folder pertama = user_id). */
export async function listPhotoPaths(
  client: SupabaseClient,
  userId: string
): Promise<string[]> {
  const { data, error } = await client.storage
    .from(PHOTO_BUCKET)
    .list(userId, { limit: 1000 });
  if (error) throw error;
  return (data ?? []).map((f) => `${userId}/${f.name}`);
}

/**
 * Hapus semua foto di bucket yang tidak dirujuk entri manapun.
 * Menjamin file yatim (upload gagal lanjut, entri terhapus saat offline,
 * entri terhapus di perangkat lain) ikut terhapus.
 */
export async function cleanupOrphanPhotos(
  client: SupabaseClient,
  userId: string,
  referenced: Set<string>
): Promise<void> {
  let paths: string[];
  try {
    paths = await listPhotoPaths(client, userId);
  } catch (e) {
    console.warn("gagal daftar foto storage:", e instanceof Error ? e.message : String(e));
    return;
  }
  const orphans = paths.filter((p) => !referenced.has(p));
  if (orphans.length > 0) {
    await deletePhotos(client, orphans);
  }
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Gagal membaca file"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Gambar tidak dapat dibaca"));
    img.src = src;
  });
}