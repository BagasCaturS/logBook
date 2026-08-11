import { useState } from "react";
import { t, type Lang } from "../lib/i18n";

interface Props {
  initialUrl: string;
  initialKey: string;
  lang: Lang;
  onSave: (url: string, key: string) => void;
}

export default function Setup({ initialUrl, initialKey, lang, onSave }: Props) {
  const [url, setUrl] = useState(initialUrl);
  const [key, setKey] = useState(initialKey);

  return (
    <div className="setup">
      <h2>{t(lang, "setup.title")}</h2>
      <p>{t(lang, "setup.desc")}</p>
      <label>
        {t(lang, "setup.projectUrl")}
        <input value={url} onChange={(e) => setUrl(e.target.value.trim())} placeholder="https://xxxx.supabase.co" />
      </label>
      <label>
        {t(lang, "setup.anonKey")}
        <input value={key} onChange={(e) => setKey(e.target.value.trim())} placeholder="eyJhbGciOi..." />
      </label>
      <button disabled={!url || !key} onClick={() => onSave(url, key)}>
        {t(lang, "setup.save")}
      </button>
    </div>
  );
}
