import { WindowShadow } from "macalicious/window-shadow";

/**
 * Visual comparison target: the shadow beside the left edge of a key window.
 *
 * Reference crop x=0 y=600 w=112 h=300 (56 x 150 pt): the transparent margin left of the
 * Finder Network window, matted with white. The surface starts at the crop's right edge.
 */
export default function VisualSide() {
  return (
    <div
      style={{
        position: "relative",
        width: 56,
        height: 150,
        overflow: "hidden",
        background: "white",
      }}
    >
      <WindowShadow
        style={{ position: "absolute", left: 56, top: -262, width: 926, height: 711 }}
      />
    </div>
  );
}
