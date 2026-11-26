import { TitleBar } from "macalicious/title-bar";
import { WindowControls } from "macalicious/window-controls";

/**
 * Visual comparison target: the small controls of a utility panel (Help Viewer).
 *
 * Reference crop x=52 y=40 w=106 h=28 (53 x 14 pt), 3 pt right of and 1 pt below the panel's
 * corner at 46,38. The bar is the 49 pt utility bar: a 16 pt strip over a toolbar.
 */
export default function VisualSmall() {
  return (
    <div style={{ position: "relative", width: 53, height: 14, overflow: "hidden" }}>
      <TitleBar
        variant="utility"
        controls={<WindowControls size="small" />}
        style={{ position: "absolute", left: -3, top: -1, width: 200, height: 49 }}
      />
    </div>
  );
}
