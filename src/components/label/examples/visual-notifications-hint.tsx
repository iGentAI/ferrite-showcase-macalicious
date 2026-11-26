import { Label } from "macalicious/label";

/**
 * Visual comparison target: the Do Not Disturb row of System Preferences > Notifications.
 *
 * Reference crop (2x pixels) x=666 y=326 w=420 h=140, i.e. 210 x 70 pt on the pane's box. A
 * 13 pt label on two lines (16 pt pitch) and, 7.5 pt below, an 11 pt hint in the secondary
 * label colour on two lines (14 pt pitch).
 */
export default function VisualNotificationsHint() {
  return (
    <div
      style={{
        position: "relative",
        width: 210,
        height: 70,
        background: "light-dark(#e3e3e3, #363637)",
      }}
    >
      <Label style={{ position: "absolute", left: 3, top: 3.5, whiteSpace: "pre" }}>
        {"Turn on Do Not Disturb in\nNotification Center"}
      </Label>
      <Label
        textStyle="small"
        color="secondary"
        style={{ position: "absolute", left: 2.5, top: 43, whiteSpace: "pre" }}
      >
        {"Banners and alerts will be hidden and\nnotification sounds will be silenced."}
      </Label>
    </div>
  );
}
