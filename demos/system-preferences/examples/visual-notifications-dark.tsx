import { SystemPreferences } from "../system-preferences";

/**
 * Visual comparison target: the Notifications pane in Dark Aqua, 668 x 528 pt, Do Not Disturb
 * chosen. The capture differs from the light one in its content: the list holds another set of
 * applications, as in Dark-System-Preferences-Notifications.
 *
 * Reference crop x=112 y=76 w=1336 h=1056: the opaque frame without its shadow.
 */
export default function VisualNotificationsDark() {
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
        defaultPane="notifications"
        defaultSettings={{
          "notifications.apps": [
            "books",
            "calendar",
            "facetime",
            "find-my",
            "games",
            "home",
            "mail",
            "maps",
          ],
        }}
      />
    </div>
  );
}
