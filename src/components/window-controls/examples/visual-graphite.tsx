import { TitleBar } from "macalicious/title-bar";
import { WindowControls } from "macalicious/window-controls";

/**
 * Visual comparison target: the System Preferences window in the Graphite theme captures. Close
 * and minimize are grey; zoom is disabled in that window. The comparison sets the graphite
 * accent on the page.
 *
 * Reference crop x=996 y=344 w=120 h=36 (60 x 18 pt), 9 pt right of and 10 pt below the
 * window's corner at 978,324.
 */
export default function VisualGraphite() {
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
