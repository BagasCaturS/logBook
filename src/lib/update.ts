import { check as updaterCheck } from "@tauri-apps/plugin-updater";

export interface UpdateInfo {
  version: string;
  body: string;
}

export interface DownloadProgress {
  downloaded: number;
  total: number | null;
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  try {
    const update = await updaterCheck();
    if (!update) return null;
    return { version: update.version, body: update.body ?? "" };
  } catch {
    return null;
  }
}

export async function downloadAndInstall(
  onProgress: (p: DownloadProgress) => void
): Promise<void> {
  const update = await updaterCheck();
  if (!update) throw new Error("Tidak ada update tersedia.");
  let downloaded = 0;
  let total: number | null = null;
  await update.downloadAndInstall((event) => {
    if (event.event === "Started") {
      total = event.data.contentLength ?? null;
    } else if (event.event === "Progress") {
      downloaded += event.data.chunkLength;
      onProgress({ downloaded, total });
    }
  });
}