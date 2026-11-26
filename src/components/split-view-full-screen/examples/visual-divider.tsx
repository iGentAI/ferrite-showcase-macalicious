import {
  SplitViewFullScreen,
  SplitViewFullScreenDivider,
  SplitViewFullScreenTile,
} from "macalicious/split-view-full-screen";
import { WindowBody } from "macalicious/window";

/**
 * Visual comparison target: the divider and its handle at the middle of the screen.
 *
 * Reference crop x=1440 y=900 w=104 h=300 (52 x 150 pt) of the Split-Screen-Apps captures:
 * the Space is 1680 x 1050 pt, the leading tile 740 pt wide, the gutter x 740 to 752 and the
 * handle x 744 to 748, y 493 to 557. The tiles hold application content (a paper texture and
 * a web page), which is masked except for the 2 pt beside the gutter; the fills here are flat
 * stand-ins of the same colour.
 *
 * The split is uncontrolled, so the state checks can focus the divider and move it with a key.
 */
export default function VisualDivider() {
  return (
    <div style={{ position: "relative", width: 52, height: 150, overflow: "hidden" }}>
      <SplitViewFullScreen
        defaultSplit={740 / 1668}
        defaultActive="trailing"
        style={{ position: "absolute", left: -720, top: -450, width: 1680, height: 1050 }}
      >
        <SplitViewFullScreenTile side="leading" aria-label="Leading">
          <WindowBody style={{ background: "light-dark(#faf9f7, #282828)" }} />
        </SplitViewFullScreenTile>
        <SplitViewFullScreenDivider />
        <SplitViewFullScreenTile side="trailing" aria-label="Trailing">
          <WindowBody style={{ background: "white" }} />
        </SplitViewFullScreenTile>
      </SplitViewFullScreen>
    </div>
  );
}
