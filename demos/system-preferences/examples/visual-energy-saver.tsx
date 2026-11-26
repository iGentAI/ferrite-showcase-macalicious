import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Energy Saver pane, 668 x 505 pt, on the Power Adapter tab with
 * a charged battery and the search field focused, as in Light-System-Preferences-Energy-Saver.
 *
 * Reference crop x=112 y=76 w=1336 h=1010: the opaque frame without its shadow.
 */
export default function VisualEnergySaver() {
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
        searchFieldProps={{ "data-force": "focus" } as Record<string, string>}
      />
    </div>
  );
}
