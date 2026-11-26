import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Time Machine pane, 668 x 440 pt, in the middle of a backup and
 * with the search field focused, as in Light-System-Preferences-Time-Machine.
 *
 * Reference crop x=112 y=76 w=1336 h=880: the opaque frame without its shadow.
 */
export default function VisualTimeMachine() {
  return (
    <div
      style={{
        position: "relative",
        width: 668,
        height: 440,
        overflow: "hidden",
        background: "white",
      }}
    >
      <SystemPreferences
        style={{ position: "absolute" }}
        defaultPane="time-machine"
        searchFieldProps={{ "data-force": "focus" } as Record<string, string>}
      />
    </div>
  );
}
