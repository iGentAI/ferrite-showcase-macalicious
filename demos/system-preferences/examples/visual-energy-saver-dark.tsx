import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Energy Saver pane in Dark Aqua, 668 x 505 pt. The capture
 * differs from the light one in content: the battery is charging, so the line about it gives
 * the charge and the time left, as in Dark-System-Preferences-Energy-Saver. The search field is
 * not focused.
 *
 * Reference crop x=112 y=76 w=1336 h=1010: the opaque frame without its shadow.
 */
export default function VisualEnergySaverDark() {
  return (
    <div
      style={{
        position: "relative",
        width: 668,
        height: 505,
        overflow: "hidden",
        background: "white",
      }}
    >
      <SystemPreferences
        style={{ position: "absolute" }}
        defaultPane="energy-saver"
        defaultSettings={{
          "energy-saver.batteryStatus":
            "Current battery charge: 95%  Estimated time until full: 0:34",
        }}
      />
    </div>
  );
}
