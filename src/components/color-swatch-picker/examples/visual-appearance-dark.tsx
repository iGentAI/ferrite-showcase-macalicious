import { ColorSwatchPicker, ThumbnailSwatch } from "macalicious/color-swatch-picker";

const art = { background: "#808080" };

/**
 * Visual comparison target: the Appearance thumbnails of System Preferences > General in Dark
 * Aqua, Dark chosen. The geometry and the masks are those of visual-appearance-light.
 */
export default function VisualAppearanceDark() {
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
      <ColorSwatchPicker aria-label="Appearance" defaultValue="dark">
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
