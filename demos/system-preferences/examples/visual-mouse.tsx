import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Mouse pane, 668 x 512 pt, on the Point & Click tab in the state
 * both captures show.
 *
 * Reference crop x=112 y=76 w=1336 h=1024: the opaque frame without its shadow.
 */
export default function VisualMouse() {
  return (
    <div
      style={{
        position: "relative",
        width: 668,
        height: 512,
        overflow: "hidden",
        background: "white",
      }}
    >
      <SystemPreferences style={{ position: "absolute" }} defaultPane="mouse" />
    </div>
  );
}
