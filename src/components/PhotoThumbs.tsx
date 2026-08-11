import { photoUrl } from "../lib/photos";

interface Props {
  paths: string[];
  supabaseUrl: string;
  onOpen: (url: string) => void;
}

export default function PhotoThumbs({ paths, supabaseUrl, onOpen }: Props) {
  if (!paths || paths.length === 0) return null;
  return (
    <div className="photo-grid">
      {paths.map((p) => {
        const url = photoUrl(supabaseUrl, p);
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
