interface Props {
  paths: string[];
  resolvePhoto: (path: string) => string;
  onOpen: (url: string) => void;
}

export default function PhotoThumbs({ paths, resolvePhoto, onOpen }: Props) {
  if (!paths || paths.length === 0) return null;
  return (
    <div className="photo-grid">
      {paths.map((p) => {
        const url = resolvePhoto(p);
        return (
          <button
            key={p}
            type="button"
            className="photo-thumb"
            disabled={!url}
            onClick={() => onOpen(url)}
            aria-label={url ? "Foto kegiatan" : "Foto tidak tersedia offline"}
          >
            {url ? <img src={url} alt="" loading="lazy" /> : null}
          </button>
        );
      })}
    </div>
  );
}
