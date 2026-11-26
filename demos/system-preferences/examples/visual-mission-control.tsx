import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Mission Control pane, 668 x 480 pt, in the state both captures
 * show.
 *
 * Reference crop x=112 y=76 w=1336 h=960: the opaque frame without its shadow.
 */
export default function VisualMissionControl() {
  return (
    <div
      style={{
        position: "relative",
        width: 668,
        height: 480,
        overflow: "hidden",
        background: "white",
      }}
    >
      <SystemPreferences style={{ position: "absolute" }} defaultPane="mission-control" />
    </div>
  );
}
