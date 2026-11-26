import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the General pane in Dark Aqua, 668 x 678 pt, Dark chosen and the
 * blue accent, as in Dark-System-Preferences-General.
 *
 * Reference crop x=112 y=76 w=1336 h=1356: the opaque frame without its shadow.
 */
export default function VisualGeneralDark() {
  return (
    <div
      style={{
        position: "relative",
        width: 668,
        height: 678,
        overflow: "hidden",
        background: "white",
      }}
    >
      <SystemPreferences
        style={{ position: "absolute" }}
        defaultPane="general"
        defaultSettings={{ "general.appearance": "dark", "general.accent": "blue" }}
      />
    </div>
  );
}
