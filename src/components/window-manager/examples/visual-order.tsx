import { ManagedWindow } from "macalicious/managed-window";
import { WindowBody } from "macalicious/window";
import { WindowManager } from "macalicious/window-manager";

/** Two overlapping windows with different fills, for the stacking checks. */
export default function VisualOrder() {
  return (
    <WindowManager style={{ width: 300, height: 200 }}>
      <ManagedWindow
        id="back"
        aria-label="Back"
        resizable={false}
        defaultFrame={{ x: 20, y: 20, width: 200, height: 120 }}
      >
        <WindowBody />
      </ManagedWindow>
      <ManagedWindow
        id="front"
        aria-label="Front"
        resizable={false}
        defaultFrame={{ x: 140, y: 90, width: 140, height: 90 }}
      >
        <WindowBody background="content" />
      </ManagedWindow>
    </WindowManager>
  );
}
