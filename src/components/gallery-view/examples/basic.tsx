import { GalleryView } from "macalicious/gallery-view";

const pictures = [
  "Aurora",
  "Bay",
  "Canyon",
  "Dunes",
  "Estuary",
  "Fjord",
  "Glacier",
  "Harbour",
  "Island",
  "Jungle",
  "Karst",
  "Lagoon",
];

// Stand-in pictures, drawn here: a two-colour gradient per item.
const art = (index: number) =>
  `linear-gradient(160deg, hsl(${index * 47} 55% 60%), hsl(${index * 47 + 60} 60% 30%))`;

const label = (index: number) => pictures[index] ?? "";
const preview = (index: number) => (
  <div
    style={{ height: "100%", maxWidth: "100%", aspectRatio: "16 / 9", background: art(index) }}
  />
);
const thumbnail = (index: number) => (
  <div style={{ width: 48, height: 27, background: art(index) }} />
);

/** Click a thumbnail, or use Left and Right Arrow, Home, End and the first letters of a name. */
export default function Basic() {
  return (
    <GalleryView
      aria-label="Pictures"
      count={pictures.length}
      getItemLabel={label}
      renderPreview={preview}
      renderThumbnail={thumbnail}
      defaultValue={[2]}
      style={{ width: 420, maxWidth: "100%", height: 260 }}
    />
  );
}
