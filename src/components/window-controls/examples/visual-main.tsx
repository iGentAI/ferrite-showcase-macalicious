import { TitleBar } from "macalicious/title-bar";
import { WindowControls } from "macalicious/window-controls";

/**
 * Visual comparison target: the Finder window behind a Quick Look panel, which is main but not
 * key. All three controls are grey; the bar is unchanged.
 *
 * Reference crop 120 x 40 px (60 x 20 pt), 8 px right of and 2 px below the first pixel inside
 * the window's border: x=150 y=260 in the light capture (inside corner at 142,258), x=194 y=202
 * in the dark one (inside corner at 186,200).
 */
export default function VisualMain() {
  return (
    <div style={{ position: "relative", width: 60, height: 20, overflow: "hidden" }}>
      <TitleBar
        variant="unified"
        controls={<WindowControls />}
        style={{ position: "absolute", left: -4, top: -1, width: 200, height: 55 }}
      />
    </div>
  );
}
