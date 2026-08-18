export function parseTs(s: string | null | undefined): number {
  if (!s) return 0;
  const t = Date.parse(s);
  return isNaN(t) ? 0 : t;
}

/**
 * True ketika baris lokal benar-benar lebih baru dari baris remote.
 * Guard LWW di pull memakai `>` (bukan `>=`): baris dengan timestamp sama
 * dengan remote (hasil pull oleh versi klien lama yang belum mengenal kolom
 * fitur baru) tetap di-re-pull, sehingga kolom baru terisi setelah update.
 */
export function localNewerThan(
  localUpdatedAt: string | null,
  remoteUpdatedAt: string | null
): boolean {
  return parseTs(localUpdatedAt) > parseTs(remoteUpdatedAt);
}
