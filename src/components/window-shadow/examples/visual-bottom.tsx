import { WindowShadow } from "macalicious/window-shadow";

/**
 * Visual comparison target: the shadow under the bottom edge of a key window.
 *
 * Reference crop 600 x 148 px (300 x 74 pt): the whole transparent margin under the Finder
 * Network window, matted with white. The surface itself ends exactly at the top of the crop.
 */
export default function VisualBottom() {
  return (
    <div
      style={{
        position: "relative",
        width: 300,
        height: 74,
        overflow: "hidden",
        background: "white",
      }}
    >
      <WindowShadow
        style={{ position: "absolute", left: -144, bottom: 74, width: 926, height: 711 }}
      />
    </div>
  );
}
