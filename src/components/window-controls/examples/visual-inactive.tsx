import { TitleBar } from "macalicious/title-bar";
import { WindowControls } from "macalicious/window-controls";

/**
 * Visual comparison target: the inactive Safari window in the Picture in Picture captures.
 *
 * Reference crop 120 x 48 px (60 x 24 pt) starting 7 pt right of and 6 pt below the window's
 * corner: x=330 y=116 in the light capture, x=358 y=90 in the dark one. The bar is the 38 pt
 * title-hidden bar, flat because the window is inactive.
 */
export default function VisualInactive() {
  return (
    <div style={{ position: "relative", width: 60, height: 24, overflow: "hidden" }}>
      <TitleBar
        variant="title-hidden"
        controls={<WindowControls />}
        style={{ position: "absolute", left: -7, top: -6, width: 200 }}
      />
    </div>
  );
}
