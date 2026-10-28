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
            onClick={() => onOpen(url)}
            aria-label="Foto kegiatan"
          >
            <img src={url} alt="" loading="lazy" />
          </button>
        );
      })}
    </div>
  );
}
