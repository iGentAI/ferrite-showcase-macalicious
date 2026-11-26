import { TitleBar } from "macalicious/title-bar";
import { Window } from "macalicious/window";

/**
 * Visual comparison target: the surface of the translucent 22 pt bar of the QuickTime Player
 * window, taken where the movie behind it is nearly black and flat, so that the picture need
 * not be drawn: the two highlight rows, the tint and the two bottom rows.
 *
 * Reference crop 400 x 44 px (200 x 22 pt): x=2412 y=76 in the light capture and x=2112 in the
 * dark one, where the picture under the bar reads #131313 to #161616 and #101010 to #151515.
 * The backdrop here is the value between them. The window is the same dark window in both
 * captures; it is dark here as in the QuickTime Player demo.
 */
export default function VisualTranslucentSurface() {
  return (
    <div style={{ position: "relative", width: 200, height: 22, overflow: "hidden" }}>
      <Window
        data-appearance="dark"
        width={1000}
        height={200}
        style={{ position: "absolute", left: -400, background: "#131313" }}
      >
        <TitleBar material="translucent" style={{ position: "absolute", inset: "0 0 auto" }} />
      </Window>
    </div>
  );
}
