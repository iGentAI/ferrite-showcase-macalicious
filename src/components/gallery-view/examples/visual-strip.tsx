import { GalleryView } from "macalicious/gallery-view";
import type { CSSProperties } from "react";

// Stand-in pictures, drawn here: a two-colour gradient per item. Finder shows desktop
// pictures (Apple artwork).
const art = (index: number) =>
  `linear-gradient(160deg, hsl(${index * 47} 55% 60%), hsl(${index * 47 + 60} 60% 30%))`;

const label = (index: number) => `10-${index + 1}.jpg`;
const preview = (index: number) => (
  <div style={{ width: 96, height: 54, background: art(index) }} />
);
const thumbnail = (index: number) => (
  <div style={{ width: 48, height: index < 4 ? 36 : 27, background: art(index) }} />
);

/**
 * Visual comparison target: the thumbnail strip of Finder's gallery view, Aqua, in a crop
 * small enough for the stand-in thumbnails to be compared unmasked. Reference crop (2x pixels)
 * x=442 y=1346 w=1640 h=300, i.e. 820 x 150 pt: the last 88 pt under the large preview, the
 * 62 pt strip with the ninth thumbnail selected, the 1 pt divider and the first point of the
 * pane. The view is 300 pt high with a small preview, of which the wrapper shows the bottom.
 */
export default function VisualStrip() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        width: 820,
        height: 150,
        overflow: "hidden",
      }}
    >
      <GalleryView
        aria-label="Downloads"
        count={20}
        getItemLabel={label}
        renderPreview={preview}
        renderThumbnail={thumbnail}
        defaultValue={[8]}
        inspector={<div />}
        style={
          {
            flex: "none",
            width: 1069,
            height: 300,
            "--mac-gallery-view-background": "light-dark(#ffffff, #1e2022)",
          } as CSSProperties
        }
      />
    </div>
  );
}
