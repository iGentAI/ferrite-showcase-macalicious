import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Touch ID pane, 668 x 338 pt, in the state both captures show.
 *
 * Reference crop x=112 y=76 w=1336 h=676: the opaque frame without its shadow.
 */
export default function VisualTouchId() {
  return (
    <div
      style={{
        position: "relative",
        width: 668,
        height: 338,
        overflow: "hidden",
        background: "white",
      }}
    >
      <SystemPreferences style={{ position: "absolute" }} defaultPane="touch-id" />
    </div>
  );
}
