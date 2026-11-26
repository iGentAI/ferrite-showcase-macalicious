import {
  NotificationAlert,
  NotificationAlertAction,
  NotificationAlertClose,
} from "macalicious/notification-alert";
import { useState } from "react";

/** A stand-in application icon, drawn for this example: not Apple artwork. */
function MessagesIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" role="img" aria-label="Messages">
      <rect x="2" y="2" width="28" height="28" rx="7" fill="#34c759" />
      <path
        d="M16 8.5c-5 0-9 3.1-9 7 0 2.2 1.3 4.2 3.3 5.5l-.8 3 3.5-1.8c1 .2 2 .3 3 .3 5 0 9-3.1 9-7s-4-7-9-7z"
        fill="#fff"
      />
    </svg>
  );
}

/** Two buttons share the column: an action, and Close. */
export default function Actions() {
  const [shown, setShown] = useState(true);
  const [replied, setReplied] = useState(false);
  if (!shown) {
    return (
      <button type="button" onClick={() => setShown(true)}>
        Show the notification again
      </button>
    );
  }
  return (
    <NotificationAlert
      icon={<MessagesIcon />}
      title="Ana Ferreira"
      subtitle="Lunch on Thursday"
      onDismiss={() => setShown(false)}
      actions={
        <>
          <NotificationAlertAction onClick={() => setReplied(true)}>
            {replied ? "Sent" : "Reply"}
          </NotificationAlertAction>
          <NotificationAlertClose>Close</NotificationAlertClose>
        </>
      }
    >
      Are we still on for one o’clock? I booked the table by the window.
    </NotificationAlert>
  );
}
