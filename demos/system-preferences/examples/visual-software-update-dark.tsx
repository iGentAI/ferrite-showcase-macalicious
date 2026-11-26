import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Software Update pane in Dark Aqua, 668 x 285 pt: as the Aqua
 * capture, but last checked at 10:29, as in Dark-System-Preferences-Software-Update.
 *
 * Reference crop x=112 y=76 w=1336 h=570: the opaque frame without its shadow.
 */
export default function VisualSoftwareUpdateDark() {
  return (
    <div
      style={{
        position: "relative",
        width: 668,
        height: 285,
        overflow: "hidden",
        background: "white",
      }}
    >
      <SystemPreferences
        style={{ position: "absolute" }}
        defaultPane="software-update"
        defaultSettings={{ "software-update.lastChecked": "Today at 10:29 AM" }}
      />
    </div>
  );
}
