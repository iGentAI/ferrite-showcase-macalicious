import { NotificationBanner } from "macalicious/notification-banner";

/**
 * A delivered notification. The card is translucent, so it stands on a backdrop here, as it
 * stands on Notification Center.
 */
export default function Basic() {
  return (
    <div style={{ padding: 11, background: "light-dark(#b7dff8, #162e4e)" }}>
      <NotificationBanner
        app="Music"
        time="now"
        title="Every Breaking Wave"
        icon={
          <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
            <circle cx="7" cy="7" r="7" fill="#ffffff" />
            <path d="M6 9.5V4.2l3.6-.8v5.1" fill="none" stroke="#d6336c" strokeWidth="1.1" />
            <circle cx="5" cy="9.6" r="1.2" fill="#d6336c" />
            <circle cx="8.6" cy="8.6" r="1.2" fill="#d6336c" />
          </svg>
        }
      >
        U2 — Songs of Innocence
      </NotificationBanner>
    </div>
  );
}
