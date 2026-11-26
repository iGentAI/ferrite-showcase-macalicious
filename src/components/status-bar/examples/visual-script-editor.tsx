import { StatusBar } from "macalicious/status-bar";

/**
 * Visual comparison target: an artwork-free stretch of Script Editor's bottom strip.
 *
 * Reference crop (2x pixels) x=400 y=1440 w=1000 h=44, i.e. 500 x 22 pt. The strip is 23 pt
 * high; its last point is left out because the dark window's inner border covers it.
 */
export default function VisualScriptEditor() {
  return (
    <div style={{ width: 500, height: 22, overflow: "hidden" }}>
      <StatusBar variant="flat" />
    </div>
  );
}
