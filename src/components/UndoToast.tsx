import { t, type Lang } from "../lib/i18n";

interface Props {
  lang: Lang;
  onUndo: () => void;
  onDismiss: () => void;
}

export default function UndoToast({ lang, onUndo, onDismiss }: Props) {
  return (
    <div className="undo-toast" role="status">
      <span>{t(lang, "undo.deleted")}</span>
      <div className="undo-actions">
        <button className="link" onClick={onUndo}>
          {t(lang, "undo.action")}
        </button>
        <button className="icon-btn secondary undo-close" onClick={onDismiss} aria-label={t(lang, "dialog.cancel")}>
          ✕
        </button>
      </div>
    </div>
  );
}
