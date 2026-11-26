import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Screen Time pane in Dark Aqua, 668 x 613 pt. The capture was
 * taken a day later than the light one: it shows the App Usage of October 4, other apps, one
 * category, and an account picture without initials, as in Dark-System-Preferences-Screen-Time.
 *
 * Reference crop x=112 y=76 w=1336 h=1226: the opaque frame without its shadow.
 */
export default function VisualScreenTimeDark() {
  return (
    <div
      style={{
        position: "relative",
        width: 668,
        height: 613,
        overflow: "hidden",
        background: "white",
      }}
    >
      <SystemPreferences
        style={{ position: "absolute" }}
        defaultPane="screen-time"
        defaultSettings={{ "screen-time.today": "2019-10-04", "screen-time.picture": "none" }}
      />
    </div>
  );
}
