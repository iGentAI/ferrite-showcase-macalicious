import { NotificationAlert, NotificationAlertAction } from "macalicious/notification-alert";

/**
 * Fixture for the pixel checks in `notification-alert.visual.json` of what no screenshot
 * shows: two buttons, a pressed button and the keyboard focus ring.
 *
 * A 364 x 83 pt box of the window background with a 344 x 63 pt opaque alert at 10, 10. The
 * two buttons are 31 pt each: the first from y 10 to 41, then the 1 pt line, then the second
 * from y 42 to 73. The button column starts at x 284, after the 1 pt divider at x 283.
 */
export default function VisualStates() {
  return (
    <div style={{ width: 364, height: 83, padding: 10, boxSizing: "border-box" }}>
      <NotificationAlert
        material="opaque"
        title="Ana Ferreira"
        actions={
          <>
            <NotificationAlertAction>Reply</NotificationAlertAction>
            <NotificationAlertAction>Close</NotificationAlertAction>
          </>
        }
      >
        Are we still on for one o’clock?
      </NotificationAlert>
    </div>
  );
}
