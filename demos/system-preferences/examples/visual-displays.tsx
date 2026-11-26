import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Displays pane in Aqua, 668 x 511 pt, on the Display tab with
 * the brightness of Light-System-Preferences-Displays and the search field focused as there.
 *
 * Reference crop x=112 y=76 w=1336 h=1022: the opaque frame without its shadow.
 */
export default function VisualDisplays() {
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
        defaultSettings={{ "displays.brightness": 80.5 }}
        searchFieldProps={{ "data-force": "focus" } as Record<string, string>}
      />
    </div>
  );
}
