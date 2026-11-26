import { TitleBar } from "macalicious/title-bar";
import { Window, WindowBody } from "macalicious/window";

/**
 * Visual comparison target: the bottom-right corner of the key Finder window with its shadow,
 * where the browser's content background meets the frame.
 *
 * Reference crop 200 x 250 px (100 x 125 pt) at the bottom-right of the Finder Network
 * captures, matted with white. The frame ends 56 pt from the right and 74 pt from the bottom.
 * The dark capture's content is #1e1f21, tinted by the desktop picture.
 */
export default function VisualCornerBottomRight() {
  return (
    <div
      style={{
        position: "relative",
        width: 100,
        height: 125,
        overflow: "hidden",
        background: "white",
      }}
    >
      <Window width={400} height={400} style={{ position: "absolute", right: 56, bottom: 74 }}>
        <TitleBar />
        <WindowBody style={{ background: "light-dark(#ffffff, #1e1f21)" }} />
      </Window>
    </div>
  );
}
