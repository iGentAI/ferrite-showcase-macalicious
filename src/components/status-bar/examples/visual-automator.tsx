import { StatusBar } from "macalicious/status-bar";

/**
 * Visual comparison target: an artwork-free stretch of Automator's bottom strip.
 *
 * Reference crop (2x pixels) x=1000 y=1770 w=1000 h=40, i.e. 500 x 20 pt. The strip is 21 pt
 * high; its last point is left out because the dark window's inner border covers it.
 */
export default function VisualAutomator() {
  return (
    <div style={{ width: 500, height: 20, overflow: "hidden" }}>
      <StatusBar variant="gradient" />
    </div>
  );
}
