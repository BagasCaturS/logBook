import { t, type Lang } from "../lib/i18n";
import ConnectionForm from "./ConnectionForm";

interface Props {
  initialUrl: string;
  initialKey: string;
  lang: Lang;
  onSave: (url: string, key: string) => void;
}

export default function Setup({ initialUrl, initialKey, lang, onSave }: Props) {
  return (
    <div className="setup">
      <h2>{t(lang, "setup.title")}</h2>
      <p>{t(lang, "setup.desc")}</p>
      <p className="hint">{t(lang, "setup.urlHint")}</p>
      <ConnectionForm initialUrl={initialUrl} initialKey={initialKey} lang={lang} onSave={onSave} />
    </div>
  );
}