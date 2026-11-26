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
 * Visual comparison target: a scene tile that is active (`Studio On`). The tile is the same in
 * both captures.
 *
 * Reference crop (2x pixels) x=1017 y=728 w=424 h=110, that is 212 x 55 pt: the 211 x 54 pt
 * tile starts a quarter point in. The wallpaper behind its corners is about #007f9b there.
 * The glyph is a stand-in drawing and is masked.
 */
export default function VisualSceneOn() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 212,
        height: 55,
        padding: 0.25,
        background: "#007f9b",
      }}
    >
      <HomekitTile kind="scene" name="Studio On" icon={<House />} tint="#f7951f" active />
    </div>
  );
}
