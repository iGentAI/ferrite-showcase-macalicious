import { ColorSwatchPicker, ThumbnailSwatch } from "macalicious/color-swatch-picker";

const art = { background: "#808080" };

/**
 * Visual comparison target: the Appearance thumbnails of System Preferences > General in Aqua,
 * Light chosen.
 *
 * Reference crop (2x pixels) x=604 y=180 w=496 h=140, i.e. 248 x 70 pt, on the pane background.
 * The three 67 x 44 pt pictures start 5.5 pt from the crop's left and 4 pt from its top, 86 pt
 * apart. The pictures are Apple's artwork and the captions are set in the fallback font off
 * Apple platforms, so the comparison masks both and scores the ring, the hairlines and their
 * placement; the example's pictures are plain grey.
 */
export default function VisualAppearanceLight() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 248,
        height: 70,
        padding: "4px 0 0 5.5px",
        background: "light-dark(#ececec, #2f3031)",
      }}
    >
      <ColorSwatchPicker aria-label="Appearance" defaultValue="light">
        <ThumbnailSwatch value="light" label="Light">
          <span aria-hidden="true" style={art} />
        </ThumbnailSwatch>
        <ThumbnailSwatch value="dark" label="Dark">
          <span aria-hidden="true" style={art} />
        </ThumbnailSwatch>
        <ThumbnailSwatch value="auto" label="Auto">
          <span aria-hidden="true" style={art} />
        </ThumbnailSwatch>
      </ColorSwatchPicker>
    </div>
  );
}
