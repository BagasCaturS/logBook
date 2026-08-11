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

export async function deletePhotos(
  client: SupabaseClient,
  paths: string[]
): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await client.storage.from(PHOTO_BUCKET).remove(paths);
  if (error) {
    // best-effort: gagal menghapus tidak memblokir alur utama
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
