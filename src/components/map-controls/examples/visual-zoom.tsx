import { MapZoomControl } from "macalicious/map-controls";

/**
 * Visual comparison target: the zoom pair of Maps over flat land.
 *
 * Reference crop (2x pixels) x=1968 w=122 h=44 (61 x 22 pt), from y=1405 in the Aqua capture
 * and y=1387 in the Dark Aqua one, whose window is shorter: the pair's half-point edge
 * starts 2.5 pt from the left, at the crop's top. The land behind is #f9f5ed in Aqua and
 * #2b2d2f in Dark Aqua.
 */
export default function VisualZoom() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 61,
        height: 22,
        padding: "0 0 0 2.5px",
        background: "light-dark(#f9f5ed, #2b2d2f)",
      }}
    >
      <MapZoomControl />
    </div>
  );
}
