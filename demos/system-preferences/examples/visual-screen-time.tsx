import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Screen Time pane, 668 x 613 pt, showing the App Usage of
 * October 3, as in Light-System-Preferences-Screen-Time.
 *
 * Reference crop x=112 y=76 w=1336 h=1226: the opaque frame without its shadow.
 */
export default function VisualScreenTime() {
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
      <SystemPreferences style={{ position: "absolute" }} defaultPane="screen-time" />
    </div>
  );
}
