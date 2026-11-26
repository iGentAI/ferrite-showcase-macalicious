import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Keyboard pane, 668 x 581 pt, Keyboard tab, in the state both
 * captures show.
 *
 * Reference crop x=112 y=76 w=1336 h=1162: the opaque frame without its shadow.
 */
export default function VisualKeyboard() {
  return (
    <div
      style={{
        position: "relative",
        width: 668,
        height: 581,
        overflow: "hidden",
        background: "white",
      }}
    >
      <SystemPreferences style={{ position: "absolute" }} defaultPane="keyboard" />
    </div>
  );
}
