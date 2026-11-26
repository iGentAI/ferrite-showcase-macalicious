import { MapCompass } from "macalicious/map-controls";

/**
 * Visual comparison target: the compass of Maps with its 3D button, north up.
 *
 * Reference crop (2x pixels) x=1974 w=112 h=112 (56 x 56 pt), from y=1284 in the Aqua capture
 * and y=1267 in the Dark Aqua one: the 53 pt disc with 1.5 pt of map around it. The land
 * behind is #f9f5ed in Aqua and #2b2d2f in Dark Aqua; the streets and their names that pass
 * behind the compass in the screenshots are not drawn.
 */
export default function VisualCompass() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 56,
        height: 56,
        padding: 1.5,
        background: "light-dark(#f9f5ed, #2b2d2f)",
      }}
    >
      <MapCompass />
    </div>
  );
}
