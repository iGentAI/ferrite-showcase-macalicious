import { TitleBar } from "macalicious/title-bar";
import { Window, WindowBody } from "macalicious/window";

/**
 * Visual comparison target: the bottom-left corner of the key Finder window with its shadow,
 * where the sidebar meets the frame.
 *
 * Reference crop 252 x 250 px (126 x 125 pt) at the bottom-left of the Finder Network captures
 * (y=1396 light, y=1392 dark), matted with white. The frame ends 74 pt above the bottom of the
 * capture. The sidebar is the opaque stand-in that a window-only capture shows.
 */
export default function VisualCornerBottomLeft() {
  return (
    <div
      style={{
        position: "relative",
        width: 126,
        height: 125,
        overflow: "hidden",
        background: "white",
      }}
    >
      <Window width={926} height={400} style={{ position: "absolute", left: 56, bottom: 74 }}>
        <TitleBar />
        <WindowBody style={{ background: "var(--mac-material-sidebar-opaque)" }} />
      </Window>
    </div>
  );
}
