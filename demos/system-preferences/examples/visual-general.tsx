import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the General pane in Aqua, 668 x 678 pt, Light chosen and the blue
 * accent, as in Light-System-Preferences-General.
 *
 * Reference crop x=112 y=76 w=1336 h=1356: the opaque frame without its shadow.
 */
export default function VisualGeneral() {
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
        defaultSettings={{ "general.appearance": "light", "general.accent": "blue" }}
      />
    </div>
  );
}
