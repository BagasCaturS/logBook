import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";
import type { AppSettings } from "./types";

export interface SyncContext {
  client: SupabaseClient | null;
  session: Session | null;
}

let client: SupabaseClient | null = null;
let clientFor: { url: string; key: string } | null = null;

export function getClient(settings: AppSettings): SupabaseClient | null {
  if (!settings.supabaseUrl || !settings.supabaseAnonKey) return null;
  if (
    !client ||
    !clientFor ||
    clientFor.url !== settings.supabaseUrl ||
    clientFor.key !== settings.supabaseAnonKey
  ) {
    client = createClient(settings.supabaseUrl, settings.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
    clientFor = { url: settings.supabaseUrl, key: settings.supabaseAnonKey };
  }
  return client;
}

export async function getCurrentSession(settings: AppSettings): Promise<Session | null> {
  const c = getClient(settings);
  if (!c) return null;
  const { data } = await c.auth.getSession();
  return data.session;
}

export async function signIn(settings: AppSettings, email: string, password: string) {
  const c = getClient(settings);
  if (!c) throw new Error("Supabase belum dikonfigurasi");
  return c.auth.signInWithPassword({ email, password });
}

export async function signUp(settings: AppSettings, email: string, password: string) {
  const c = getClient(settings);
  if (!c) throw new Error("Supabase belum dikonfigurasi");
  return c.auth.signUp({ email, password });
}

/**
 * Cek apakah email sudah terdaftar di project (via RPC check_email_registered).
 * Mengembalikan true/false, atau null bila fungsi RPC tidak tersedia (mis.
 * project belum menjalankan supabase-setup.sql versi terbaru) — UI harus
 * bersikap netral (tanpa pesan) saat null.
 */
export async function checkEmailRegistered(settings: AppSettings, email: string): Promise<boolean | null> {
  const c = getClient(settings);
  if (!c) return null;
  const { data, error } = await c.rpc("check_email_registered", { p_email: email.trim() });
  if (error) return null;
  return typeof data === "boolean" ? data : null;
}

export async function signOut(settings: AppSettings) {
  const c = getClient(settings);
  if (!c) return;
  await c.auth.signOut();
}

export function onAuthChange(settings: AppSettings, cb: (session: Session | null) => void): () => void {
  const c = getClient(settings);
  if (!c) return () => {};
  const { data } = c.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}
