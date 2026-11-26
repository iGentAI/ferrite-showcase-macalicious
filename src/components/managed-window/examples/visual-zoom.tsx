import { ManagedWindow } from "macalicious/managed-window";
import { WindowBody } from "macalicious/window";
import { WindowManager } from "macalicious/window-manager";

/** One small window on a desktop with a top inset, for the frame and zoom checks. */
export default function VisualZoom() {
  return (
    <WindowManager
      insets={{ top: 20 }}
      style={{ width: 300, height: 200, background: "var(--mac-color-control-background)" }}
    >
      <ManagedWindow aria-label="Window" defaultFrame={{ x: 20, y: 40, width: 120, height: 80 }}>
        <WindowBody />
      </ManagedWindow>
    </WindowManager>
  );
}
