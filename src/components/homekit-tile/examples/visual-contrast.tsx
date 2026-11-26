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
 * Fixture for what no screenshot shows: an inactive tile with `contrast="more"`, whose glyph
 * and text are white. The tile stands a quarter point inside a 102 pt square of the
 * wallpaper's colour, as in `visual-accessory-off`.
 */
export default function VisualContrast() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 102,
        height: 102,
        padding: 0.25,
        background: "#015570",
      }}
    >
      <HomekitTile room="Front" name="Light" status="Off" icon={<Bulb />} contrast="more" />
    </div>
  );
}
