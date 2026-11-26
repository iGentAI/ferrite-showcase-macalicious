import { GalleryView } from "macalicious/gallery-view";

// Stand-in pictures, drawn here: a two-colour gradient per item.
const art = (index: number) =>
  `linear-gradient(160deg, hsl(${index * 47} 55% 60%), hsl(${index * 47 + 60} 60% 30%))`;

const label = (index: number) => `Picture ${index + 1}`;
const preview = (index: number) => (
  <div style={{ width: 80, height: 40, background: art(index) }} />
);
const thumbnail = (index: number) => (
  <div style={{ width: 48, height: 27, background: art(index) }} />
);

/**
 * Visual check target for the states no screenshot shows: a 320 x 140 pt gallery of 12 items
 * with a 78 pt stage and no inspector, the second item selected. The comparisons click,
 * press keys and move focus, then read pixels beside the stand-in pictures.
 */
export default function VisualStates() {
  return (
    <GalleryView
      aria-label="States"
      count={12}
      getItemLabel={label}
      renderPreview={preview}
      renderThumbnail={thumbnail}
      defaultValue={[1]}
      style={{ width: 320, height: 140 }}
    />
  );
}
