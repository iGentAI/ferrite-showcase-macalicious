import { MapButton } from "macalicious/map-controls";

/**
 * Visual comparison target: the "Show" pull-down of Maps, a bordered button with a chevron.
 *
 * Reference crop (2x pixels) x=136 w=224 h=48 (112 x 24 pt), from y=1402 in the Aqua capture
 * and y=1385 in the Dark Aqua one: the button starts 1.5 pt from the left and 2 pt from the
 * top. The land behind is #f9f5ed in Aqua and #2b2d2f in Dark Aqua.
 */
export default function VisualShow() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 112,
        height: 24,
        padding: "2px 0 0 1.5px",
        background: "light-dark(#f9f5ed, #2b2d2f)",
      }}
    >
      <MapButton chevron style={{ width: 107, justifyContent: "flex-start" }}>
        Show
      </MapButton>
    </div>
  );
}
