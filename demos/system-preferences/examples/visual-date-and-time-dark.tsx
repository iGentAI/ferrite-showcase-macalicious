import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Date & Time pane in Dark Aqua, 668 x 528 pt, locked. The
 * capture differs from the light one in its content: 4 October 2019 and 10:30:38 AM, as in
 * Dark-System-Preferences-Date-and-Time, and the search field is not focused.
 *
 * Reference crop x=112 y=76 w=1336 h=1056: the opaque frame without its shadow.
 */
export default function VisualDateAndTimeDark() {
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
          "date-and-time.date": Date.UTC(2019, 9, 4) / 86_400_000,
          "date-and-time.time": 10 * 3600 + 30 * 60 + 38,
        }}
      />
    </div>
  );
}
