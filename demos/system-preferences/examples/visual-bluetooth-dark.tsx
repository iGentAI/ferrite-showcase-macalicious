import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Bluetooth pane in Dark Aqua, 668 x 432 pt: as the Aqua capture,
 * but the mouse is not connected, as in Dark-System-Preferences-Bluetooth.
 *
 * Reference crop x=112 y=76 w=1336 h=864: the opaque frame without its shadow.
 */
export default function VisualBluetoothDark() {
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
      <SystemPreferences
        style={{ position: "absolute" }}
        defaultPane="bluetooth"
        defaultSettings={{ "bluetooth.connected": false }}
      />
    </div>
  );
}
