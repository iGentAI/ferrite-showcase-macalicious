import { NotificationAlert, NotificationAlertClose } from "macalicious/notification-alert";

/**
 * Visual comparison target: Finder's "Disk Not Ejected Properly" alert in Aqua, the whole
 * window capture with its shadow (764 x 202 px, 382 x 101 pt; the alert is 344 x 63 pt at
 * 19, 18).
 *
 * The capture has a transparent background, matted white, and records the material opaque, so
 * the alert is drawn with `material="opaque"`. The Finder icon is Apple's artwork: the icon box
 * is left empty and the comparisons mask it.
 */
export default function VisualEjectWarning() {
  return (
    <div
      style={{
        width: 382,
        height: 101,
        padding: "18px 0 0 19px",
        boxSizing: "border-box",
        overflow: "hidden",
        background: "white",
      }}
    >
      <NotificationAlert
        material="opaque"
        title="Disk Not Ejected Properly"
        icon={<span style={{ width: 32, height: 32 }} />}
        actions={<NotificationAlertClose>Close</NotificationAlertClose>}
      >
        Eject “USB Key” before disconnecting or turning it off.
      </NotificationAlert>
    </div>
  );
}
