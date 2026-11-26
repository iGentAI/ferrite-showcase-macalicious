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
 * Visual comparison target: an accessory tile that is on (`Master` / `Corner Light` / `On`).
 * The tile is the same in both captures.
 *
 * Reference crop (2x pixels) x=580 y=1044 w=204 h=204, that is 102 x 102 pt: the 101.5 pt tile
 * starts a quarter point in. The wallpaper behind its corners is about #006a84 there. The
 * glyph is a stand-in drawing and is masked.
 */
export default function VisualAccessoryOn() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 102,
        height: 102,
        padding: 0.25,
        background: "#006a84",
      }}
    >
      <HomekitTile room="Master" name="Corner Light" status="On" icon={<Bulb />} active />
    </div>
  );
}
