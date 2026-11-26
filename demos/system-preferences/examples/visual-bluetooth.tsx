import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Bluetooth pane, 668 x 432 pt: Bluetooth on, looking for
 * devices, and the mouse connected, as in Light-System-Preferences-Bluetooth.
 *
 * Reference crop x=112 y=76 w=1336 h=864: the opaque frame without its shadow.
 */
export default function VisualBluetooth() {
  return (
    <div
      style={{
        position: "relative",
        width: 668,
        height: 432,
        overflow: "hidden",
        background: "white",
      }}
    >
      <SystemPreferences style={{ position: "absolute" }} defaultPane="bluetooth" />
    </div>
  );
}
