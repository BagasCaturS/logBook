import type { AppSettings } from "./types";

const SALT_LENGTH = 16;
const HASH_ALGO = "SHA-256";
const ITERATIONS = 100000; // PBKDF2 iterations

function bufferToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBuffer(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    out[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return out;
}

function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
}

async function deriveKey(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  return crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: ITERATIONS,
      hash: HASH_ALGO,
    },
    keyMaterial,
    256
  );
}

/** Hash password → string "saltHex:hashHex" (PBKDF2-SHA256, 100k iterasi) */
export async function hashPassword(password: string): Promise<string> {
  const salt = generateSalt();
  const hashBuf = await deriveKey(password, salt);
  return `${bufferToHex(salt)}:${bufferToHex(hashBuf)}`;
}

/** Verifikasi password input terhadap stored "salt:hash" */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = hexToBuffer(saltHex);
  const hashBuf = await deriveKey(password, salt);
  const inputHashHex = bufferToHex(hashBuf);
  // constant-time comparison
  if (inputHashHex.length !== hashHex.length) return false;
  let diff = 0;
  for (let i = 0; i < inputHashHex.length; i++) {
    diff |= inputHashHex.charCodeAt(i) ^ hashHex.charCodeAt(i);
  }
  return diff === 0;
}

/** Buat session lokal dari settings (mode local) */
export function createLocalSession(settings: AppSettings): { userId: string; isLocal: true } | null {
  if (settings.mode !== "local") return null;
  if (!settings.localUserId || !settings.localPasswordHash) return null;
  return { userId: settings.localUserId, isLocal: true };
}

/** Generate UUID v4 untuk localUserId */
export function generateUserId(): string {
  return crypto.randomUUID();
}

/** Set localUserId dari Supabase UID saat switch ke local (jika ada) */
export function setLocalUserIdFromSupabase(settings: AppSettings, supabaseUserId: string): AppSettings {
  return {
    ...settings,
    mode: "local",
    localUserId: supabaseUserId,
    // password hash tidak di-set otomatis — user harus buat password baru
    localPasswordHash: undefined,
  };
}