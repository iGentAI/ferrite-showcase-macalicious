import { HomekitTile } from "macalicious/homekit-tile";

function Bulb() {
  return (
    <svg
      viewBox="0 0 17 24"
      width="17"
      height="24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M8.5 0a8.5 8.5 0 0 0-5 15.4c.9.7 1.5 1.6 1.5 2.6h7c0-1 .6-1.9 1.5-2.6A8.5 8.5 0 0 0 8.5 0z" />
    </svg>
  );
}

/**
 * Visual comparison target: an accessory tile that is off (`Front` / `Light` / `Off`), the
 * first tile of the grid, in both appearances.
 *
 * Reference crop (2x pixels) x=143 y=1044 w=204 h=204 (102 x 102 pt). The wallpaper, a
 * photograph, runs from about #004455 at the tile's left to #005d76 at its right; the example
 * stands a gradient in for it. The glyph is a stand-in drawing and is masked.
 */
export default function VisualAccessoryOff() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 102,
        height: 102,
        padding: 0.25,
        background: "linear-gradient(to right, #004455, #005d76)",
      }}
    >
      <HomekitTile room="Front" name="Light" status="Off" icon={<Bulb />} />
    </div>
  );
}
