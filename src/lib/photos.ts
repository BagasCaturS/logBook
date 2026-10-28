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

const LOCAL_PREFIX = "local:";
const LEGACY_LOCAL_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}:/i;

export function isLocalPhoto(path: string): boolean {
  return path.startsWith(LOCAL_PREFIX);
}

/** Upload foto ke Supabase Storage (mode supabase) */
export async function uploadPhoto(
  client: SupabaseClient,
  userId: string,
  file: File
): Promise<string> {
  return uploadBlob(client, userId, await compressImage(file));
}

async function uploadBlob(client: SupabaseClient, userId: string, blob: Blob): Promise<string> {
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await client.storage
    .from(PHOTO_BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw new Error(error.message || "Gagal mengunggah foto");
  return path;
}

/** Simpan foto ke SQLite sebagai base64 (mode lokal) */
export async function savePhotoLocal(file: File): Promise<string> {
  return `${LOCAL_PREFIX}${await blobToBase64(await compressImage(file))}`;
}

/** Upload foto lokal (base64) ke storage saat beralih ke mode Supabase. */
export async function uploadLocalPhoto(
  client: SupabaseClient,
  userId: string,
  path: string
): Promise<string> {
  const base64 = getLocalPhotoBase64(path);
  if (!base64) throw new Error("Foto lokal tidak valid");
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return uploadBlob(client, userId, new Blob([bytes], { type: "image/jpeg" }));
}

/** Dapatkan URL untuk tampilkan foto (lokal: data URL, cloud: URL storage) */
export function getPhotoUrl(settings: { mode: "supabase" | "local"; supabaseUrl: string }, path: string): string {
  if (isLocalPhoto(path)) {
    const base64 = getLocalPhotoBase64(path);
    return base64 ? `data:image/jpeg;base64,${base64}` : "";
  }
  return settings.supabaseUrl ? photoUrl(settings.supabaseUrl, path) : "";
}

/** Ekstrak base64 dari path lokal (mendukung format lama local:<uuid>:<base64>) */
export function getLocalPhotoBase64(path: string): string | null {
  if (!isLocalPhoto(path)) return null;
  const rest = path.slice(LOCAL_PREFIX.length);
  const legacy = LEGACY_LOCAL_RE.exec(rest);
  return legacy ? rest.slice(legacy[0].length) : rest;
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