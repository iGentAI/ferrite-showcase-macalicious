import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Siri pane, 668 x 332 pt, in the state both captures show.
 *
 * Reference crop x=112 y=76 w=1336 h=664: the opaque frame without its shadow.
 */
export default function VisualSiri() {
  return (
    <div
      style={{
        position: "relative",
        width: 668,
        height: 332,
        overflow: "hidden",
        background: "white",
      }}
    >
      <SystemPreferences style={{ position: "absolute" }} defaultPane="siri" />
    </div>
  );
}
