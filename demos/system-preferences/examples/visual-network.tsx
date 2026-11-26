import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Network pane in Aqua, 668 x 563 pt, Wi-Fi selected and
 * connected, as in Light-System-Preferences-Network. The dark capture shows the same state.
 *
 * Reference crop x=112 y=76 w=1336 h=1126: the opaque frame without its shadow.
 */
export default function VisualNetwork() {
  return (
    <div
      style={{
        position: "relative",
        width: 668,
        height: 563,
        overflow: "hidden",
        background: "white",
      }}
    >
      <SystemPreferences style={{ position: "absolute" }} defaultPane="network" />
    </div>
  );
}
