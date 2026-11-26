import { TitleBar } from "macalicious/title-bar";
import { WindowControls } from "macalicious/window-controls";

/**
 * Visual comparison target: the window controls of the key Finder window.
 *
 * Reference crop (2x pixels) x=120 y=80 w=120 h=40, i.e. 60 x 20 pt, starting 4 pt right of
 * and 2 pt below the window's top-left corner. The bar is the 55 pt unified title bar.
 */
export default function VisualKey() {
  return (
    <div style={{ position: "relative", width: 60, height: 20, overflow: "hidden" }}>
      <TitleBar
        variant="unified"
        controls={<WindowControls />}
        style={{ position: "absolute", left: -4, top: -2, width: 200, height: 55 }}
      />
    </div>
  );
}
