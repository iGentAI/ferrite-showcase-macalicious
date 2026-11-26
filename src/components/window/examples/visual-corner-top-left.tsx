import { TitleBar } from "macalicious/title-bar";
import { Window, WindowBody } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";

/**
 * Visual comparison target: the top-left corner of the key Finder window with its shadow.
 *
 * Reference crop x=0 y=0 w=252 h=120 (126 x 60 pt) of the Finder Network captures, whose
 * transparent margins are matted with white. The frame starts 56 pt from the left and 38 pt
 * from the top of the capture.
 */
export default function VisualCornerTopLeft() {
  return (
    <div
      style={{
        position: "relative",
        width: 126,
        height: 60,
        overflow: "hidden",
        background: "white",
      }}
    >
      <Window width={926} height={711} style={{ position: "absolute", left: 56, top: 38 }}>
        <TitleBar variant="unified" controls={<WindowControls />} style={{ height: 55 }} />
        <WindowBody />
      </Window>
    </div>
  );
}
