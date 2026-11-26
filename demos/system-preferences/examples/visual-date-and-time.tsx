import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Date & Time pane in Aqua, 668 x 528 pt, locked, with 3 October
 * 2019 and 10:56:59 AM and the search field focused, as in
 * Light-System-Preferences-Date-and-Time.
 *
 * Reference crop x=112 y=76 w=1336 h=1056: the opaque frame without its shadow.
 */
export default function VisualDateAndTime() {
  return (
    <div
      style={{
        position: "relative",
        width: 668,
        height: 528,
        overflow: "hidden",
        background: "white",
      }}
    >
      <SystemPreferences
        style={{ position: "absolute" }}
        defaultPane="date-and-time"
        defaultSettings={{
          "date-and-time.date": Date.UTC(2019, 9, 3) / 86_400_000,
          "date-and-time.time": 10 * 3600 + 56 * 60 + 59,
        }}
        searchFieldProps={{ "data-force": "focus" } as Record<string, string>}
      />
    </div>
  );
}
