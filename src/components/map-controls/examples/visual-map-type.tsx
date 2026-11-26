import { MapTypeControl, MapTypeOption } from "macalicious/map-controls";

/**
 * Visual comparison target: the map-type control of Find My, with Map selected.
 *
 * Reference crop (2x pixels) x=662 y=1445 w=472 h=50 in the Aqua capture and x=618 y=1421 in
 * the Dark Aqua one (236 x 25 pt): the 231 pt track starts 1.75 pt from the left and from the
 * top. The land behind is #f9f5ed in Aqua and #2b2d2f in Dark Aqua; the roads that cross
 * behind the control in the screenshots are not drawn.
 */
export default function VisualMapType() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 236,
        height: 25,
        padding: "1.75px 0 0 1.75px",
        background: "light-dark(#f9f5ed, #2b2d2f)",
      }}
    >
      <MapTypeControl defaultValue="map" aria-label="Map type">
        <MapTypeOption value="map">Map</MapTypeOption>
        <MapTypeOption value="hybrid">Hybrid</MapTypeOption>
        <MapTypeOption value="satellite">Satellite</MapTypeOption>
      </MapTypeControl>
    </div>
  );
}
