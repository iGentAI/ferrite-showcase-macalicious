import { NotificationAlert, NotificationAlertClose } from "macalicious/notification-alert";
import { PushButton } from "macalicious/push-button";
import { useState } from "react";

export default function Basic() {
  const [shown, setShown] = useState(true);
  return shown ? (
    <NotificationAlert
      title="Disk Not Ejected Properly"
      actions={<NotificationAlertClose>Close</NotificationAlertClose>}
      onDismiss={() => setShown(false)}
    >
      Eject “USB Key” before disconnecting or turning it off.
    </NotificationAlert>
  ) : (
    <PushButton onClick={() => setShown(true)}>Show Notification</PushButton>
  );
}
