import { TitleBar } from "macalicious/title-bar";
import { WindowControls } from "macalicious/window-controls";

/**
 * Visual comparison target: System Preferences, whose window cannot be resized, so its zoom
 * button is disabled.
 *
 * Reference crop x=130 y=96 w=120 h=36 (60 x 18 pt), 9 pt right of and 10 pt below the
 * window's corner, in the 38 pt title-hidden bar.
 */
export default function VisualZoomDisabled() {
  return (
    <div style={{ position: "relative", width: 60, height: 18, overflow: "hidden" }}>
      <TitleBar
        variant="title-hidden"
        controls={<WindowControls zoomDisabled />}
        style={{ position: "absolute", left: -9, top: -10, width: 200 }}
      />
    </div>
  );
}
