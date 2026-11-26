import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Displays pane in Dark Aqua, 668 x 511 pt. The capture differs
 * from the light one in the brightness: the thumb is 4 pt further left, as in
 * Dark-System-Preferences-Displays.
 *
 * Reference crop x=112 y=76 w=1336 h=1022: the opaque frame without its shadow.
 */
export default function VisualDisplaysDark() {
  return (
    <div
      style={{
        position: "relative",
        width: 668,
        height: 511,
        overflow: "hidden",
        background: "white",
      }}
    >
      <SystemPreferences
        style={{ position: "absolute" }}
        defaultPane="displays"
        defaultSettings={{ "displays.brightness": 78.5 }}
      />
    </div>
  );
}
