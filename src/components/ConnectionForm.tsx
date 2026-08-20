import { useState } from "react";
import { t, type Lang } from "../lib/i18n";

interface Props {
  initialUrl: string;
  initialKey: string;
  lang: Lang;
  onSave: (url: string, key: string) => void;
}

type TestState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "ok" }
  | { status: "fail"; message: string };

const TEST_TIMEOUT_MS = 10_000;

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), TEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    window.clearTimeout(t);
  }
}

export default function ConnectionForm({ initialUrl, initialKey, lang, onSave }: Props) {
  const [url, setUrl] = useState(initialUrl);
  const [key, setKey] = useState(initialKey);
  const [test, setTest] = useState<TestState>({ status: "idle" });

  async function handleTest() {
    const u = url.replace(/\/+$/, "");
    const k = key.trim();
    if (!u || !k) return;
    setTest({ status: "testing" });

    // Validasi format cepat (tanpa network) untuk menangkal salah salin.
    if (!/^https:\/\//.test(u)) {
      setTest({ status: "fail", message: t(lang, "setup.urlScheme") });
      return;
    }
    if (!k.startsWith("sb_publishable_") && !k.startsWith("eyJ")) {
      setTest({ status: "fail", message: t(lang, "setup.keyFormat") });
      return;
    }

    // Langkah A: query REST nyata (identik dengan request aplikasi) —
    // memvalidasi anon key sekaligus memastikan project sudah di-setup.
    // PostgREST selalu mengirim header CORS, jadi andal dari webview.
    let restRes: Response | null = null;
    let restError: unknown = null;
    try {
      restRes = await fetchWithTimeout(`${u}/rest/v1/logbook_entries?select=id&limit=1`, {
        method: "GET",
        headers: { apikey: k, Authorization: `Bearer ${k}` },
      });
    } catch (e) {
      restError = e;
    }

    if (restRes) {
      if (restRes.ok) {
        // Project yang dipause mengembalikan halaman HTML — pastikan ini JSON PostgREST.
        const ct = restRes.headers.get("content-type") ?? "";
        if (ct.includes("application/json")) {
          setTest({ status: "ok" });
        } else {
          setTest({ status: "fail", message: t(lang, "setup.healthFail") });
        }
      } else if (restRes.status === 401 || restRes.status === 403) {
        setTest({ status: "fail", message: t(lang, "setup.testUnauthorized") });
      } else if (restRes.status === 404) {
        setTest({ status: "fail", message: t(lang, "setup.tableMissing") });
      } else if (restRes.status >= 500) {
        setTest({
          status: "fail",
          message: t(lang, "setup.testServerError", { code: String(restRes.status) }),
        });
      } else {
        setTest({
          status: "fail",
          message: t(lang, "setup.testBadResponse", { code: String(restRes.status) }),
        });
      }
      return;
    }

    // Tidak ada respons REST (network error/timeout). Cek health endpoint untuk
    // diagnosis: health juga gagal = project tidak dapat dijangkau/inaktif;
    // health hidup tapi REST gagal = masalah jaringan/proxy.
    if (restError instanceof DOMException && restError.name === "AbortError") {
      setTest({ status: "fail", message: t(lang, "setup.testTimeout") });
      return;
    }
    let healthOk = false;
    try {
      const res = await fetchWithTimeout(`${u}/auth/v1/health`, { method: "GET" });
      healthOk = res.ok;
    } catch {
      healthOk = false;
    }
    setTest({
      status: "fail",
      message: healthOk ? t(lang, "setup.testUnreachable") : t(lang, "setup.healthFail"),
    });
  }

  return (
    <>
      <label>
        {t(lang, "setup.projectUrl")}
        <input value={url} onChange={(e) => setUrl(e.target.value.trim())} placeholder="https://xxxx.supabase.co" />
      </label>
      <label>
        {t(lang, "setup.anonKey")}
        <input value={key} onChange={(e) => setKey(e.target.value.trim())} placeholder="sb_publishable_..." />
      </label>
      <div className="row actions">
        <button className="secondary" disabled={!url || !key || test.status === "testing"} onClick={() => void handleTest()}>
          {test.status === "testing" ? t(lang, "setup.testing") : t(lang, "setup.test")}
        </button>
        <button disabled={!url || !key} onClick={() => onSave(url, key)}>
          {t(lang, "setup.save")}
        </button>
      </div>
      {test.status === "ok" && (
        <p className="info" role="status">
          {t(lang, "setup.testOk")}
        </p>
      )}
      {test.status === "fail" && (
        <p className="error" role="alert">
          {test.message}
        </p>
      )}
    </>
  );
}