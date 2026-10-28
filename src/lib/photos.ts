import type { SupabaseClient } from "@supabase/supabase-js";
import { listEntries, updateEntry } from "./db";
import {
  conversionPlan,
  groupPhotos,
  isLocalPhoto,
  localPhotoBase64,
  localPhotoId,
  photoKey,
  photoStorageOf,
  type PhotoGroup,
  type PhotoStorage,
} from "./photoPaths";
import { isCleanupCandidate } from "./syncLogic";

export { isLocalPhoto, localPhotoBase64 as getLocalPhotoBase64 } from "./photoPaths";

export const PHOTO_BUCKET = "entry-files";
export const MAX_PHOTOS = 5;
export const MAX_DIMENSION = 1600;
export const NORMAL_QUALITY = 0.75;
export const AGGRESSIVE_QUALITY = 0.5;
export const BIG_FILE_BYTES = 10 * 1024 * 1024;

export interface PhotoOps {
  added: { file: File; storage: PhotoStorage }[];
  conversions: { key: string; to: PhotoStorage }[];
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

/** Upload foto ke Supabase Storage (mode supabase) */
export async function uploadPhoto(
  client: SupabaseClient,
  userId: string,
  file: File
): Promise<string> {
  return uploadBlob(client, userId, await compressImage(file));
}

async function uploadBlob(
  client: SupabaseClient,
  userId: string,
  blob: Blob,
  id: string = crypto.randomUUID()
): Promise<string> {
  const path = `${userId}/${id}.jpg`;
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

/** Simpan foto hanya di perangkat ini (tidak pernah disinkronkan). */
export async function savePhotoOnly(file: File): Promise<string> {
  return `local:only:${crypto.randomUUID()}:${await blobToBase64(await compressImage(file))}`;
}

/** Simpan foto di cloud sekaligus cache lokal (offline). */
export async function savePhotoBoth(
  client: SupabaseClient,
  userId: string,
  file: File
): Promise<string[]> {
  const id = crypto.randomUUID();
  const blob = await compressImage(file);
  const base64 = await blobToBase64(blob);
  const local = `local:both:${id}:${base64}`;
  try {
    return [await uploadBlob(client, userId, blob, id), local];
  } catch {
    // offline: simpan lokal dulu, sync berikutnya mengunggah ulang
    return [local];
  }
}

/** Upload foto lokal (base64) ke storage saat beralih ke mode Supabase. */
export async function uploadLocalPhoto(
  client: SupabaseClient,
  userId: string,
  path: string,
  id: string = crypto.randomUUID()
): Promise<string> {
  const base64 = localPhotoBase64(path);
  if (!base64) throw new Error("Foto lokal tidak valid");
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return uploadBlob(client, userId, new Blob([bytes], { type: "image/jpeg" }), id);
}

/** Dapatkan URL untuk tampilkan foto (lokal: data URL, cloud: URL storage) */
export function getPhotoUrl(settings: { mode: "supabase" | "local"; supabaseUrl: string }, path: string): string {
  if (isLocalPhoto(path)) {
    const base64 = localPhotoBase64(path);
    return base64 ? `data:image/jpeg;base64,${base64}` : "";
  }
  return settings.supabaseUrl ? photoUrl(settings.supabaseUrl, path) : "";
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

/** Daftar semua photo di folder milik user beserta waktu upload. */
export async function listPhotoPaths(
  client: SupabaseClient,
  userId: string
): Promise<{ path: string; createdAt: string }[]> {
  const { data, error } = await client.storage
    .from(PHOTO_BUCKET)
    .list(userId, { limit: 1000 });
  if (error) throw error;
  return (data ?? []).map((f) => ({
    path: `${userId}/${f.name}`,
    createdAt: f.created_at ?? "",
  }));
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
  let paths: { path: string; createdAt: string }[];
  try {
    paths = await listPhotoPaths(client, userId);
  } catch (e) {
    console.warn("gagal daftar foto storage:", e instanceof Error ? e.message : String(e));
    return;
  }
  const orphans = paths
    .filter((p) => !referenced.has(p.path) && isCleanupCandidate(p.createdAt))
    .map((p) => p.path);
  if (orphans.length > 0) {
    await deletePhotos(client, orphans);
  }
}

/** Salin foto cloud ke cache lokal (both) sebelum pindah ke mode lokal. */
export async function downloadCloudPhotosToLocal(
  userId: string,
  supabaseUrl: string
): Promise<void> {
  for (const entry of await listEntries(userId)) {
    const current = entry.photo_paths ?? [];
    const groups = groupPhotos(current);
    if (!groups.some((g) => g.cloud && !g.local)) continue;
    const next: string[] = [];
    for (const group of groups) {
      if (!group.cloud || group.local) {
        next.push(...group.paths);
        continue;
      }
      try {
        const id = photoKey(group.cloud);
        next.push(group.cloud, `local:both:${id}:${await downloadBase64(supabaseUrl, group.cloud)}`);
      } catch {
        next.push(group.cloud);
      }
    }
    if (next.length !== current.length || next.some((p, i) => p !== current[i])) {
      await updateEntry(entry.id, userId, { photo_paths: next });
    }
  }
}

/** Ubah penyimpanan satu foto: lokal, cloud, atau keduanya. */
export async function convertPhoto(
  client: SupabaseClient | null,
  userId: string,
  supabaseUrl: string,
  group: PhotoGroup,
  to: PhotoStorage
): Promise<string[]> {
  const plan = conversionPlan(photoStorageOf(group), to);
  if (!plan) return group.paths;

  const id =
    (group.local && localPhotoId(group.local)) ||
    (group.cloud && photoKey(group.cloud)) ||
    crypto.randomUUID();
  let cloud = group.cloud ?? null;
  let local = group.local ?? null;

  if (plan.upload) {
    if (!client) throw new Error("Supabase belum dikonfigurasi");
    if (!local) throw new Error("Foto lokal tidak ditemukan");
    cloud = await uploadLocalPhoto(client, userId, local, id);
  }
  if (plan.download) {
    if (!cloud) throw new Error("Foto cloud tidak ditemukan");
    local = `local:${to === "both" ? "both" : "only"}:${id}:${await downloadBase64(supabaseUrl, cloud)}`;
  }
  if (plan.dropLocal) local = null;
  if (plan.dropCloud) cloud = null;
  if (local) {
    const base64 = localPhotoBase64(local) ?? "";
    if (plan.result === "both") local = `local:both:${id}:${base64}`;
    if (plan.result === "local") local = `local:only:${id}:${base64}`;
  }
  return [cloud, local].filter((p): p is string => !!p);
}

async function downloadBase64(supabaseUrl: string, path: string): Promise<string> {
  const res = await fetch(photoUrl(supabaseUrl, path));
  if (!res.ok) throw new Error(String(res.status));
  return blobToBase64(await res.blob());
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
