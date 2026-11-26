import { TitleBar } from "macalicious/title-bar";
import { WindowControls } from "macalicious/window-controls";

/**
 * Visual comparison target: the pointer over the controls of a full-screen window. Glyphs show
 * on the enabled buttons; minimize is disabled in full screen and zoom leaves full screen.
 *
 * Reference crop x=20 y=64 w=120 h=36 (60 x 18 pt) of the Full Screen App captures; the bar
 * starts at y=44 under the menu bar. The bar there is tinted by the desktop picture, so this
 * fixture paints the measured fill instead of the neutral title-bar gradient.
 */
export default function VisualHover() {
  return (
    <div style={{ position: "relative", width: 60, height: 18, overflow: "hidden" }}>
      <TitleBar
        variant="title-hidden"
        controls={
          <WindowControls data-force="hover" minimizeDisabled zoomRole="exit-full-screen" />
        }
        style={{
          position: "absolute",
          left: -10,
          top: -10,
          width: 200,
          background: "linear-gradient(light-dark(#dde1e3, #484d56), light-dark(#cdd2d5, #3b3f48))",
        }}
      />
    </div>
  );
}
