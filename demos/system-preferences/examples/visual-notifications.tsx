import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Notifications pane in Aqua, 668 x 528 pt, Do Not Disturb
 * chosen and the applications of Light-System-Preferences-Notifications in the list.
 *
 * Reference crop x=112 y=76 w=1336 h=1056: the opaque frame without its shadow.
 */
export default function VisualNotifications() {
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
      <SystemPreferences style={{ position: "absolute" }} defaultPane="notifications" />
    </div>
  );
}
