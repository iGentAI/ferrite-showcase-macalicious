import { NotificationAlert, NotificationAlertClose } from "macalicious/notification-alert";

/**
 * Visual comparison target: the Dark Aqua capture of Finder's eject warning (764 x 202 px,
 * 382 x 101 pt; the alert is 344 x 63 pt at 19, 18), drawn like `visual-eject-warning`.
 *
 * This capture names the disk "USB KEY", and its first line ends before "or": in San
 * Francisco the line with "or" is 1 pt too long for the 213 pt text column. The fallback font
 * sets it 1.5 pt shorter, so the break is forced here to keep the two lines the capture has.
 */
export default function VisualEjectWarningDark() {
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
        Eject “USB KEY” before disconnecting
        <br />
        or turning it off.
      </NotificationAlert>
    </div>
  );
}
