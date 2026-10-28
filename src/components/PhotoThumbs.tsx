import { groupPhotos } from "../lib/photoPaths";

interface Props {
  paths: string[];
  resolvePhoto: (path: string) => string;
  onOpen: (url: string) => void;
}

export default function PhotoThumbs({ paths, resolvePhoto, onOpen }: Props) {
  if (!paths || paths.length === 0) return null;
  return (
    <div className="photo-grid">
      {groupPhotos(paths).map((group) => {
        const url = resolvePhoto(group.local ?? group.cloud ?? "");
        return (
          <button
            key={group.key}
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
