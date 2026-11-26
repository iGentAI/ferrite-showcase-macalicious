import { NotificationAlert } from "macalicious/notification-alert";

/**
 * Fixture for the pixel check of the translucent material: a 364 x 83 pt box of the window
 * background with a 344 x 63 pt alert at 10, 10 and nothing else behind it, so the material's
 * tint composites over one known colour.
 */
export default function VisualMaterial() {
  return (
    <div style={{ width: 364, height: 83, padding: 10, boxSizing: "border-box" }}>
      <NotificationAlert title="Backup Complete">
        The disk “Archive” was backed up 2 minutes ago.
      </NotificationAlert>
    </div>
  );
}
