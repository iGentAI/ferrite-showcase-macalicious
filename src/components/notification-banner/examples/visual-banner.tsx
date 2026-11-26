import { NotificationBanner } from "macalicious/notification-banner";

/**
 * Visual comparison target: the notification in the Notifications view, with 5 pt of the panel
 * around it. Reference crop (2x pixels) x=2684 y=218 w=664 h=174 of the
 * Notification-Center-Notifications captures, 332 x 87 pt.
 *
 * The card is a translucent overlay, so the gradient behind it is the Notification Center
 * panel as measured just above the card in Aqua and, in Dark Aqua, through the card itself,
 * where the glow of the sun in the desktop picture is strongest. The app's icon is a plain
 * disc. The clear button is there and hidden: it shows under the pointer, which a second
 * check uses.
 */
export default function VisualBanner() {
  return (
    <div
      style={{
        boxSizing: "border-box",
        width: 332,
        height: 87,
        padding: 5,
        background:
          "linear-gradient(to right, light-dark(#b6def8, #183253) 6.25%, light-dark(#b7def8, #173052) 30%, light-dark(#b8dff8, #172e4e) 54%, light-dark(#badff6, #1e3350) 62.7%, light-dark(#bcdff4, #29374b) 67.5%, light-dark(#beddf0, #373f47) 72.3%, light-dark(#c1dceb, #454643) 77.1%, light-dark(#c4dbe7, #4b4940) 81.9%, light-dark(#c2dcea, #474741) 86.7%, light-dark(#c0deef, #3c4143) 91.6%, light-dark(#bedff1, #303a47) 96.4%)",
      }}
    >
      <NotificationBanner
        app="Music"
        time="now"
        title="Every Breaking Wave"
        onClear={() => {}}
        icon={
          <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
            <circle cx="7" cy="7" r="7" fill="#fafafa" />
          </svg>
        }
      >
        U2 — Songs of Innocence
      </NotificationBanner>
    </div>
  );
}
