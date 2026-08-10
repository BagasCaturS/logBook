import { useState } from "react";

interface Props {
  initialUrl: string;
  initialKey: string;
  onSave: (url: string, key: string) => void;
}

export default function Setup({ initialUrl, initialKey, onSave }: Props) {
  const [url, setUrl] = useState(initialUrl);
  const [key, setKey] = useState(initialKey);

  return (
    <div className="setup">
      <h2>Konfigurasi Supabase</h2>
      <p>
        Isi Project URL dan anon/public key dari project Supabase kamu (Dashboard →
        Project Settings → API).
      </p>
      <label>
        Project URL
        <input value={url} onChange={(e) => setUrl(e.target.value.trim())} placeholder="https://xxxx.supabase.co" />
      </label>
      <label>
        Anon Key
        <input value={key} onChange={(e) => setKey(e.target.value.trim())} placeholder="eyJhbGciOi..." />
      </label>
      <button disabled={!url || !key} onClick={() => onSave(url, key)}>
        Simpan & Lanjutkan
      </button>
    </div>
  );
}
