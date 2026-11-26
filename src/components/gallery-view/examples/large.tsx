import { GalleryView } from "macalicious/gallery-view";

// Stand-in pictures, drawn here: a two-colour gradient per item.
const art = (index: number) =>
  `linear-gradient(160deg, hsl(${index * 47} 55% 60%), hsl(${index * 47 + 60} 60% 30%))`;

const label = (index: number) => `Picture ${String(index + 1).padStart(4, "0")}`;
const preview = (index: number) => (
  <div
    style={{
      display: "grid",
      placeItems: "center",
      height: "100%",
      maxWidth: "100%",
      aspectRatio: "16 / 9",
      background: art(index),
      color: "var(--mac-color-selected-content-text)",
    }}
  >
    {label(index)}
  </div>
);
const thumbnail = (index: number) => (
  <div style={{ width: 48, height: 27, background: art(index) }} />
);

/** 5,000 items: only the thumbnails in view are in the document. */
export default function Large() {
  return (
    <GalleryView
      aria-label="Five thousand pictures"
      count={5000}
      getItemLabel={label}
      renderPreview={preview}
      renderThumbnail={thumbnail}
      defaultValue={[0]}
      style={{ width: 620, maxWidth: "100%", height: 300 }}
    />
  );
}
