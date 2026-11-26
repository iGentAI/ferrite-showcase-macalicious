import { PathBar } from "macalicious/path-bar";

/**
 * Visual comparison target: the empty path bar at the bottom of the Finder Search window.
 *
 * Reference crop (2x pixels) w=1560 h=48, i.e. 780 x 24 pt, at x=442 y=1454 in the light
 * screenshot and x=442 y=1418 in the dark one. The bar is 25 pt high; its last point is left
 * out because the dark window's inner border covers it.
 */
export default function VisualFinderSearch() {
  return (
    <div style={{ width: 780, height: 24, overflow: "hidden" }}>
      <PathBar />
    </div>
  );
}
