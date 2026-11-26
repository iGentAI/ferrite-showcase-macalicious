import {
  SplitViewFullScreen,
  SplitViewFullScreenDivider,
  SplitViewFullScreenTile,
} from "macalicious/split-view-full-screen";
import { TitleBar } from "macalicious/title-bar";
import { WindowBody } from "macalicious/window";

/**
 * Visual comparison target: the top of the gutter between the two toolbars, the inactive
 * leading tile and the active trailing one.
 *
 * Reference crop x=1468 y=0 w=48 h=80 (24 x 40 pt) of the Split-Screen-Apps captures: 6 pt of
 * the leading tile's toolbar, the 12 pt gutter and 6 pt of the trailing tile's toolbar, both
 * 38 pt high from the top of the screen, and 2 pt of what is under them. No toolbar item
 * reaches into the crop. The 2 pt under the bars are application content; the fills here are
 * flat stand-ins of the same colour.
 */
export default function VisualToolbars() {
  return (
    <div style={{ position: "relative", width: 24, height: 40, overflow: "hidden" }}>
      <SplitViewFullScreen
        split={740 / 1668}
        active="trailing"
        style={{ position: "absolute", left: -734, top: 0, width: 1680, height: 1050 }}
      >
        <SplitViewFullScreenTile side="leading" aria-label="Leading">
          <TitleBar variant="title-hidden" />
          <WindowBody style={{ background: "light-dark(#f8f8f7, #272727)" }} />
        </SplitViewFullScreenTile>
        <SplitViewFullScreenDivider />
        <SplitViewFullScreenTile side="trailing" aria-label="Trailing">
          <TitleBar variant="title-hidden" />
          <WindowBody style={{ background: "#333f48" }} />
        </SplitViewFullScreenTile>
      </SplitViewFullScreen>
    </div>
  );
}
