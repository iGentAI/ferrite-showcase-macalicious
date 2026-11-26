import { PushButton } from "macalicious/push-button";

/**
 * Visual comparison target: the small "Options…" button in a list row of the Apple ID
 * preference pane (white row in Aqua, #1d1e1f in Dark Aqua).
 *
 * Reference crop (2x pixels) x=1200 y=262 w=190 h=54, i.e. 95 x 27 pt. The bezel's edges are at
 * x 1211 to 1378 and y 271 to 304 (84 x 17 pt), so its alignment box is 85 x 18 pt and starts
 * 5 pt from the crop's left edge and 4 pt from its top.
 */
export default function VisualSmallButton() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 95,
        height: 27,
        padding: "4px 0 0 5px",
        background: "light-dark(#ffffff, #1d1e1f)",
      }}
    >
      <PushButton size="small" style={{ width: 85 }}>
        Options…
      </PushButton>
    </div>
  );
}
