import { ProgressWindow, ProgressWindowItem } from "macalicious/progress-window";
import { WindowControls } from "macalicious/window-controls";

/**
 * Several operations in one window, the second not started yet, and the same window when it
 * is not key: the bar and the window controls turn grey.
 */
export default function States() {
  return (
    <div style={{ display: "grid", gap: 32, padding: "24px 48px 64px" }}>
      <ProgressWindow controls={<WindowControls closeDisabled zoomDisabled />}>
        <ProgressWindowItem
          title="Copying 12 items to “Documents”"
          status="48 MB of 210 MB - About 20 seconds"
          value={23}
          onStop={() => {}}
        />
        <ProgressWindowItem
          title="Preparing to move to “Backup”…"
          status="Estimating time remaining…"
          onStop={() => {}}
        />
      </ProgressWindow>
      <ProgressWindow
        state="inactive"
        aria-label="Progress, window not key"
        controls={<WindowControls closeDisabled zoomDisabled />}
      >
        <ProgressWindowItem
          title="Copying 12 items to “Documents”"
          status="48 MB of 210 MB - About 20 seconds"
          value={23}
          onStop={() => {}}
        />
      </ProgressWindow>
    </div>
  );
}
