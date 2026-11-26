import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Spotlight pane, 668 x 597 pt, in the state both captures show.
 *
 * Reference crop x=112 y=76 w=1336 h=1194: the opaque frame without its shadow.
 */
export default function VisualSpotlight() {
  return (
    <div
      style={{
        position: "relative",
        width: 668,
        height: 597,
        overflow: "hidden",
        background: "white",
      }}
    >
      <SystemPreferences style={{ position: "absolute" }} defaultPane="spotlight" />
    </div>
  );
}
