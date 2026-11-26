import { HomekitTile } from "macalicious/homekit-tile";

function House() {
  return (
    <svg
      viewBox="0 0 20 18"
      width="20"
      height="18"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M10 0 0 8.4h2.6V18h14.8V8.4H20L16.6 5.5V1.6h-2.4v1.9z" />
    </svg>
  );
}

/**
 * Visual comparison target: a scene tile that is not active (`Street On`), the first of its
 * row, in both appearances.
 *
 * Reference crop (2x pixels) x=143 y=728 w=424 h=110 (212 x 55 pt). The wallpaper runs from
 * about #004f64 at the tile's left to #017a97 at its right; the example stands a gradient in
 * for it. The glyph is a stand-in drawing and is masked.
 */
export default function VisualSceneOff() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 212,
        height: 55,
        padding: 0.25,
        background: "linear-gradient(to right, #004f64, #017a97)",
      }}
    >
      <HomekitTile kind="scene" name="Street On" icon={<House />} />
    </div>
  );
}
