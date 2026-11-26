import { ManagedWindow, useManagedWindow } from "macalicious/managed-window";
import { TitleBar } from "macalicious/title-bar";
import { WindowBody } from "macalicious/window";
import { WindowControls } from "macalicious/window-controls";
import { WindowManager } from "macalicious/window-manager";

function Content() {
  const managed = useManagedWindow();
  return (
    <>
      <TitleBar
        variant="unified"
        controls={<WindowControls {...managed.controlsProps} />}
        style={{ height: 55 }}
        {...managed.titleBarProps}
      />
      <WindowBody />
    </>
  );
}

/**
 * Visual comparison target: the crop the plain window is measured with, the top-left corner of
 * the key Finder window with its shadow, drawn by a window its manager placed at that frame.
 * Reference crop x=0 y=0 w=252 h=120 (126 x 60 pt) of the Finder Network captures, whose
 * transparent margins are matted with white.
 */
export default function VisualCornerTopLeft() {
  return (
    <div
      style={{
        position: "relative",
        width: 126,
        height: 60,
        overflow: "hidden",
        background: "white",
      }}
    >
      <WindowManager style={{ width: 1100, height: 800, background: "transparent" }}>
        <ManagedWindow
          aria-label="Network"
          defaultFrame={{ x: 56, y: 38, width: 926, height: 711 }}
        >
          <Content />
        </ManagedWindow>
      </WindowManager>
    </div>
  );
}
