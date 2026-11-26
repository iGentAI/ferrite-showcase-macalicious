import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Accessibility pane, 668 x 476 pt, with Overview selected, the
 * state both captures show.
 *
 * Reference crop x=112 y=76 w=1336 h=952: the opaque frame without its shadow.
 */
export default function VisualAccessibility() {
  return (
    <div
      style={{
        position: "relative",
        width: 668,
        height: 476,
        overflow: "hidden",
        background: "white",
      }}
    >
      <SystemPreferences style={{ position: "absolute" }} defaultPane="accessibility" />
    </div>
  );
}
