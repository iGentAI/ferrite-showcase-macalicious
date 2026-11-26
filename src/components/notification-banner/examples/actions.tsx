import { NotificationBanner } from "macalicious/notification-banner";
import { useState } from "react";

/**
 * A notification that can be opened and cleared, with a subtitle and a thumbnail. The clear
 * button takes the icon's place while the pointer is over the card or the focus is in it.
 */
export default function Actions() {
  const [log, setLog] = useState("Nothing yet.");
  return (
    <div style={{ padding: 11, background: "light-dark(#b7dff8, #162e4e)" }}>
      <NotificationBanner
        app="Messages"
        time="5m ago"
        title="Ada Lovelace"
        subtitle="Lunch"
        icon={
          <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true">
            <rect width="14" height="14" rx="3.5" fill="#34c759" />
          </svg>
        }
        thumbnail={
          <svg viewBox="0 0 32 32" width="32" height="32" role="img" aria-label="Attached picture">
            <rect width="32" height="32" rx="3" fill="#8e8e93" />
            <path d="M4 26 13 14 19 21 23 17 28 26z" fill="#ffffff" />
          </svg>
        }
        onOpen={() => setLog("Opened.")}
        onClear={() => setLog("Cleared.")}
      >
        Are we still on for noon? I booked the table by the window, and the analytical engine can
        wait until the afternoon.
      </NotificationBanner>
      <p style={{ margin: "8px 0 0", color: "light-dark(#27444d, #ffffff)" }}>{log}</p>
    </div>
  );
}
