import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Dock pane, 668 x 401 pt, in the state both captures show.
 *
 * Reference crop x=112 y=76 w=1336 h=802: the opaque frame without its shadow.
 */
export default function VisualDock() {
  return (
    <div
      style={{
        position: "relative",
        width: 668,
        height: 401,
        overflow: "hidden",
        background: "white",
      }}
    >
      <SystemPreferences style={{ position: "absolute" }} defaultPane="dock" />
    </div>
  );
}
