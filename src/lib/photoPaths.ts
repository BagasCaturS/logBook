export type PhotoStorage = "local" | "cloud" | "both";
export type LocalPhotoKind = "only" | "both" | "legacy";

const LOCAL_PREFIX = "local:";
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const NEW_RE = new RegExp(`^(only|both):(${UUID}):`, "i");
const LEGACY_RE = new RegExp(`^(${UUID}):`, "i");

export interface PhotoGroup {
  key: string;
  local?: string;
  cloud?: string;
  paths: string[];
}

export function isLocalPhoto(path: string): boolean {
  return path.startsWith(LOCAL_PREFIX);
}

export function localPhotoKind(path: string): LocalPhotoKind | null {
  if (!isLocalPhoto(path)) return null;
  const m = NEW_RE.exec(path.slice(LOCAL_PREFIX.length));
  return m ? (m[1].toLowerCase() as "only" | "both") : "legacy";
}

export function localPhotoId(path: string): string | null {
  if (!isLocalPhoto(path)) return null;
  const m = NEW_RE.exec(path.slice(LOCAL_PREFIX.length));
  return m ? m[2] : null;
}

export function localPhotoBase64(path: string): string | null {
  if (!isLocalPhoto(path)) return null;
  const rest = path.slice(LOCAL_PREFIX.length);
  const m = NEW_RE.exec(rest);
  if (m) return rest.slice(m[0].length);
  const legacy = LEGACY_RE.exec(rest);
  return legacy ? rest.slice(legacy[0].length) : rest;
}

export function photoKey(path: string): string {
  if (!isLocalPhoto(path)) {
    const name = path.split("/").pop() ?? path;
    return name.replace(/\.jpg$/i, "");
  }
  const rest = path.slice(LOCAL_PREFIX.length);
  const m = NEW_RE.exec(rest);
  if (m) return m[2];
  const legacy = LEGACY_RE.exec(rest);
  return legacy ? `legacy:${legacy[1]}` : `legacy:${rest}`;
}

export function groupPhotos(paths: string[]): PhotoGroup[] {
  const groups = new Map<string, PhotoGroup>();
  for (const path of paths) {
    const key = photoKey(path);
    let group = groups.get(key);
    if (!group) {
      group = { key, paths: [] };
      groups.set(key, group);
    }
    group.paths.push(path);
    if (isLocalPhoto(path)) {
      if (!group.local) group.local = path;
    } else if (!group.cloud) {
      group.cloud = path;
    }
  }
  return [...groups.values()];
}

export function photoStorageOf(group: PhotoGroup): PhotoStorage {
  if (group.local && group.cloud) return "both";
  return group.local ? "local" : "cloud";
}

/**
 * Remote rows never carry local paths, so keep the local copies we already
 * have. A `both` cache is dropped once its cloud sibling is gone remotely.
 */
export function mergeLocalPhotos(remote: string[], existing: string[]): string[] {
  const cloudKeys = new Set(remote.filter((p) => !isLocalPhoto(p)).map(photoKey));
  const kept = existing.filter((p) => {
    if (!isLocalPhoto(p)) return false;
    return localPhotoKind(p) !== "both" || cloudKeys.has(photoKey(p));
  });
  const seen = new Set(remote);
  return [...remote, ...kept.filter((p) => !seen.has(p))];
}

export interface ConversionPlan {
  upload: boolean;
  download: boolean;
  dropLocal: boolean;
  dropCloud: boolean;
  result: PhotoStorage;
}

export function conversionPlan(
  from: PhotoStorage,
  to: PhotoStorage
): ConversionPlan | null {
  if (from === to) return null;
  if (from === "local") {
    return {
      upload: true,
      download: false,
      dropLocal: to === "cloud",
      dropCloud: false,
      result: to,
    };
  }
  if (from === "cloud") {
    return {
      upload: false,
      download: true,
      dropLocal: false,
      dropCloud: to === "local",
      result: to,
    };
  }
  return {
    upload: false,
    download: false,
    dropLocal: to === "cloud",
    dropCloud: to === "local",
    result: to,
  };
}
