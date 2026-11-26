import { NotificationAlert, NotificationAlertAction } from "macalicious/notification-alert";

/** The transient states of a button, pinned with `data-force`, and a disabled button. */
export default function States() {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <NotificationAlert
        material="opaque"
        title="Pressed"
        actions={
          <>
            <NotificationAlertAction data-force="pressed">Reply</NotificationAlertAction>
            <NotificationAlertAction>Close</NotificationAlertAction>
          </>
        }
      >
        The pressed button darkens its part of the column.
      </NotificationAlert>
      <NotificationAlert
        material="opaque"
        title="Keyboard focus"
        actions={
          <>
            <NotificationAlertAction data-force="focus">Reply</NotificationAlertAction>
            <NotificationAlertAction>Close</NotificationAlertAction>
          </>
        }
      >
        The focus ring is drawn inside the button.
      </NotificationAlert>
      <NotificationAlert
        material="opaque"
        title="Disabled"
        actions={
          <>
            <NotificationAlertAction disabled>Reply</NotificationAlertAction>
            <NotificationAlertAction>Close</NotificationAlertAction>
          </>
        }
      >
        A disabled button dims its title and leaves the tab order.
      </NotificationAlert>
    </div>
  );
}
