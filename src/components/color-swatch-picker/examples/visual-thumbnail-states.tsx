import { ColorSwatchPicker, ThumbnailSwatch } from "macalicious/color-swatch-picker";

const art = { background: "#808080" };

/**
 * Fixture for the thumbnail states no reference screenshot shows (pressed, keyboard focus,
 * disabled). `color-swatch-picker.visual.json` puts it into each state with real input and
 * checks the pixels it expects. The pictures are plain grey, so a darkened or half-transparent
 * picture has one known colour.
 *
 * 432 x 82 pt: 8 pt of page on every side, so the focus ring is inside the capture. The
 * pictures are 67 x 44 pt from y 8, 86 pt apart: Light (chosen) from x 8, Dark from 94, Auto
 * from 180; the disabled picker's Light (chosen) from x 271 and its Dark from 357.
 */
export default function VisualThumbnailStates() {
  return (
    <div
      style={{
        display: "flex",
        gap: 24,
        boxSizing: "border-box",
        width: 432,
        height: 82,
        padding: 8,
      }}
    >
      <ColorSwatchPicker aria-label="Appearance" defaultValue="light">
        <ThumbnailSwatch value="light" label="Light">
          <span aria-hidden="true" style={art} />
        </ThumbnailSwatch>
        <ThumbnailSwatch value="dark" label="Dark" data-visual="dark">
          <span aria-hidden="true" style={art} />
        </ThumbnailSwatch>
        <ThumbnailSwatch value="auto" label="Auto">
          <span aria-hidden="true" style={art} />
        </ThumbnailSwatch>
      </ColorSwatchPicker>
      <ColorSwatchPicker aria-label="Unavailable appearance" defaultValue="light" disabled>
        <ThumbnailSwatch value="light" label="Light" data-visual="disabled-light">
          <span aria-hidden="true" style={art} />
        </ThumbnailSwatch>
        <ThumbnailSwatch value="dark" label="Dark">
          <span aria-hidden="true" style={art} />
        </ThumbnailSwatch>
      </ColorSwatchPicker>
    </div>
  );
}
